// The only place that reads or writes birthday data. The guild's birthdays live in the `birthdays` table, read
// through client.db (`guild:{guildId}:birthdays`, see keyParser). Writes touch single rows in SQL, because a client.db
// set rewrites the whole guild (delete all, insert one by one). In degraded (in-memory) mode writes rewrite the map.

import type { NexoClient } from '../../types/index.js';
import { getGuildConfig, updateGuildConfig } from '../config/guildConfig.js';
import { getBirthdayTrackingKey, getGuildBirthdaysKey } from '../../utils/database/keys.js';
import { unwrapReplitData } from '../../utils/database/guildConfigStorage.js';
import { T, cosmeticsPool } from '../cosmetics/db.js';
import type { BirthdayEntry } from './core.js';

type BirthdayMap = Record<string, BirthdayEntry>;

const leftKey = (guildId: string) => `guild:${guildId}:birthdays:left`;

export async function readBirthdays(client: NexoClient, guildId: string): Promise<BirthdayMap> {
  return unwrapReplitData(await client.db.get<BirthdayMap>(getGuildBirthdaysKey(guildId), {})) || {};
}

export async function writeBirthday(client: NexoClient, guildId: string, userId: string, { month, day }: BirthdayEntry): Promise<void> {
  const pool = cosmeticsPool();
  if (!pool) {
    const birthdays = await readBirthdays(client, guildId);
    birthdays[userId] = { month, day };
    await client.db.set(getGuildBirthdaysKey(guildId), birthdays);
    return;
  }
  await pool.query(
    `WITH g AS (INSERT INTO ${T.guilds} (id) VALUES ($1) ON CONFLICT (id) DO NOTHING),
          u AS (INSERT INTO ${T.users} (id) VALUES ($2) ON CONFLICT (id) DO NOTHING)
     INSERT INTO ${T.birthdays} (guild_id, user_id, month, day) VALUES ($1, $2, $3, $4)
     ON CONFLICT (guild_id, user_id) DO UPDATE SET month = EXCLUDED.month, day = EXCLUDED.day`,
    [guildId, userId, month, day],
  );
}

export async function deleteBirthdays(client: NexoClient, guildId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const pool = cosmeticsPool();
  if (!pool) {
    const birthdays = await readBirthdays(client, guildId);
    for (const userId of userIds) delete birthdays[userId];
    await client.db.set(getGuildBirthdaysKey(guildId), birthdays);
    return;
  }
  await pool.query(`DELETE FROM ${T.birthdays} WHERE guild_id = $1 AND user_id = ANY($2)`, [guildId, userIds]);
}

/** Members who got the birthday role at the last check (removed again at the next one). */
export async function readRoleTracking(client: NexoClient, guildId: string): Promise<Record<string, boolean>> {
  return (await client.db.get<Record<string, boolean>>(getBirthdayTrackingKey(guildId))) || {};
}

export async function writeRoleTracking(client: NexoClient, guildId: string, tracking: Record<string, boolean>): Promise<void> {
  await client.db.set(getBirthdayTrackingKey(guildId), tracking);
}

/** Birthdays of members who left, restored when they join again. */
export async function readLeftBirthdays(client: NexoClient, guildId: string): Promise<BirthdayMap> {
  return (await client.db.get<BirthdayMap>(leftKey(guildId))) || {};
}

export async function writeLeftBirthdays(client: NexoClient, guildId: string, birthdays: BirthdayMap): Promise<void> {
  await client.db.set(leftKey(guildId), birthdays);
}

export async function readBirthdaySettings(client: NexoClient, guildId: string): Promise<{ channelId: string | null; roleId: string | null }> {
  const config = await getGuildConfig(client, guildId);
  return { channelId: config.birthdayChannelId ?? null, roleId: config.birthdayRoleId ?? null };
}

export async function writeBirthdaySettings(client: NexoClient, guildId: string, settings: { channelId?: string | null; roleId?: string | null }): Promise<void> {
  const patch: Record<string, string | null> = {};
  if (settings.channelId !== undefined) patch.birthdayChannelId = settings.channelId;
  if (settings.roleId !== undefined) patch.birthdayRoleId = settings.roleId;
  await updateGuildConfig(client, guildId, patch);
}
