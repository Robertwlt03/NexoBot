// Season path (one season per Berlin month): points in user_stats `s:<YYYY-MM>:points`, the highest tier paid in
// `s:<YYYY-MM>:tier`. Reaching a tier pays it at once (Bernis, and the season's badge and title, created in
// shop_items on first use with availability 'season').

import { SEASON_TIERS, seasonItems, seasonTier } from '../../shared/season.js';
import type { SeasonResponse } from '../../web/dto/profile.js';
import { logger } from '../../utils/logger.js';
import { invalidateCatalog } from './catalog.js';
import { T, cosmeticsPool, requirePool, withTx, type Queryable } from './db.js';
import { monthEnd, monthStartOf } from './time.js';
import { earnTx } from './wallet.js';

export const currentSeason = (date = new Date()) => monthStartOf(date).slice(0, 7);
const pointsStat = (season: string) => `s:${season}:points`;
const tierStat = (season: string) => `s:${season}:tier`;

const ensured = new Set<string>();

/** Creates the season's badge and title in the catalog (once per season and process). */
export async function ensureSeasonItems(season = currentSeason(), client: Queryable = requirePool()): Promise<void> {
  if (ensured.has(season)) return;
  const { badge, title } = seasonItems(season);
  const result = await client.query(
    `INSERT INTO ${T.shop_items} (id, slot, rarity, price, availability, event_id, achievement_id, active, name, description, data)
     VALUES ($1, 'badge', 'epic', 0, 'season', NULL, NULL, TRUE, $2, $3, $4::jsonb), ($5, 'title', 'legendary', 0, 'season', NULL, NULL, TRUE, $6, $7, $8::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [badge.id, badge.name, badge.description, JSON.stringify(badge.data), title.id, title.name, title.description, JSON.stringify(title.data)],
  );
  if (result.rowCount) invalidateCatalog();
  ensured.add(season);
}

/** Adds season points and pays every tier reached on the way. Never throws (called from reward hooks). */
export async function addSeasonPoints(userId: string, points: number): Promise<void> {
  if (!cosmeticsPool() || points <= 0) return;
  const season = currentSeason();
  try {
    await ensureSeasonItems(season);
    await withTx(async (client) => {
      const total = await client.query<{ value: string }>(
        `INSERT INTO ${T.user_stats} AS s (user_id, stat, value) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, stat) DO UPDATE SET value = s.value + EXCLUDED.value RETURNING value`,
        [userId, pointsStat(season), points],
      );
      const reached = seasonTier(Number(total.rows[0].value));
      const paid = await client.query<{ value: string }>(`SELECT value FROM ${T.user_stats} WHERE user_id = $1 AND stat = $2 FOR UPDATE`, [userId, tierStat(season)]);
      const paidTier = Number(paid.rows[0]?.value ?? 0);
      if (reached <= paidTier) return;
      const items = seasonItems(season);
      for (let tier = paidTier + 1; tier <= reached; tier += 1) {
        const def = SEASON_TIERS[tier - 1];
        await earnTx(client, userId, def.bernis, 'season', `Saison ${items.name}: Stufe ${tier}`, null);
        if (def.item) {
          await client.query(
            `INSERT INTO ${T.user_inventory} (user_id, item_id, source) VALUES ($1, $2, 'season') ON CONFLICT DO NOTHING`,
            [userId, def.item === 'badge' ? items.badge.id : items.title.id],
          );
        }
      }
      await client.query(
        `INSERT INTO ${T.user_stats} (user_id, stat, value) VALUES ($1, $2, $3) ON CONFLICT (user_id, stat) DO UPDATE SET value = EXCLUDED.value`,
        [userId, tierStat(season), reached],
      );
    });
  } catch (error) {
    logger.warn('Saisonpunkte konnten nicht gutgeschrieben werden:', (error as Error).message);
  }
}

export async function getSeason(userId: string, now = new Date()): Promise<SeasonResponse> {
  const season = currentSeason(now);
  await ensureSeasonItems(season);
  const result = await requirePool().query<{ value: string }>(`SELECT value FROM ${T.user_stats} WHERE user_id = $1 AND stat = $2`, [userId, pointsStat(season)]);
  const points = Number(result.rows[0]?.value ?? 0);
  const items = seasonItems(season);
  return {
    season,
    name: items.name,
    endsAt: monthEnd(`${season}-01`).toISOString(),
    points,
    tier: seasonTier(points),
    tiers: SEASON_TIERS.map((tier) => ({ ...tier, itemId: tier.item === 'badge' ? items.badge.id : tier.item === 'title' ? items.title.id : null })),
  };
}
