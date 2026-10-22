// Monthly rankings per server: mini-game points and XP gained per Berlin month (monthly_scores). On the 1st at 00:05
// the previous month is paid out once (monthly_payouts makes it idempotent; the whole run is one transaction).

import type { Client, Guild } from 'discord.js';
import { CURRENCY, RANKING_KINDS, RANKING_LABELS, type RankingKind } from '../../shared/cosmetics.js';
import { formatCoins } from '../../shared/coins.js';
import type { GuildRanking, RankingEntry, RankingsResponse } from '../../web/dto/profile.js';
import { logger } from '../../utils/logger.js';
import { RANKING_ITEMS } from './catalog.js';
import { getEconomyConfig } from './config.js';
import { T, cosmeticsPool, requirePool, withTx, type Queryable } from './db.js';
import { monthEnd, monthStartOf } from './time.js';
import { earnTx } from './wallet.js';
import { syncAchievements } from './achievements.js';

// ---------- Recording ----------

async function bumpScore(guildId: string, userId: string, column: 'minigame_points' | 'xp_gained', amount: number): Promise<void> {
  const pool = cosmeticsPool();
  if (!pool || amount <= 0) return;
  await pool.query(
    `INSERT INTO ${T.monthly_scores} AS s (guild_id, user_id, month, ${column}) VALUES ($1, $2, $3::date, $4)
     ON CONFLICT (guild_id, user_id, month) DO UPDATE SET ${column} = s.${column} + EXCLUDED.${column}`,
    [guildId, userId, monthStartOf(), amount],
  );
}

export const recordMinigamePoints = (guildId: string, userId: string, points = 1) => bumpScore(guildId, userId, 'minigame_points', points);
export const recordXpGain = (guildId: string, userId: string, xp: number) => bumpScore(guildId, userId, 'xp_gained', Math.floor(xp));

// ---------- Ranking reads ----------

export interface Placement { guildId: string; kind: RankingKind; userId: string; rank: number; points: number }

/** Top `limit` per guild and kind (ties: lower user id first), plus `userId`'s own row. */
async function placements(client: Queryable, month: string, guildIds: string[], limit: number, userId: string | null): Promise<Placement[]> {
  if (guildIds.length === 0) return [];
  const result = await client.query<{ guild_id: string; user_id: string; kind: RankingKind; points: string; rank: string }>(
    `WITH s AS (
       SELECT guild_id, user_id, 'minigames' AS kind, minigame_points::bigint AS points FROM ${T.monthly_scores}
       WHERE month = $1::date AND guild_id = ANY($2::text[]) AND minigame_points > 0
       UNION ALL
       SELECT guild_id, user_id, 'activity' AS kind, xp_gained AS points FROM ${T.monthly_scores}
       WHERE month = $1::date AND guild_id = ANY($2::text[]) AND xp_gained > 0
     ), r AS (
       SELECT *, ROW_NUMBER() OVER (PARTITION BY guild_id, kind ORDER BY points DESC, user_id) AS rank FROM s
     )
     SELECT guild_id, user_id, kind, points, rank FROM r WHERE rank <= $3 OR user_id = $4`,
    [month, guildIds, limit, userId],
  );
  return result.rows.map((row) => ({ guildId: row.guild_id, userId: row.user_id, kind: row.kind, points: Number(row.points), rank: Number(row.rank) }));
}

/** Humans on a guild from the member cache (exact numbers are fetched for the payout). */
const approxHumans = (guild: Guild) => guild.memberCount - guild.members.cache.filter((member) => member.user.bot).size;

export async function userRankings(client: Client, userId: string, guildIds: string[]): Promise<RankingsResponse> {
  const config = await getEconomyConfig();
  const guilds = guildIds.map((id) => client.guilds.cache.get(id)).filter((guild): guild is Guild => Boolean(guild)).slice(0, 25);
  const month = monthStartOf();
  const pool = requirePool();
  const top = config.monthlyRewards.length;
  const rows = await placements(pool, month, guilds.map((guild) => guild.id), Math.max(5, top), userId);

  // Names: member/user cache first, then at most 25 API lookups per request.
  const names = new Map<string, { name: string; avatarUrl: string | null }>();
  const missing: string[] = [];
  for (const row of rows) {
    if (names.has(row.userId)) continue;
    const member = client.guilds.cache.get(row.guildId)?.members.cache.get(row.userId);
    const user = member?.user ?? client.users.cache.get(row.userId);
    if (user) names.set(row.userId, { name: member?.displayName ?? user.displayName, avatarUrl: (member ?? user).displayAvatarURL({ size: 64 }) });
    else if (!missing.includes(row.userId)) missing.push(row.userId);
  }
  await Promise.all(missing.slice(0, 25).map(async (id) => {
    const user = await client.users.fetch(id).catch(() => null);
    if (user) names.set(id, { name: user.displayName, avatarUrl: user.displayAvatarURL({ size: 64 }) });
  }));

  const rankings: GuildRanking[] = guilds.flatMap((guild) => RANKING_KINDS.map((kind) => {
    const list = rows.filter((row) => row.guildId === guild.id && row.kind === kind);
    const mine = list.find((row) => row.userId === userId);
    const topEntries: RankingEntry[] = list.filter((row) => row.rank <= Math.max(5, top)).sort((a, b) => a.rank - b.rank).map((row) => ({
      rank: row.rank, userId: row.userId, points: row.points,
      name: names.get(row.userId)?.name ?? 'Unbekannt', avatarUrl: names.get(row.userId)?.avatarUrl ?? null,
    }));
    return {
      guildId: guild.id, guildName: guild.name, guildIconUrl: guild.iconURL({ size: 64 }), kind,
      month: month.slice(0, 7), endsAt: monthEnd(month).toISOString(),
      eligible: approxHumans(guild) >= config.monthlyMinHumans,
      me: { rank: mine?.rank ?? null, points: mine?.points ?? 0 },
      top: topEntries, rewards: config.monthlyRewards,
    };
  }));

  const payouts = await pool.query<{ amount: string; meta: { month?: string; kind?: RankingKind; rank?: number; guildName?: string } | null }>(
    `SELECT amount, meta FROM ${T.wallet_transactions} WHERE user_id = $1 AND reason = 'monthly_ranking' ORDER BY created_at DESC, id DESC LIMIT 10`,
    [userId],
  );
  return {
    rankings,
    lastPayouts: payouts.rows.map((row) => ({
      month: row.meta?.month ?? '', guildName: row.meta?.guildName ?? 'Unbekannter Server',
      kind: row.meta?.kind ?? 'minigames', rank: row.meta?.rank ?? 0, amount: Number(row.amount),
    })),
  };
}

// ---------- Payout ----------

export interface Payout extends Placement { amount: number }

/** Rewards per place; each user is paid from at most `maxServers` servers per month (best ranks first). */
export function selectPayouts(list: Placement[], rewards: readonly number[], maxServers: number): Payout[] {
  const ordered = [...list].sort((a, b) => a.rank - b.rank || b.points - a.points || a.guildId.localeCompare(b.guildId) || a.kind.localeCompare(b.kind));
  const servers = new Map<string, Set<string>>();
  const result: Payout[] = [];
  for (const placement of ordered) {
    const amount = rewards[placement.rank - 1] ?? 0;
    if (amount <= 0) continue;
    const paid = servers.get(placement.userId) ?? new Set<string>();
    if (!paid.has(placement.guildId) && paid.size >= maxServers) continue;
    paid.add(placement.guildId);
    servers.set(placement.userId, paid);
    result.push({ ...placement, amount });
  }
  return result;
}

async function exactHumans(guild: Guild): Promise<number> {
  const members = await guild.members.fetch().catch(() => null);
  return members ? members.filter((member) => !member.user.bot).size : approxHumans(guild);
}

const monthLabel = (month: string) => new Date(`${month}T12:00:00Z`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Pays out `month` (default: the previous Berlin month). Safe to run repeatedly. */
export async function runMonthlyPayout(client: Client, month: string = monthStartOf(new Date(), -1)): Promise<{ payouts: Payout[]; guilds: number }> {
  if (!cosmeticsPool()) return { payouts: [], guilds: 0 };
  const config = await getEconomyConfig();
  const pool = requirePool();
  const [candidates, done] = await Promise.all([
    pool.query<{ guild_id: string }>(`SELECT DISTINCT guild_id FROM ${T.monthly_scores} WHERE month = $1::date`, [month]),
    pool.query<{ guild_id: string; kind: string }>(`SELECT guild_id, kind FROM ${T.monthly_payouts} WHERE month = $1::date`, [month]),
  ]);
  const doneKeys = new Set(done.rows.map((row) => `${row.guild_id}|${row.kind}`));
  const open: { guild: Guild; kind: RankingKind; eligible: boolean }[] = [];
  for (const { guild_id: guildId } of candidates.rows) {
    const guild = client.guilds.cache.get(guildId);
    const kinds = RANKING_KINDS.filter((kind) => !doneKeys.has(`${guildId}|${kind}`));
    if (!guild || kinds.length === 0) continue;
    const eligible = await exactHumans(guild) >= config.monthlyMinHumans;
    for (const kind of kinds) open.push({ guild, kind, eligible });
  }
  if (open.length === 0) return { payouts: [], guilds: 0 };

  const eligibleGuilds = [...new Set(open.filter((entry) => entry.eligible).map((entry) => entry.guild.id))];
  const openKeys = new Set(open.filter((entry) => entry.eligible).map((entry) => `${entry.guild.id}|${entry.kind}`));
  const list = (await placements(pool, month, eligibleGuilds, config.monthlyRewards.length, null))
    .filter((row) => openKeys.has(`${row.guildId}|${row.kind}`));
  // One transaction for the whole month: a crashed run pays nothing, so the max-servers rule always sees every placement.
  const selected = selectPayouts(list, config.monthlyRewards, config.monthlyMaxServers);

  const paid = await withTx(async (tx) => {
    const claimed = new Set<string>();
    for (const entry of open) {
      const result = await tx.query(
        `INSERT INTO ${T.monthly_payouts} (guild_id, month, kind) VALUES ($1, $2::date, $3) ON CONFLICT DO NOTHING`,
        [entry.guild.id, month, entry.kind],
      );
      if (result.rowCount) claimed.add(`${entry.guild.id}|${entry.kind}`);
    }
    const payouts = selected.filter((payout) => claimed.has(`${payout.guildId}|${payout.kind}`)).sort((a, b) => a.userId.localeCompare(b.userId));
    for (const payout of payouts) {
      const guildName = client.guilds.cache.get(payout.guildId)?.name ?? 'Unbekannter Server';
      await earnTx(tx, payout.userId, payout.amount, 'monthly_ranking',
        `Monatsranking ${RANKING_LABELS[payout.kind]}: Platz ${payout.rank} auf ${guildName}`, payout.guildId,
        { meta: { month: month.slice(0, 7), kind: payout.kind, rank: payout.rank, guildName } }, config);
      const items = payout.rank === 1 ? [RANKING_ITEMS.winnerBadge, RANKING_ITEMS.winnerTitle, RANKING_ITEMS.podiumBadge] : payout.rank <= 3 ? [RANKING_ITEMS.podiumBadge] : [];
      for (const itemId of items) {
        await tx.query(`INSERT INTO ${T.user_inventory} (user_id, item_id, source) VALUES ($1, $2, 'ranking') ON CONFLICT DO NOTHING`, [payout.userId, itemId]);
      }
    }
    return payouts;
  });

  const byUser = new Map<string, Payout[]>();
  for (const payout of paid) byUser.set(payout.userId, [...(byUser.get(payout.userId) ?? []), payout]);
  for (const [userId, payouts] of byUser) {
    await syncAchievements(userId);
    const lines = payouts.map((payout) => `• Platz ${payout.rank} in „${RANKING_LABELS[payout.kind]}“ auf **${client.guilds.cache.get(payout.guildId)?.name ?? 'einem Server'}**: +${formatCoins(payout.amount)}`);
    await client.users.send(userId, `🏆 Glückwunsch zu deinem Monatsranking (${monthLabel(month)})!\n${lines.join('\n')}\nDie ${CURRENCY.name} liegen schon in deinem Profil.`)
      .catch(() => undefined);
  }
  logger.info(`Monatsranking ${month}: ${paid.length} Auszahlungen auf ${new Set(open.map((entry) => entry.guild.id)).size} Servern.`);
  return { payouts: paid, guilds: new Set(open.map((entry) => entry.guild.id)).size };
}
