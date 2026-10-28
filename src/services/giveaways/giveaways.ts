// Giveaway service shared by /giveaway, the giveaway buttons, the dashboard and the minute job: start, join, end,
// reroll and delete. Every change of one giveaway runs under its lock and re-reads the stored record, so a join that
// races an end cannot reopen the giveaway.

import type { GuildBasedChannel, Message, SendableChannels, TextBasedChannel } from 'discord.js';
import type { NexoClient } from '../../types/index.js';
import { botConfig } from '../../config/bot.js';
import { logger } from '../../utils/logger.js';
import { Mutex } from '../../utils/mutex.js';
import { NexoBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { checkRateLimit, getRateLimitStatus } from '../../utils/rateLimiter.js';
import { logEvent, EVENT_TYPES } from '../loggingService.js';
import { concludeGiveaway, isClosed, isEnded, parseDuration, redrawGiveaway, validatePrize, validateWinnerCount } from './core.js';
import type { Giveaway, GiveawayLimits } from './core.js';
import * as store from './store.js';
import { giveawayMessage, mentions, rerollAnnouncement, winnerAnnouncement } from './views.js';

export type { Giveaway } from './core.js';
export { endTimeOf, isEnded } from './core.js';
export { readGiveaways as getGuildGiveaways, readGiveaway as getGiveaway } from './store.js';

const config = botConfig.giveaways ?? {};
export const GIVEAWAY_LIMITS: GiveawayLimits = {
  minimumDuration: config.minimumDuration ?? 10_000,
  maximumDuration: config.maximumDuration ?? 30 * 86_400_000,
  minimumWinners: config.minimumWinners ?? 1,
  maximumWinners: config.maximumWinners ?? 10,
};
const INTERACTION_COOLDOWN = 1000;

const notFound = (messageId: string) =>
  new NexoBotError('Giveaway not found in database', ErrorTypes.VALIDATION, 'Dieses Giveaway ist nicht mehr aktiv.', { messageId });

async function log(client: NexoClient, guildId: string, eventType: string, data: Record<string, unknown>) {
  await logEvent({ client, guildId, eventType, data }).catch((error: unknown) => logger.debug(`Error logging ${eventType}:`, error));
}

/** Runs `change` on the freshly read giveaway under its lock and stores the result. */
async function updateGiveaway(
  client: NexoClient,
  guildId: string,
  messageId: string,
  change: (giveaway: Giveaway) => Giveaway,
): Promise<{ before: Giveaway; after: Giveaway }> {
  return Mutex.runExclusive(`giveaway:${messageId}`, async () => {
    const before = await store.readGiveaway(client, guildId, messageId);
    if (!before) throw notFound(messageId);
    const after = change(before);
    if (after !== before) await store.writeGiveaway(client, guildId, after);
    return { before, after };
  });
}

async function fetchMessage(client: NexoClient, channelId: string | undefined, messageId: string) {
  const channel = channelId ? await client.channels.fetch(channelId).catch(() => null) : null;
  if (!channel?.isTextBased()) return { channel: null, message: null };
  const message: Message | null = await channel.messages.fetch(messageId).catch(() => null);
  return { channel, message };
}

/** Validates, posts the giveaway message, stores it and logs the event. */
export async function startGiveaway(
  client: NexoClient,
  guildId: string,
  channel: GuildBasedChannel,
  { duration, winnerCount, prize, hostId }: { duration: string | null; winnerCount: number; prize: string | null; hostId: string },
): Promise<Giveaway> {
  const durationMs = parseDuration(duration, GIVEAWAY_LIMITS);
  validateWinnerCount(winnerCount, GIVEAWAY_LIMITS);
  const prizeName = validatePrize(prize);
  if (!channel.isTextBased()) {
    throw new NexoBotError('Target channel is not text-based', ErrorTypes.VALIDATION, 'Der Kanal muss ein Textkanal sein.', { channelId: channel.id });
  }

  const endTime = Date.now() + durationMs;
  const giveaway: Giveaway = {
    messageId: 'placeholder',
    channelId: channel.id,
    guildId,
    prize: prizeName,
    hostId,
    endTime,
    endsAt: endTime,
    winnerCount,
    participants: [],
    isEnded: false,
    ended: false,
    createdAt: new Date().toISOString(),
  };
  const message = await channel.send(giveawayMessage(giveaway, 'active'));
  giveaway.messageId = message.id;
  await store.writeGiveaway(client, guildId, giveaway);

  await log(client, guildId, EVENT_TYPES.GIVEAWAY_CREATE, {
    description: `Giveaway erstellt: ${prizeName}`,
    channelId: channel.id,
    userId: hostId,
    fields: [
      { name: 'Preis', value: prizeName, inline: true },
      { name: 'Gewinner', value: winnerCount.toString(), inline: true },
      { name: 'Dauer', value: duration!, inline: true },
      { name: 'Kanal', value: channel.toString(), inline: true },
    ],
  });
  logger.info(`Giveaway created: ${message.id} in ${channel.name}`);
  return giveaway;
}

export type JoinResult = { status: 'joined'; giveaway: Giveaway } | { status: 'rate_limited' | 'closed' | 'already_joined' };

/** Adds the member to the giveaway's participants. */
export async function joinGiveaway(client: NexoClient, guildId: string, messageId: string, userId: string): Promise<JoinResult> {
  const rateKey = `giveaway:${userId}:${messageId}`;
  const status = getRateLimitStatus(rateKey, INTERACTION_COOLDOWN);
  if ((status.attempts ?? 0) >= 1 && status.remaining > 0) return { status: 'rate_limited' };
  await checkRateLimit(rateKey, 1, INTERACTION_COOLDOWN);

  let result: JoinResult = { status: 'closed' };
  await updateGiveaway(client, guildId, messageId, (giveaway) => {
    const participants = giveaway.participants ?? [];
    if (isClosed(giveaway, Date.now())) return giveaway;
    if (participants.includes(userId)) {
      result = { status: 'already_joined' };
      return giveaway;
    }
    const joined = { ...giveaway, participants: [...participants, userId] };
    result = { status: 'joined', giveaway: joined };
    return joined;
  });
  return result;
}

/**
 * Ends the giveaway now (command, button, dashboard, minute job): draws and stores the winners, then edits the
 * message, announces and logs. Throws when the channel or the message is gone; the giveaway is ended anyway.
 */
export async function endGiveaway(
  client: NexoClient,
  guildId: string,
  messageId: string,
  endedBy: string,
): Promise<{ giveaway: Giveaway; channel: TextBasedChannel }> {
  const { after: giveaway } = await updateGiveaway(client, guildId, messageId, (current) => {
    if (isEnded(current)) {
      throw new NexoBotError(`Giveaway ${messageId} is already ended`, ErrorTypes.VALIDATION, 'Dieses Giveaway ist bereits beendet.', { messageId });
    }
    return concludeGiveaway(current, endedBy, new Date());
  });
  const winners = giveaway.winnerIds ?? [];
  logger.info(`Ended giveaway ${messageId}: ${winners.length} winner(s) from ${giveaway.participants?.length ?? 0} entries`);

  const { channel, message } = await fetchMessage(client, giveaway.channelId, messageId);
  if (!channel) {
    throw new NexoBotError(`Channel not found: ${giveaway.channelId}`, ErrorTypes.VALIDATION,
      'Der Kanal des Giveaways wurde nicht gefunden. Der Status des Giveaways wurde trotzdem aktualisiert.', { messageId });
  }
  if (!message) {
    throw new NexoBotError(`Message not found: ${messageId}`, ErrorTypes.VALIDATION,
      'Die Giveaway-Nachricht wurde nicht gefunden. Der Status des Giveaways wurde trotzdem aktualisiert.', { messageId });
  }

  await message.edit(giveawayMessage(giveaway, 'ended'));
  const announcement = await (channel as SendableChannels).send({ content: winnerAnnouncement(giveaway) });
  if (winners.length > 0) {
    await updateGiveaway(client, guildId, messageId, (current) => ({ ...current, winnerPingMessageId: announcement.id }));
    await log(client, guildId, EVENT_TYPES.GIVEAWAY_WINNER, {
      description: `Giveaway mit ${winners.length} Gewinner(n) beendet`,
      channelId: channel.id,
      userId: endedBy,
      fields: [
        { name: 'Preis', value: giveaway.prize || 'Überraschungspreis!', inline: true },
        { name: 'Gewinner', value: mentions(winners), inline: false },
        { name: 'Teilnahmen', value: String(giveaway.participants?.length ?? 0), inline: true },
      ],
    });
  }
  return { giveaway, channel };
}

/**
 * Draws new winners for an ended giveaway, edits the message and the winner announcement (or posts one).
 * `channel` is null when the giveaway channel is gone; `messageFound` is false when only the announcement was sent.
 */
export async function rerollGiveaway(
  client: NexoClient,
  guildId: string,
  messageId: string,
  rerolledBy: string,
): Promise<{ giveaway: Giveaway; channel: TextBasedChannel | null; messageFound: boolean }> {
  const { after: giveaway } = await updateGiveaway(client, guildId, messageId, (current) => {
    if (!isEnded(current)) {
      throw new NexoBotError(`Giveaway still active: ${messageId}`, ErrorTypes.VALIDATION, 'Dieses Giveaway läuft noch. Bitte beende es zuerst.', { messageId });
    }
    if (!current.participants?.length) {
      throw new NexoBotError('No participants to reroll', ErrorTypes.VALIDATION, 'Es gibt keine Teilnahmen für eine neue Auslosung.', { messageId });
    }
    return redrawGiveaway(current, rerolledBy, new Date());
  });

  const { channel, message } = await fetchMessage(client, giveaway.channelId, messageId);
  if (channel) {
    if (message) await message.edit(giveawayMessage(giveaway, 'reroll'));
    const content = rerollAnnouncement(giveaway, Boolean(message));
    const ping = typeof giveaway.winnerPingMessageId === 'string'
      ? await channel.messages.fetch(giveaway.winnerPingMessageId).catch(() => null)
      : null;
    if (ping) {
      await ping.edit({ content });
    } else {
      const sent = await (channel as SendableChannels).send({ content });
      await updateGiveaway(client, guildId, messageId, (current) => ({ ...current, winnerPingMessageId: sent.id }));
    }
  }

  logger.info(`Giveaway rerolled: ${messageId} (${channel ? (message ? 'message edited' : 'announced only') : 'channel gone'})`);
  await log(client, guildId, EVENT_TYPES.GIVEAWAY_REROLL, {
    description: `Giveaway neu gezogen: ${giveaway.prize}`,
    channelId: giveaway.channelId,
    userId: rerolledBy,
    fields: [
      { name: 'Preis', value: giveaway.prize || 'Überraschungspreis!', inline: true },
      { name: 'Neue Gewinner', value: mentions(giveaway.winnerIds ?? []), inline: false },
      { name: 'Teilnahmen gesamt', value: String(giveaway.participants?.length ?? 0), inline: true },
    ],
  });
  return { giveaway, channel, messageFound: Boolean(message) };
}

/** Deletes the giveaway message and the stored giveaway. */
export async function removeGiveaway(
  client: NexoClient,
  guildId: string,
  giveaway: Giveaway,
  deletedBy: string,
): Promise<{ deletedMessage: boolean; channelName: string }> {
  const { channel, message } = await fetchMessage(client, giveaway.channelId, giveaway.messageId);
  const deletedMessage = message ? await message.delete().then(() => true, () => false) : false;
  const channelName = (channel as { name?: string } | null)?.name || 'Unbekannter Kanal';

  if (!(await store.deleteGiveaway(client, guildId, giveaway.messageId))) {
    throw new NexoBotError(`Failed to delete giveaway: ${giveaway.messageId}`, ErrorTypes.UNKNOWN,
      'Das Giveaway konnte nicht aus der Datenbank entfernt werden. Bitte versuch es erneut.', { messageId: giveaway.messageId });
  }
  logger.info(`Giveaway deleted: ${giveaway.messageId} in ${channelName}`);

  await log(client, guildId, EVENT_TYPES.GIVEAWAY_DELETE, {
    description: `Giveaway gelöscht: ${giveaway.prize}`,
    channelId: giveaway.channelId,
    userId: deletedBy,
    fields: [
      { name: 'Preis', value: giveaway.prize || 'Unbekannt', inline: true },
      { name: 'Teilnahmen', value: String(giveaway.participants?.length ?? 0), inline: true },
    ],
  });
  return { deletedMessage, channelName };
}

/** Minute job: ends every giveaway whose time is up. */
export async function checkGiveaways(client: NexoClient): Promise<void> {
  const due = await store.readDueGiveaways(client, new Date());
  if (due.length === 0) return;
  logger.info(`Processing ${due.length} ended giveaways`);

  for (const { guildId, giveaway } of due) {
    // Bot user as the one who ended it: the time ran out.
    await endGiveaway(client, guildId, giveaway.messageId, client.user.id).catch((error) => {
      const expected = error instanceof NexoBotError && error.type === ErrorTypes.VALIDATION;
      if (expected) logger.debug(`Giveaway ${giveaway.messageId} ended without message update: ${error.message}`);
      else logger.error(`Error ending giveaway ${giveaway.messageId}:`, error);
    });
  }
}
