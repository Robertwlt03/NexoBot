// Pure Join-to-Create rules: the stored config, input validation and the names of temporary channels.

import { NexoBotError, ErrorTypes } from '../../utils/errorHandler.js';

export interface JoinToCreateChannelOptions {
  nameTemplate: string;
  userLimit: number;
  /** bit/s */
  bitrate: number;
}

export interface TemporaryChannelInfo {
  ownerId: string;
  triggerChannelId: string;
  createdAt: number;
  [key: string]: unknown;
}

/** Stored config (`guild:{guildId}:jointocreate`). */
export interface JoinToCreateConfig {
  enabled: boolean;
  triggerChannels: string[];
  categoryId: string | null;
  channelNameTemplate: string;
  userLimit: number;
  bitrate: number;
  temporaryChannels: Record<string, TemporaryChannelInfo>;
  channelOptions?: Record<string, Partial<JoinToCreateChannelOptions> & { categoryId?: string | null; createdAt?: number; updatedAt?: number }>;
  [key: string]: unknown;
}

export interface ChannelNameVariables {
  username: string;
  userTag: string;
  displayName: string;
  guildName: string;
  channelName: string;
}

export const DEFAULT_TEMPLATE = 'Raum von {username}';
export const DEFAULT_BITRATE = 64_000;
const MAX_NAME_LENGTH = 100;
const FALLBACK_NAME = 'Sprachraum';

/** The config with defaults for missing fields (stored fields win, as before). */
export function normalizeConfig(stored: Partial<JoinToCreateConfig> | null | undefined): JoinToCreateConfig {
  const value = stored ?? {};
  return {
    enabled: value.enabled || false,
    triggerChannels: value.triggerChannels || [],
    categoryId: value.categoryId || null,
    channelNameTemplate: value.channelNameTemplate || DEFAULT_TEMPLATE,
    userLimit: value.userLimit || 0,
    bitrate: value.bitrate || DEFAULT_BITRATE,
    temporaryChannels: value.temporaryChannels || {},
    ...value,
  } as JoinToCreateConfig;
}

/** Name template, user limit and bitrate of a trigger, falling back to the guild defaults. */
export function triggerSettings(config: JoinToCreateConfig, triggerChannelId: string): JoinToCreateChannelOptions {
  const options = config.channelOptions?.[triggerChannelId] ?? {};
  return {
    nameTemplate: options.nameTemplate || config.channelNameTemplate || DEFAULT_TEMPLATE,
    userLimit: Math.max(0, Math.min(99, options.userLimit ?? config.userLimit ?? 0)),
    bitrate: Math.max(8_000, Math.min(384_000, Math.floor(Number(options.bitrate ?? config.bitrate ?? DEFAULT_BITRATE)) || DEFAULT_BITRATE)),
  };
}

const validation = (message: string, userMessage: string) => new NexoBotError(message, ErrorTypes.VALIDATION, userMessage);

const PLACEHOLDERS: Record<string, keyof ChannelNameVariables> = {
  '{username}': 'username',
  '{user_tag}': 'userTag',
  '{displayName}': 'displayName',
  '{display_name}': 'displayName',
  '{guildName}': 'guildName',
  '{guild_name}': 'guildName',
  '{channelName}': 'channelName',
  '{channel_name}': 'channelName',
};

export function validateChannelNameTemplate(template: unknown): void {
  if (!template || typeof template !== 'string') {
    throw validation('Invalid channel template', 'Die Vorlage für den Kanalnamen muss gültiger Text sein.');
  }
  const normalized = template.normalize('NFKC').replace(/[\x00-\x1F\x7F​-‍﻿]/g, '').trim();
  if (normalized.length > MAX_NAME_LENGTH) {
    throw validation('Channel template too long', `Die Vorlage für den Kanalnamen darf höchstens ${MAX_NAME_LENGTH} Zeichen lang sein.`);
  }
  if (/[@#:`]/.test(normalized)) {
    throw validation('Channel template contains forbidden characters', 'Die Kanalvorlage darf keine @, #, : oder Backticks enthalten.');
  }
  const unknown = (normalized.match(/\{[^}]+\}/g) ?? []).find((placeholder) => !(placeholder in PLACEHOLDERS));
  if (unknown) {
    throw validation('Unknown placeholder', `Unbekannter Platzhalter: ${unknown}. Erlaubte Platzhalter: ${Object.keys(PLACEHOLDERS).join(', ')}`);
  }
}

/** Bitrate in kbps. */
export function validateBitrate(kbps: number): void {
  if (!Number.isFinite(kbps)) throw validation('Bitrate must be a number', 'Bitte gib eine gültige Zahl für die Bitrate ein.');
  if (kbps < 8 || kbps > 384) throw validation('Bitrate out of range', 'Die Bitrate muss zwischen 8 und 384 kbps liegen.');
}

export function validateUserLimit(limit: number): void {
  if (!Number.isFinite(limit)) throw validation('User limit must be a number', 'Bitte gib eine gültige Zahl für das Nutzerlimit ein.');
  if (limit < 0 || limit > 99) throw validation('User limit out of range', 'Das Nutzerlimit muss zwischen 0 (kein Limit) und 99 liegen.');
}

/** Template with its placeholders filled in, as a voice channel name (letters with umlauts kept). */
export function formatChannelName(template: string, variables: ChannelNameVariables): string {
  const filled = template.replace(/\{[^}]+\}/g, (placeholder) => {
    const key = PLACEHOLDERS[placeholder];
    return key ? variables[key] : '';
  });
  const name = filled.replace(/[\x00-\x1F\x7F]/g, '').replace(/[@#:`]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH).trim();
  return name || FALLBACK_NAME;
}

/**
 * Name of a new temporary channel: the template for the member, or "<trigger name> N" for a template without a
 * member placeholder (`existing` = channels of the category already named like the trigger).
 */
export function temporaryChannelName(template: string, variables: ChannelNameVariables, existing: number): string {
  const personal = /\{(username|displayName|display_name|user_tag)\}/.test(template);
  return personal ? formatChannelName(template, variables) : formatChannelName(`${variables.channelName} ${existing + 1}`, variables);
}

/** The temporary channel the member already owns, if any. */
export function ownedTemporaryChannel(config: JoinToCreateConfig, userId: string): string | undefined {
  return Object.entries(config.temporaryChannels).find(([, info]) => info?.ownerId === userId)?.[0];
}
