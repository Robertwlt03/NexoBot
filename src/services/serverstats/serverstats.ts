// Server stats service: counter channels that show the number of members and bots in their name.

import type { ChannelType, Guild, GuildBasedChannel, NonThreadGuildBasedChannel } from 'discord.js';
import type { NexoClient } from '../../types/index.js';
import botConfig from '../../config/bot.js';
import { logger } from '../../utils/logger.js';
import { createError, ErrorTypes, wrapServiceBoundary } from '../../utils/errorHandler.js';
import { formatLogLine } from '../../utils/logging/logEmbeds.js';
import { logEvent, EVENT_TYPES } from '../loggingService.js';
import { countFor, counterStats, formatCounterChannelName, getCounterBaseName, getCounterTypeLabel } from './core.js';
import type { CounterStats, ServerCounter } from './core.js';
import * as store from './store.js';

export type { CounterStats, ServerCounter } from './core.js';
export { getCounterTypeDisplay, getCounterTypeLabel } from './core.js';
export { readCounters as getServerCounters } from './store.js';

// discord.js channel types as values without importing them (services import types only).
const GUILD_TEXT: ChannelType.GuildText = 0;
const GUILD_VOICE: ChannelType.GuildVoice = 2;

const channelName = (type: string, count: number) => formatCounterChannelName(type, count, botConfig.counters?.defaults?.channelName);

async function saveCounters(client: NexoClient, guildId: string, counters: ServerCounter[], userMessage: string): Promise<void> {
  try {
    await store.writeCounters(client, guildId, counters);
  } catch (error) {
    logger.error('Error saving server counters:', error);
    throw createError('Counter save failed', ErrorTypes.DATABASE, userMessage, { guildId });
  }
}

/** Member, bot and human counts of the guild: one member fetch, the cache when Discord does not answer. */
export async function getGuildCounterStats(guild: Guild): Promise<CounterStats> {
  const members = await guild.members.fetch().catch((error) => {
    if (process.env.NODE_ENV !== 'production') {
      logger.debug(`Failed to fetch all guild members for ${guild.id}, using cache only`, error);
    }
    return guild.members.cache;
  });
  return counterStats(guild.memberCount, members.size, members.filter((member) => member.user.bot).size);
}

/** Renames the counter's channel to the current count; false when the channel is gone or cannot be renamed. */
async function updateCounter(client: NexoClient, guild: Guild, counter: ServerCounter, stats: CounterStats): Promise<boolean> {
  const channel: GuildBasedChannel | null = guild.channels.cache.get(counter.channelId)
    ?? await guild.channels.fetch(counter.channelId).catch(() => null);
  if (!channel) {
    logger.warn(`Counter channel ${counter.channelId} not found in guild ${guild.id}, skipping update`);
    return false;
  }
  const count = countFor(stats, counter.type);
  if (count === null) {
    logger.error('Unknown counter type:', counter.type);
    return false;
  }
  const newName = channelName(counter.type, count);
  if (channel.name === newName) return true;

  try {
    await channel.setName(newName);
  } catch (error) {
    logger.error(`Failed to update channel name for ${channel.id}:`, error);
    return false;
  }
  await logEvent({
    client,
    guildId: guild.id,
    eventType: EVENT_TYPES.COUNTER_UPDATE,
    data: {
      title: 'Zähler aktualisiert',
      lines: [formatLogLine('Typ', getCounterTypeLabel(counter.type)), formatLogLine('Anzahl', count.toString()), formatLogLine('Kanal', channel.toString())],
      channelId: channel.id,
    },
  }).catch((error) => logger.debug('Error logging counter update:', error));
  return true;
}

/** Counters whose channel still exists; counters of deleted channels are removed from storage. */
async function pruneOrphans(client: NexoClient, guild: Guild, counters: ServerCounter[]): Promise<ServerCounter[]> {
  const valid = counters.filter((counter) => guild.channels.cache.has(counter.channelId));
  if (valid.length < counters.length) {
    await store.writeCounters(client, guild.id, valid);
    logger.info(`Cleaned up ${counters.length - valid.length} orphaned counter(s) from guild ${guild.id}`);
  }
  return valid;
}

/**
 * Brings every counter of the guild up to date (member join/leave, the 15-minute job). The member counts are fetched
 * once for all counters; counters of deleted channels are removed.
 */
export async function refreshCounters(client: NexoClient, guild: Guild): Promise<void> {
  const counters = await pruneOrphans(client, guild, await store.readCounters(client, guild.id));
  const active = counters.filter((counter) => counter.enabled);
  if (active.length === 0) return;
  const stats = await getGuildCounterStats(guild);
  for (const counter of active) await updateCounter(client, guild, counter, stats);
}

/** Counter channel deleted in Discord: its counter goes too. */
export async function removeCounterForChannel(client: NexoClient, guildId: string, channelId: string): Promise<void> {
  const counters = await store.readCounters(client, guildId);
  const remaining = counters.filter((counter) => counter.channelId !== channelId);
  if (remaining.length < counters.length) {
    await store.writeCounters(client, guildId, remaining);
    logger.info(`Removed the counter of deleted channel ${channelId} from guild ${guildId}`);
  }
}

/** The list for /serverstats list: counters with existing channels (orphans removed), their channels and the counts. */
export async function getCounterOverview(client: NexoClient, guild: Guild) {
  const counters = await pruneOrphans(client, guild, await store.readCounters(client, guild.id));
  const stats = await getGuildCounterStats(guild);
  return counters.map((counter) => {
    const count = countFor(stats, counter.type) ?? 0;
    const channel = guild.channels.cache.get(counter.channelId)!;
    return { counter, channel, count, upToDate: channel.name === channelName(counter.type, count) };
  });
}

/**
 * Creates a counter channel in a category and stores the counter (same as /serverstats create).
 * Only one counter per type. `nameUpdated` is false when the channel name could not be set yet.
 */
export async function createServerCounter(
  client: NexoClient,
  guild: Guild,
  { type, channelType, categoryId, createdBy }: { type: string; channelType: string | null; categoryId: string; createdBy: string },
): Promise<{ counter: ServerCounter; channel: NonThreadGuildBasedChannel; nameUpdated: boolean }> {
  const counters = await store.readCounters(client, guild.id);

  const duplicateType = counters.find((counter) => counter.type === type);
  if (duplicateType) {
    const duplicateChannel = guild.channels.cache.get(duplicateType.channelId);
    throw createError('Counter type exists', ErrorTypes.UNKNOWN, `Auf diesem Server gibt es bereits einen **${getCounterTypeLabel(type)}**-Zähler${duplicateChannel ? ` in ${duplicateChannel}` : ''}. Lösche ihn zuerst, bevor du einen neuen erstellst.`, { expected: true });
  }

  const channel = await guild.channels.create({
    name: getCounterBaseName(type),
    type: channelType === 'voice' ? GUILD_VOICE : GUILD_TEXT,
    parent: categoryId,
    reason: `Zählerkanal erstellt von ${createdBy}`,
  });

  const counter: ServerCounter = {
    id: Date.now().toString(),
    type,
    channelId: channel.id,
    guildId: guild.id,
    createdAt: new Date().toISOString(),
    enabled: true,
  };

  try {
    await saveCounters(client, guild.id, [...counters, counter], 'Zählerdaten konnten nicht gespeichert werden. Bitte versuche es erneut.');
  } catch (error) {
    await channel.delete('Zählererstellung beim Speichern fehlgeschlagen').catch(() => null);
    throw error;
  }

  const nameUpdated = await updateCounter(client, guild, counter, await getGuildCounterStats(guild));
  return { counter, channel, nameUpdated };
}

/** Changes a counter's type and renames its channel (same as /serverstats update). */
export async function changeServerCounterType(
  client: NexoClient,
  guild: Guild,
  counterId: string | null,
  newType: string,
): Promise<{ counter: ServerCounter; oldType: string; nameUpdated: boolean }> {
  const counters = await store.readCounters(client, guild.id);

  const counter = counters.find((c) => c.id === counterId);
  if (!counter) {
    throw createError('Counter not found', ErrorTypes.USER_INPUT, `Zähler mit der ID \`${counterId}\` nicht gefunden. Nutze \`/serverstats list\`, um alle Zähler anzusehen.`, { expected: true });
  }
  if (!guild.channels.cache.get(counter.channelId)) {
    throw createError('Counter channel missing', ErrorTypes.USER_INPUT, 'Der Kanal dieses Zählers existiert nicht mehr. Zähler gelöschter Kanäle können nicht aktualisiert werden.', { expected: true });
  }

  if (newType !== counter.type) {
    const existingTypeCounter = counters.find((c) => c.type === newType && c.id !== counter.id);
    if (existingTypeCounter) {
      const existingChannel = guild.channels.cache.get(existingTypeCounter.channelId);
      throw createError('Counter type exists', ErrorTypes.UNKNOWN, `Auf diesem Server gibt es bereits einen **${getCounterTypeLabel(newType)}**-Zähler${existingChannel ? ` in ${existingChannel}` : ''}. Lösche ihn zuerst, bevor du diesen Typ erneut verwendest.`, { expected: true });
    }
  }

  const oldType = counter.type;
  counter.type = newType;
  counter.updatedAt = new Date().toISOString();
  await saveCounters(client, guild.id, counters, 'Die aktualisierten Zählerdaten konnten nicht gespeichert werden. Bitte versuche es erneut.');

  const nameUpdated = await updateCounter(client, guild, counter, await getGuildCounterStats(guild));
  return { counter, oldType, nameUpdated };
}

/** A counter of the guild by id, with its channel when that still exists (delete confirmation). */
export async function findCounter(client: NexoClient, guild: Guild, counterId: string | null) {
  const counters = await store.readCounters(client, guild.id);
  const counter = counters.find((c) => c.id === counterId);
  return { hasCounters: counters.length > 0, counter, channel: counter ? guild.channels.cache.get(counter.channelId) ?? null : null };
}

/** Deletes a counter and its channel (confirm button of /serverstats delete). */
export const performDeletionByCounterId = wrapServiceBoundary(async function performDeletionByCounterId(client: NexoClient, guild: Guild, counterId: string) {
  const counters = await store.readCounters(client, guild.id);

  const counter = counters.find((c) => c.id === counterId);
  if (!counter) {
    throw createError(
      'Counter not found',
      ErrorTypes.USER_INPUT,
      `Zähler mit der ID \`${counterId}\` wurde nicht gefunden.`,
      { guildId: guild.id, counterId, operation: 'performDeletionByCounterId' },
    );
  }

  await saveCounters(client, guild.id, counters.filter((c) => c.id !== counter.id), 'Zähler konnte nicht gelöscht werden. Bitte versuche es erneut.');

  const channel = guild.channels.cache.get(counter.channelId);
  let channelDeleted = false;
  if (channel) {
    try {
      await channel.delete(`Zähler gelöscht – Kanal wird entfernt: ${counter.id}`);
      channelDeleted = true;
    } catch (error) {
      logger.error('Error deleting channel:', error);
    }
  }

  return { counter, channelName: channel?.name ?? null, channelDeleted };
}, {
  service: 'serverstats',
  operation: 'performDeletionByCounterId',
  userMessage: 'Beim Löschen des Zählers ist ein Fehler aufgetreten. Bitte versuche es erneut.',
});
