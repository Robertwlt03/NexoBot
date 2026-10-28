// Join-to-Create service: trigger channels that open a temporary voice channel per member, used by /jointocreate,
// the dashboard and the voice/channel events. Every config change runs under the guild's lock on a fresh read, so
// two members joining at once cannot drop each other's temporary channel.

import type { ChannelType, Guild, GuildMember, VoiceBasedChannel, VoiceChannel, VoiceState } from 'discord.js';
import type { NexoClient } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { Mutex } from '../../utils/mutex.js';
import { NexoBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { formatLogLine } from '../../utils/logging/logEmbeds.js';
import { logEvent, EVENT_TYPES } from '../loggingService.js';
import {
  formatChannelName, ownedTemporaryChannel, temporaryChannelName, triggerSettings, validateBitrate, validateChannelNameTemplate,
  validateUserLimit,
} from './core.js';
import type { ChannelNameVariables, JoinToCreateChannelOptions, JoinToCreateConfig } from './core.js';
import * as store from './store.js';
import { temporaryChannelFailedMessage } from './views.js';

export type { JoinToCreateChannelOptions, JoinToCreateConfig } from './core.js';
export { triggerSettings, validateChannelNameTemplate } from './core.js';
export { readConfig as getConfiguration } from './store.js';

// discord.js channel type as a value without importing it (services import types only).
const GUILD_VOICE: ChannelType.GuildVoice = 2;
const CREATE_COOLDOWN_MS = 2000;
const lastCreation = new Map<string, number>();

const notATrigger = () => new NexoBotError('Channel is not a Join to Create trigger', ErrorTypes.VALIDATION,
  'Dieser Kanal ist nicht als Join-to-Create-Auslöser eingerichtet.');

/** Runs `change` on the freshly read config under the guild's lock; stores it when `change` returns true. */
async function updateConfig(client: NexoClient, guildId: string, change: (config: JoinToCreateConfig) => boolean): Promise<JoinToCreateConfig> {
  return Mutex.runExclusive(`jointocreate:${guildId}`, async () => {
    const config = await store.readConfig(client, guildId);
    if (change(config)) await store.writeConfig(client, guildId, config);
    return config;
  });
}

function dropTrigger(config: JoinToCreateConfig, channelId: string): void {
  config.triggerChannels = config.triggerChannels.filter((id) => id !== channelId);
  config.enabled = config.triggerChannels.length > 0;
  delete config.channelOptions?.[channelId];
  for (const [tempId, info] of Object.entries(config.temporaryChannels)) {
    if (info.triggerChannelId === channelId) delete config.temporaryChannels[tempId];
  }
}

export async function logConfigurationChange(client: NexoClient, guildId: string, userId: string, action: string, details: unknown): Promise<void> {
  await logEvent({
    client,
    guildId,
    eventType: EVENT_TYPES.COUNTER_CONFIG,
    data: {
      title: 'Join-to-Create aktualisiert',
      lines: [formatLogLine('Aktion', action), formatLogLine('Details', typeof details === 'string' ? details : JSON.stringify(details))],
      userId,
    },
  }).catch((error: unknown) => logger.warn(`Failed to log Join to Create configuration change: ${(error as Error).message}`));
}

/** The settings of a trigger channel; throws when the channel is not a trigger. */
export async function getTriggerSettings(client: NexoClient, guildId: string, channelId: string): Promise<JoinToCreateChannelOptions> {
  const config = await store.readConfig(client, guildId);
  if (!config.triggerChannels.includes(channelId)) throw notATrigger();
  return triggerSettings(config, channelId);
}

export interface CreateTriggerOptions {
  categoryId?: string | null;
  nameTemplate: string;
  userLimit: number;
  /** kbps, as entered by the user. */
  bitrate: number;
}

/**
 * Creates the "Join-to-Create" voice channel and stores it as the guild's trigger. Triggers whose channel is gone are
 * removed first; only one trigger per guild.
 */
export async function createJoinToCreateTrigger(
  client: NexoClient,
  guild: Guild,
  userId: string,
  { categoryId, nameTemplate, userLimit, bitrate }: CreateTriggerOptions,
): Promise<{ channel: VoiceChannel }> {
  validateChannelNameTemplate(nameTemplate);
  validateUserLimit(userLimit);
  validateBitrate(bitrate);

  const existing = (await store.readConfig(client, guild.id)).triggerChannels;
  const alive = await Promise.all(existing.map((id) => guild.channels.fetch(id).catch(() => null)));
  const stale = existing.filter((_, i) => !alive[i]);
  if (stale.length) {
    logger.info(`Cleaning up stale Join to Create triggers ${stale.join(', ')} in guild ${guild.id}`);
    await updateConfig(client, guild.id, (config) => {
      stale.forEach((id) => dropTrigger(config, id));
      return true;
    });
  }
  const active = alive.find(Boolean);
  if (active) {
    throw new NexoBotError('Guild already has a Join to Create channel', ErrorTypes.VALIDATION,
      `Dieser Server hat bereits einen Join-to-Create-Kanal: ${active}\n\nNutze \`/jointocreate dashboard\`, um ihn zu bearbeiten, oder entferne ihn zuerst, bevor du einen neuen erstellst.`,
      { guildId: guild.id, expected: true, suppressErrorLog: true });
  }

  const channel = await guild.channels.create({
    name: 'Join-to-Create',
    type: GUILD_VOICE,
    parent: categoryId ?? undefined,
    userLimit: 0,
    bitrate: 64_000,
    permissionOverwrites: [{ id: guild.id, allow: ['ViewChannel', 'Connect'] }],
  });

  try {
    await updateConfig(client, guild.id, (config) => {
      config.triggerChannels.push(channel.id);
      config.enabled = true;
      config.channelOptions = {
        ...config.channelOptions,
        [channel.id]: { nameTemplate, userLimit, bitrate: bitrate * 1000, categoryId: categoryId ?? null, createdAt: Date.now() },
      };
      return true;
    });
  } catch (error) {
    await channel.delete('Join-to-Create konnte nicht gespeichert werden').catch(() => null);
    logger.error(`Failed to save Join to Create trigger in guild ${guild.id}:`, error);
    throw new NexoBotError('Failed to save Join to Create configuration', ErrorTypes.DATABASE,
      'Join-to-Create konnte nicht eingerichtet werden. Bitte versuch es erneut.');
  }

  await logConfigurationChange(client, guild.id, userId, 'Join-to-Create eingerichtet', { channelId: channel.id, nameTemplate, userLimit, bitrate });
  logger.info(`Created Join to Create trigger ${channel.id} in guild ${guild.id}`);
  return { channel };
}

/** Changes name template, user limit (0–99) or bitrate (bit/s) of a trigger and logs the change. */
export async function updateTriggerSettings(
  client: NexoClient,
  guildId: string,
  channelId: string,
  updates: Partial<JoinToCreateChannelOptions>,
  userId: string,
  action: string,
): Promise<void> {
  if (updates.nameTemplate !== undefined) validateChannelNameTemplate(updates.nameTemplate);
  if (updates.userLimit !== undefined) validateUserLimit(updates.userLimit);
  if (updates.bitrate !== undefined) validateBitrate(updates.bitrate / 1000);

  await updateConfig(client, guildId, (config) => {
    if (!config.triggerChannels.includes(channelId)) throw notATrigger();
    config.channelOptions = { ...config.channelOptions, [channelId]: { ...config.channelOptions?.[channelId], ...updates, updatedAt: Date.now() } };
    return true;
  });
  await logConfigurationChange(client, guildId, userId, action, { channelId, ...updates });
}

/** Removes a trigger, logs it and deletes its channel when nobody is in it. */
export async function removeJoinToCreateTrigger(client: NexoClient, guild: Guild, channelId: string, userId: string): Promise<{ channelDeleted: boolean }> {
  const triggerChannel = guild.channels.cache.get(channelId);
  await updateConfig(client, guild.id, (config) => {
    if (!config.triggerChannels.includes(channelId)) throw notATrigger();
    dropTrigger(config, channelId);
    return true;
  });
  await logConfigurationChange(client, guild.id, userId, 'Join-to-Create-Trigger entfernt', { channelId, channelName: triggerChannel?.name });

  if (!triggerChannel?.isVoiceBased() || triggerChannel.members.size > 0) return { channelDeleted: false };
  return triggerChannel.delete('Join-to-Create-Trigger von einem Administrator entfernt')
    .then(() => ({ channelDeleted: true }), (error: Error) => {
      logger.warn(`Could not delete channel ${channelId}: ${error.message}`);
      return { channelDeleted: false };
    });
}

/** A channel was deleted in Discord: drop it as trigger, temporary channel or category. */
export async function handleChannelDeleted(client: NexoClient, guildId: string, channelId: string): Promise<void> {
  await updateConfig(client, guildId, (config) => {
    let changed = false;
    if (config.triggerChannels.includes(channelId)) {
      logger.info(`Join to Create trigger ${channelId} was deleted, removing it from guild ${guildId}`);
      dropTrigger(config, channelId);
      changed = true;
    }
    if (config.temporaryChannels[channelId]) {
      delete config.temporaryChannels[channelId];
      changed = true;
    }
    if (config.categoryId === channelId) {
      logger.warn(`Join to Create category ${channelId} was deleted; Join to Create is disabled in guild ${guildId}`);
      config.categoryId = null;
      config.enabled = false;
      changed = true;
    }
    return changed;
  });
}

const nameVariables = (member: GuildMember, triggerName: string): ChannelNameVariables => ({
  username: member.user.username,
  userTag: member.user.tag,
  displayName: member.displayName,
  guildName: member.guild.name,
  channelName: triggerName,
});

/** Voice state changed: open a temporary channel from a trigger, delete empty ones, hand over ownership. */
export async function handleVoiceStateUpdate(client: NexoClient, oldState: VoiceState, newState: VoiceState): Promise<void> {
  const member = newState.member;
  if (!member || member.user.bot) return;

  // One read per event; changes re-read under the lock.
  const config = await store.readConfig(client, newState.guild.id);
  if (!config.enabled || config.triggerChannels.length === 0) return;

  const left = oldState.channel && oldState.channel.id !== newState.channel?.id ? oldState.channel : null;
  const joined = newState.channel && newState.channel.id !== oldState.channel?.id ? newState.channel : null;

  if (left && config.temporaryChannels[left.id]) await leaveTemporaryChannel(client, left, member);
  if (joined && config.triggerChannels.includes(joined.id) && !(left && config.triggerChannels.includes(left.id))) {
    await joinTrigger(client, joined, member, config);
  }
}

async function leaveTemporaryChannel(client: NexoClient, channel: VoiceBasedChannel, member: GuildMember): Promise<void> {
  const guildId = channel.guild.id;
  if (channel.members.size === 0) {
    await updateConfig(client, guildId, (config) => delete config.temporaryChannels[channel.id]);
    await channel.delete('Temporärer Sprachkanal – leer').catch((error) => logger.error(`Failed to delete temporary channel ${channel.id}:`, error));
    return;
  }

  const nextOwner = channel.members.first()!;
  let triggerChannelId: string | null = null;
  const config = await updateConfig(client, guildId, (current) => {
    const info = current.temporaryChannels[channel.id];
    if (info?.ownerId !== member.id) return false;
    info.ownerId = nextOwner.id;
    triggerChannelId = info.triggerChannelId;
    return true;
  });
  if (!triggerChannelId) return;

  const { nameTemplate } = triggerSettings(config, triggerChannelId);
  if (/\{(username|displayName|display_name|user_tag)\}/.test(nameTemplate)) {
    const triggerName = channel.guild.channels.cache.get(triggerChannelId)?.name ?? 'Sprachkanal';
    await channel.setName(formatChannelName(nameTemplate, nameVariables(nextOwner, triggerName)))
      .catch((error) => logger.error(`Failed to rename temporary channel ${channel.id}:`, error));
  }
  logger.info(`Transferred ownership of temporary channel ${channel.id} to ${nextOwner.id}`);
}

async function joinTrigger(client: NexoClient, trigger: VoiceBasedChannel, member: GuildMember, config: JoinToCreateConfig): Promise<void> {
  const guild = trigger.guild;
  const cooldownKey = `${guild.id}-${member.id}`;
  const now = Date.now();
  for (const [key, at] of lastCreation) if (now - at >= CREATE_COOLDOWN_MS) lastCreation.delete(key);
  if (lastCreation.has(cooldownKey)) {
    logger.warn(`User ${member.id} is on cooldown for channel creation`);
    return;
  }

  const ownedId = ownedTemporaryChannel(config, member.id);
  const owned = ownedId ? guild.channels.cache.get(ownedId) : undefined;
  if (owned?.isVoiceBased()) {
    const moved = await member.voice.setChannel(owned).then(() => true, (error) => {
      logger.warn(`Failed to move user ${member.id} to existing channel ${owned.id}:`, error);
      return false;
    });
    if (moved) return;
  }
  if (member.voice.channel?.id !== trigger.id) return;

  const me = guild.members.me;
  if (!me || !trigger.permissionsFor(me)?.has(['ManageChannels', 'MoveMembers', 'Connect'])) {
    logger.warn(`Missing permissions for temporary channel creation in guild ${guild.id} (trigger ${trigger.id})`);
    return;
  }

  lastCreation.set(cooldownKey, now);
  try {
    const settings = triggerSettings(config, trigger.id);
    const existing = guild.channels.cache.filter((c) => c.parentId === trigger.parentId && c.name.startsWith(trigger.name)).size;
    const temp = await guild.channels.create({
      name: temporaryChannelName(settings.nameTemplate, nameVariables(member, trigger.name), existing),
      type: GUILD_VOICE,
      parent: trigger.parentId,
      userLimit: settings.userLimit === 0 ? undefined : settings.userLimit,
      bitrate: settings.bitrate,
      permissionOverwrites: [
        { id: member.id, allow: ['Connect', 'Speak', 'PrioritySpeaker', 'MoveMembers'] },
        { id: guild.id, allow: ['Connect', 'Speak'] },
      ],
    });
    await updateConfig(client, guild.id, (current) => {
      current.temporaryChannels[temp.id] = { ownerId: member.id, triggerChannelId: trigger.id, createdAt: Date.now() };
      return true;
    });
    if (member.voice.channel?.id === trigger.id) await member.voice.setChannel(temp);
    logger.info(`Created temporary voice channel ${temp.name} (${temp.id}) for ${member.user.tag} in guild ${guild.name}`);
  } catch (error) {
    logger.error(`Failed to create temporary channel for ${member.user.tag} in guild ${guild.name}:`, error);
    lastCreation.delete(cooldownKey);
    await member.send({ content: temporaryChannelFailedMessage }).catch(() => undefined);
  }
}
