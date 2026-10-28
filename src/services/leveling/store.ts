// The only place that reads or writes leveling data. Per-user records go through client.db
// (`guild:{guildId}:leveling:users:{userId}` -> user_levels, see keyParser), the settings live in the guild config,
// and ranked reads use SQL on user_levels directly. In degraded (in-memory) mode the ranked reads fall back to list + get.

import type { NexoClient } from '../../types/index.js';
import { getGuildConfig, setGuildConfig } from '../config/guildConfig.js';
import { getUserLevelKey, getUserLevelPrefix } from '../../utils/database/keys.js';
import { T, cosmeticsPool, requirePool } from '../cosmetics/db.js';
import type { GuildLevelingConfig, LevelData } from './core.js';

export interface LeaderboardRow {
  userId: string;
  xp: number;
  level: number;
  totalXp: number;
}

export async function readLevelingConfig(client: NexoClient, guildId: string): Promise<GuildLevelingConfig | undefined> {
  return (await getGuildConfig(client, guildId)).leveling as GuildLevelingConfig | undefined;
}

export async function writeLevelingConfig(client: NexoClient, guildId: string, config: GuildLevelingConfig): Promise<void> {
  const guildConfig = await getGuildConfig(client, guildId);
  guildConfig.leveling = config;
  await setGuildConfig(client, guildId, guildConfig);
}

export function readUserLevel(client: NexoClient, guildId: string, userId: string): Promise<Partial<LevelData> | null> {
  return client.db.get<Partial<LevelData>>(getUserLevelKey(guildId, userId));
}

export async function writeUserLevel(client: NexoClient, guildId: string, userId: string, data: LevelData): Promise<void> {
  await client.db.set(getUserLevelKey(guildId, userId), data);
}

export async function deleteUserLevel(client: NexoClient, guildId: string, userId: string): Promise<void> {
  await client.db.delete(getUserLevelKey(guildId, userId));
}

/** User ids with a level record in the guild (canonical and legacy key prefix). */
export async function listLevelUserIds(client: NexoClient, guildId: string): Promise<string[]> {
  if (!client.db?.list) return [];

  const prefixes = [getUserLevelPrefix(guildId), `${guildId}:leveling:users:`];
  const userIds = new Set<string>();

  for (const prefix of prefixes) {
    let keys: unknown = await client.db.list(prefix).catch((): string[] => []);
    if (!Array.isArray(keys)) {
      keys = typeof keys === 'object' && keys !== null ? Object.keys(keys) : [];
    }

    for (const key of keys as string[]) {
      if (!key.startsWith(prefix)) continue;
      const userId = key.slice(prefix.length);
      if (/^\d{17,19}$/.test(userId)) userIds.add(userId);
    }
  }

  return [...userIds];
}

// Ranking order shared by the leaderboard and single ranks: most total XP first, ties by user id.
// ponytail: ranks cover every stored row; rows of members who left while the bot was offline count until
// guildMemberRemove or the wipe removes them. Add a membership prune if stale rows show up in practice.
const RANKED = 'guild_id = $1 AND (total_xp > 0 OR level > 0)';

/** The top `limit` rows of the guild, sorted and limited in SQL. */
export async function readLeaderboard(client: NexoClient, guildId: string, limit: number): Promise<LeaderboardRow[]> {
  const pool = cosmeticsPool();
  if (!pool) return (await readAllRanked(client, guildId)).slice(0, limit);
  const result = await pool.query<{ user_id: string; xp: string; level: number; total_xp: string }>(
    `SELECT user_id, xp, level, total_xp FROM ${T.user_levels} WHERE ${RANKED} ORDER BY total_xp DESC, user_id LIMIT $2`,
    [guildId, limit],
  );
  return result.rows.map((row) => ({ userId: row.user_id, xp: Number(row.xp), level: row.level, totalXp: Number(row.total_xp) }));
}

/** 1-based position of the member in the leaderboard order, or null without XP. */
export async function readRank(client: NexoClient, guildId: string, userId: string): Promise<number | null> {
  const pool = cosmeticsPool();
  if (!pool) {
    const index = (await readAllRanked(client, guildId)).findIndex((row) => row.userId === userId);
    return index === -1 ? null : index + 1;
  }
  const result = await pool.query<{ rank: string }>(
    `SELECT (SELECT COUNT(*) + 1 FROM ${T.user_levels} o
       WHERE o.guild_id = $1 AND (o.total_xp > 0 OR o.level > 0)
         AND (o.total_xp > u.total_xp OR (o.total_xp = u.total_xp AND o.user_id < u.user_id))) AS rank
     FROM ${T.user_levels} u WHERE u.guild_id = $1 AND u.user_id = $2 AND (u.total_xp > 0 OR u.level > 0)`,
    [guildId, userId],
  );
  return result.rows[0] ? Number(result.rows[0].rank) : null;
}

// Degraded mode only: one get per stored key, fine for the in-memory store.
async function readAllRanked(client: NexoClient, guildId: string): Promise<LeaderboardRow[]> {
  const rows = await Promise.all((await listLevelUserIds(client, guildId)).map(async (userId) => {
    const data = await readUserLevel(client, guildId, userId);
    return { userId, xp: Number(data?.xp) || 0, level: Number(data?.level) || 0, totalXp: Number(data?.totalXp) || 0 };
  }));
  return rows
    .filter((row) => row.totalXp > 0 || row.level > 0)
    .sort((a, b) => b.totalXp - a.totalXp || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));
}

/** The member's levels on every server (dashboard "Me" page), with their rank there. */
export async function readMemberLevels(userId: string): Promise<{ guildId: string; level: number; xp: number; rank: number }[]> {
  const result = await requirePool().query<{ guild_id: string; level: number; xp: string; rank: string }>(
    `SELECT u.guild_id, u.level, u.xp,
       (SELECT COUNT(*) + 1 FROM ${T.user_levels} o WHERE o.guild_id = u.guild_id AND o.total_xp > u.total_xp) AS rank
     FROM ${T.user_levels} u WHERE u.user_id = $1 ORDER BY u.level DESC, u.total_xp DESC LIMIT 50`,
    [userId],
  );
  return result.rows.map((row) => ({ guildId: row.guild_id, level: row.level, xp: Number(row.xp), rank: Number(row.rank) }));
}

/** Guilds where the member has a level record. */
export async function readMemberGuildIds(userId: string): Promise<string[]> {
  const result = await requirePool().query<{ guild_id: string }>(`SELECT guild_id FROM ${T.user_levels} WHERE user_id = $1`, [userId]);
  return result.rows.map((row) => row.guild_id);
}
