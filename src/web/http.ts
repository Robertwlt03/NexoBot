// Input validation for dashboard API handlers. Throwing HttpError makes the router answer with that status and message.

import { ChannelType, PermissionFlagsBits } from 'discord.js';
import type { Guild } from 'discord.js';

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export const badRequest = (message: string) => new HttpError(400, message);

/** Request body as a plain object (express.json() already parsed it). */
export function body(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw badRequest('Ungültige Daten.');
  }
  return value as Record<string, unknown>;
}

export function bool(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw badRequest(`${field}: Ja/Nein erwartet.`);
  return value;
}

export function str(value: unknown, field: string, { max, min = 0, trim = true }: { max: number; min?: number; trim?: boolean }): string {
  if (typeof value !== 'string') throw badRequest(`${field}: Text erwartet.`);
  const text = trim ? value.trim() : value;
  if (text.length < min) throw badRequest(min === 1 ? `${field} darf nicht leer sein.` : `${field}: mindestens ${min} Zeichen.`);
  if (text.length > max) throw badRequest(`${field}: höchstens ${max} Zeichen.`);
  return text;
}

export function optionalStr(value: unknown, field: string, max: number): string | null {
  if (value === null || value === undefined || value === '') return null;
  return str(value, field, { max });
}

export function int(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw badRequest(`${field}: ganze Zahl zwischen ${min} und ${max} erwartet.`);
  }
  return value;
}

export function url(value: unknown, field: string): string | null {
  const text = optionalStr(value, field, 2000);
  if (text === null) return null;
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('protocol');
  } catch {
    throw badRequest(`${field}: gültige http(s)-Adresse erwartet.`);
  }
  return text;
}

const TEXT_TYPES: ChannelType[] = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

/**
 * Channels Nexo may not view arrive obfuscated since Discord's 2026 privacy change: name "___hidden___" and the
 * CHANNEL_OBFUSCATED flag (1 << 17). They are left out of every picker and rejected as targets.
 */
export function isHiddenChannel(found: { name?: string | null; flags?: { bitfield: number } | null }): boolean {
  return found.name === '___hidden___' || ((found.flags?.bitfield ?? 0) & (1 << 17)) !== 0;
}

/** A channel id of this guild of the given kind, or null when empty. */
export function channel(guild: Guild, value: unknown, field: string, kind: 'text' | 'voice' | 'category' = 'text'): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw badRequest(`${field}: Kanal erwartet.`);
  const found = guild.channels.cache.get(value);
  const types = kind === 'text' ? TEXT_TYPES : kind === 'voice' ? [ChannelType.GuildVoice, ChannelType.GuildStageVoice] : [ChannelType.GuildCategory];
  if (!found || !types.includes(found.type) || isHiddenChannel(found)) throw badRequest(`${field}: Kanal nicht gefunden.`);
  return value;
}

/** A role id of this guild, or null when empty. `assignable` also requires Nexo to be able to give it out. */
export function role(guild: Guild, value: unknown, field: string, { assignable = false } = {}): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw badRequest(`${field}: Rolle erwartet.`);
  const found = guild.roles.cache.get(value);
  if (!found || found.id === guild.id) throw badRequest(`${field}: Rolle nicht gefunden.`);
  if (assignable) {
    const me = guild.members.me;
    if (found.managed || !me || found.position >= me.roles.highest.position) {
      throw badRequest(`${field}: Nexo kann die Rolle @${found.name} nicht vergeben. Zieh die Nexo-Rolle in den Servereinstellungen darüber.`);
    }
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      throw badRequest('Nexo braucht die Berechtigung „Rollen verwalten“.');
    }
  }
  return value;
}

export function idList(guild: Guild, value: unknown, field: string, kind: 'role' | 'channel', max = 50): string[] {
  if (!Array.isArray(value)) throw badRequest(`${field}: Liste erwartet.`);
  if (value.length > max) throw badRequest(`${field}: höchstens ${max} Einträge.`);
  return [...new Set(value.map((entry) => (kind === 'role'
    ? role(guild, entry, field)
    : guild.channels.cache.get(String(entry)) && !isHiddenChannel(guild.channels.cache.get(String(entry))!) ? String(entry) : null)).filter((id): id is string => id !== null))];
}

export function hexColor(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw badRequest(`${field}: Farbe im Format #RRGGBB erwartet.`);
  return value.toUpperCase();
}
