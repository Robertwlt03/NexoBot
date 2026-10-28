// The only place that reads or writes giveaways. Each giveaway is one row of the giveaways table (guild_id,
// message_id unique); reads of a guild go through client.db (`guild:{guildId}:giveaways`, see keyParser), writes
// touch one row in SQL because a client.db set rewrites every giveaway of the guild. In degraded (in-memory) mode
// writes rewrite the guild's map and the due check scans the stored keys.

import type { NexoClient } from '../../types/index.js';
import { T, cosmeticsPool } from '../cosmetics/db.js';
import { toGiveawayList } from './core.js';
import type { Giveaway } from './core.js';

const guildKey = (guildId: string) => `guild:${guildId}:giveaways`;

export async function readGiveaways(client: NexoClient, guildId: string): Promise<Giveaway[]> {
  return toGiveawayList(await client.db.get(guildKey(guildId), {}));
}

export async function readGiveaway(client: NexoClient, guildId: string, messageId: string): Promise<Giveaway | null> {
  const pool = cosmeticsPool();
  if (!pool) return (await readGiveaways(client, guildId)).find((giveaway) => giveaway.messageId === messageId) ?? null;
  const result = await pool.query<{ data: Giveaway }>(`SELECT data FROM ${T.giveaways} WHERE guild_id = $1 AND message_id = $2`, [guildId, messageId]);
  return result.rows[0]?.data ?? null;
}

async function rewriteGuild(client: NexoClient, guildId: string, change: (map: Record<string, Giveaway>) => void): Promise<void> {
  const map = Object.fromEntries((await readGiveaways(client, guildId)).map((giveaway) => [giveaway.messageId, giveaway]));
  change(map);
  await client.db.set(guildKey(guildId), map);
}

export async function writeGiveaway(client: NexoClient, guildId: string, giveaway: Giveaway): Promise<void> {
  const pool = cosmeticsPool();
  if (!pool) {
    await rewriteGuild(client, guildId, (map) => { map[giveaway.messageId] = giveaway; });
    return;
  }
  const endsAt = giveaway.endsAt ? new Date(giveaway.endsAt) : null;
  await pool.query(
    `WITH g AS (INSERT INTO ${T.guilds} (id) VALUES ($1) ON CONFLICT (id) DO NOTHING)
     INSERT INTO ${T.giveaways} (guild_id, message_id, data, ends_at) VALUES ($1, $2, $3, $4)
     ON CONFLICT (guild_id, message_id) DO UPDATE SET data = EXCLUDED.data, ends_at = EXCLUDED.ends_at`,
    [guildId, giveaway.messageId, giveaway, endsAt],
  );
}

/** False when there was no such giveaway. */
export async function deleteGiveaway(client: NexoClient, guildId: string, messageId: string): Promise<boolean> {
  const pool = cosmeticsPool();
  if (!pool) {
    let found = false;
    await rewriteGuild(client, guildId, (map) => { found = messageId in map; delete map[messageId]; });
    return found;
  }
  const result = await pool.query(`DELETE FROM ${T.giveaways} WHERE guild_id = $1 AND message_id = $2`, [guildId, messageId]);
  return (result.rowCount ?? 0) > 0;
}

/** Giveaways of every guild that are past their end time but not ended yet, oldest first (`now` in degraded mode). */
export async function readDueGiveaways(client: NexoClient, now: Date): Promise<{ guildId: string; giveaway: Giveaway }[]> {
  const pool = cosmeticsPool();
  if (pool) {
    const result = await pool.query<{ guild_id: string; data: Giveaway }>(
      `SELECT guild_id, data FROM ${T.giveaways}
       WHERE ends_at <= NOW() AND COALESCE((data->>'ended')::boolean, false) = false
       ORDER BY ends_at ASC`,
    );
    return result.rows.map((row) => ({ guildId: row.guild_id, giveaway: row.data }));
  }

  // Degraded mode only: one read per guild key, fine for the in-memory store.
  const due: { guildId: string; giveaway: Giveaway; endsAt: number }[] = [];
  for (const key of await client.db.list('guild:')) {
    const guildId = key.split(':')[1];
    if (!key.endsWith(':giveaways') || !guildId || key !== guildKey(guildId)) continue;
    for (const giveaway of toGiveawayList(await client.db.get(key, {}))) {
      const endsAt = Number(giveaway.endsAt ?? giveaway.endTime);
      if (giveaway.ended || giveaway.isEnded || !endsAt || now.getTime() < endsAt) continue;
      due.push({ guildId, giveaway, endsAt });
    }
  }
  return due.sort((a, b) => a.endsAt - b.endsAt).map(({ guildId, giveaway }) => ({ guildId, giveaway }));
}
