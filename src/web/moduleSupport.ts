// Helpers for dashboard modules that call bot services (giveaways, birthdays, join-to-create, server stats, music).

import { PermissionFlagsBits } from 'discord.js';
import type { Guild, GuildBasedChannel, GuildMember } from 'discord.js';
import type { NexoClient } from '../types/index.js';
import { badRequest } from './http.js';
import { isSnowflake } from '../utils/validation.js';

/** The member behind a user id from the request; German 400 when the id is invalid or not on this server. */
export async function fetchMember(guild: Guild, value: unknown): Promise<GuildMember> {
  const id = typeof value === 'string' ? value.trim() : value;
  if (!isSnowflake(id)) throw badRequest('Bitte gib eine gültige Nutzer-ID ein.');
  const member = await guild.members.fetch(id).catch(() => null);
  if (!member) throw badRequest('Der angegebene Nutzer ist nicht auf diesem Server.');
  return member;
}

/** Display names for user ids: member/user cache first, then at most `maxFetches` API lookups; falls back to the id. */
export async function resolveNames(client: NexoClient, guild: Guild, ids: string[], maxFetches = 25): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  const missing: string[] = [];
  for (const id of new Set(ids)) {
    const member = guild.members.cache.get(id);
    const user = member?.user ?? client.users.cache.get(id);
    if (member) names[id] = member.displayName;
    else if (user) names[id] = user.globalName ?? user.username;
    else missing.push(id);
  }
  await Promise.all(missing.map(async (id, index) => {
    const user = index < maxFetches ? await client.users.fetch(id).catch(() => null) : null;
    names[id] = user ? user.globalName ?? user.username : id;
  }));
  return names;
}

const PERMISSION_LABELS: [bigint, string][] = [
  [PermissionFlagsBits.ViewChannel, 'Kanal ansehen'],
  [PermissionFlagsBits.SendMessages, 'Nachrichten senden'],
  [PermissionFlagsBits.EmbedLinks, 'Links einbetten'],
  [PermissionFlagsBits.ReadMessageHistory, 'Nachrichtenverlauf lesen'],
  [PermissionFlagsBits.ManageMessages, 'Nachrichten verwalten'],
  [PermissionFlagsBits.ManageChannels, 'Kanäle verwalten'],
];

/** Throws a German 400 when Nexo lacks one of the permissions (in the channel, or server-wide without a channel). */
export function requireBotPermissions(guild: Guild, permissions: bigint[], channel?: GuildBasedChannel | null): void {
  const me = guild.members.me;
  const granted = channel && me ? channel.permissionsFor(me) : me?.permissions;
  const missing = PERMISSION_LABELS.filter(([flag]) => permissions.includes(flag) && !granted?.has(flag)).map(([, label]) => `„${label}“`);
  if (missing.length) {
    throw badRequest(`Nexo fehlt die Berechtigung ${missing.join(', ')}${channel ? ` in #${channel.name}` : ''}.`);
  }
}
