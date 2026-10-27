// Achievements: derived from stored data (levels, wallet, inventory, transactions, monthly scores), so a sync can
// always catch up. Each unlock pays Bernis once (not capped) and grants its badge item `ach-<id>`.

import type { Achievement } from '../../web/dto/profile.js';
import { logger } from '../../utils/logger.js';
import { ACHIEVEMENT_BADGES, type AchievementStat } from './catalog.js';
import { ACTIVITY_COUNTERS, CHAT_STATS, GAME_IDS } from './activity.js';
import { normalizeSettings } from './profile.js';
import { COSMETIC_SLOTS } from '../../shared/cosmetics.js';
import { T, cosmeticsPool, requirePool, withTx } from './db.js';
import { earnTx } from './wallet.js';
import { getPetOverview } from './pets.js';

export type AchievementStats = Record<AchievementStat, number>;

interface AchievementDef { id: string; reward: number; stat: AchievementStat; target: number; showProgress: boolean }

export const ACHIEVEMENTS: AchievementDef[] = ACHIEVEMENT_BADGES.map((entry) => ({
  id: entry.achievementId, reward: entry.reward, stat: entry.stat, target: entry.target, showProgress: entry.target > 1,
}));

const nameOf = (id: string) => ACHIEVEMENT_BADGES.find((entry) => entry.achievementId === id);

export function metAchievements(stats: AchievementStats, unlocked: Set<string>): AchievementDef[] {
  return ACHIEVEMENTS.filter((def) => !unlocked.has(def.id) && stats[def.stat] >= def.target);
}

const DERIVED_SQL = `SELECT
  (SELECT MAX(level) FROM ${T.user_levels} WHERE user_id = $1) AS "maxLevel",
  (SELECT COUNT(*) FROM ${T.user_levels} WHERE user_id = $1) AS servers,
  (SELECT COUNT(*) FROM ${T.user_levels} WHERE user_id = $1 AND level >= 10) AS servers10,
  (SELECT SUM(minigame_points) FROM ${T.monthly_scores} WHERE user_id = $1) AS wins,
  (SELECT COUNT(*) FROM ${T.user_inventory} WHERE user_id = $1 AND source <> 'achievement') AS items,
  (SELECT COUNT(*) FROM ${T.user_inventory} WHERE user_id = $1 AND source = 'gift') AS "giftsReceived",
  (SELECT COUNT(*) FROM ${T.user_inventory} v JOIN ${T.shop_items} i ON i.id = v.item_id WHERE v.user_id = $1 AND i.availability = 'event') AS "eventItems",
  (SELECT daily_streak FROM ${T.user_wallets} WHERE user_id = $1) AS streak,
  (SELECT lifetime_earned FROM ${T.user_wallets} WHERE user_id = $1) AS lifetime,
  (SELECT COUNT(*) FROM ${T.wallet_transactions} WHERE user_id = $1 AND reason IN ('purchase', 'gift_sent')) AS purchases,
  (SELECT COALESCE(SUM(ABS(amount)), 0) FROM ${T.wallet_transactions} WHERE user_id = $1 AND reason IN ('purchase', 'gift_sent')) AS spent,
  (SELECT COUNT(*) FROM ${T.wallet_transactions} WHERE user_id = $1 AND reason = 'gift_sent') AS gifts,
  (SELECT COUNT(*) FROM ${T.wallet_transactions} WHERE user_id = $1 AND reason = 'daily') AS daily,
  (SELECT COUNT(*) FROM ${T.wallet_transactions} WHERE user_id = $1 AND reason = 'purchase' AND meta->>'blackMarket' = '1') AS "blackMarket",
  (SELECT COUNT(*) FROM ${T.wallet_transactions} WHERE user_id = $1 AND reason = 'monthly_ranking' AND (meta->>'rank')::int <= 3) AS top3,
  (SELECT COUNT(*) FROM ${T.wallet_transactions} WHERE user_id = $1 AND reason = 'monthly_ranking' AND (meta->>'rank')::int = 1) AS "monthlyWins",
  (SELECT COUNT(*) FROM ${T.birthdays} WHERE user_id = $1) AS birthday,
  (SELECT settings FROM ${T.user_profiles} WHERE user_id = $1) AS settings`;

/** Every stat an achievement can watch, from stored data and the activity counters. */
async function readStats(userId: string): Promise<{ stats: AchievementStats; unlocked: Map<string, Date> }> {
  const pool = requirePool();
  const [derived, counters, unlocked, pets] = await Promise.all([
    pool.query<Record<string, unknown>>(DERIVED_SQL, [userId]),
    pool.query<{ stat: string; value: string }>(`SELECT stat, value FROM ${T.user_stats} WHERE user_id = $1`, [userId]),
    pool.query<{ achievement_id: string; unlocked_at: Date }>(`SELECT achievement_id, unlocked_at FROM ${T.user_achievements} WHERE user_id = $1`, [userId]),
    getPetOverview(userId, new Date(), pool),
  ]);
  const row = derived.rows[0] ?? {};
  const stored = new Map(counters.rows.map((entry) => [entry.stat, Number(entry.value)]));
  const counter = (stat: string) => stored.get(stat) ?? 0;
  const n = (key: string) => Number(row[key] ?? 0);
  const settings = normalizeSettings(row.settings);
  const { equipped } = settings;
  const stats = {
    ...Object.fromEntries([...ACTIVITY_COUNTERS, ...CHAT_STATS].map((stat) => [stat, counter(stat)])),
    maxLevel: n('maxLevel'), servers: n('servers'), servers10: n('servers10'), wins: n('wins'), items: n('items'),
    giftsReceived: n('giftsReceived'), eventItems: n('eventItems'), streak: n('streak'), lifetime: n('lifetime'),
    purchases: n('purchases'), spent: n('spent'), gifts: n('gifts'), daily: n('daily'), blackMarket: n('blackMarket'),
    top3: n('top3'), monthlyWins: n('monthlyWins'), birthday: Math.min(1, n('birthday')),
    bio: settings.bio.trim() ? 1 : 0,
    outfit: COSMETIC_SLOTS.every((slot) => (slot === 'badge' ? equipped.badges.length > 0 : equipped[slot] !== null)) ? 1 : 0,
    voiceMinutes: Math.floor(counter('voice_ms') / 60_000),
    gamesPlayed: GAME_IDS.filter((game) => counter(`game_${game}`) > 0).length,
    achievements: unlocked.rows.length,
    petFeeds: counter('pet_feeds'),
    // The highest form any pet reached (a sad spell keeps the form, so this never drops).
    petForm: Math.max(0, ...pets.pets.map((pet) => pet.stage)),
    pets: pets.pets.length,
  } as AchievementStats;
  return { stats, unlocked: new Map(unlocked.rows.map((entry) => [entry.achievement_id, entry.unlocked_at])) };
}

/** Unlocks every achievement whose condition is met. Never throws (bot hooks call it fire-and-forget). */
export async function syncAchievements(userId: string): Promise<string[]> {
  if (!cosmeticsPool()) return [];
  try {
    // Catch up on items added to achievements unlocked earlier (e.g. the achievement titles).
    await requirePool().query(
      `INSERT INTO ${T.user_inventory} (user_id, item_id, source)
       SELECT a.user_id, i.id, 'achievement' FROM ${T.user_achievements} a
       JOIN ${T.shop_items} i ON i.availability = 'achievement' AND i.achievement_id = a.achievement_id
       WHERE a.user_id = $1
       ON CONFLICT DO NOTHING`,
      [userId],
    );
    const unlockedNow: string[] = [];
    // Rewards can complete further achievements (lifetime, collector), so check twice at most.
    for (let round = 0; round < 2; round += 1) {
      const { stats, unlocked } = await readStats(userId);
      const due = metAchievements(stats, new Set(unlocked.keys()));
      if (due.length === 0) break;
      for (const def of due) {
        const name = nameOf(def.id)?.name ?? def.id;
        const inserted = await withTx(async (client) => {
          const result = await client.query(
            `INSERT INTO ${T.user_achievements} (user_id, achievement_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [userId, def.id],
          );
          if (!result.rowCount) return false;
          await earnTx(client, userId, def.reward, 'achievement', `Erfolg „${name}“`, null);
          // Everything the achievement unlocks: its badge, its title and any item the owner tied to it.
          await client.query(
            `INSERT INTO ${T.user_inventory} (user_id, item_id, source)
             SELECT $1, id, 'achievement' FROM ${T.shop_items} WHERE availability = 'achievement' AND achievement_id = $2
             ON CONFLICT DO NOTHING`,
            [userId, def.id],
          );
          return true;
        });
        if (inserted) unlockedNow.push(def.id);
      }
    }
    return unlockedNow;
  } catch (error) {
    logger.warn('Erfolge konnten nicht geprüft werden:', (error as Error).message);
    return [];
  }
}

export async function listAchievements(userId: string): Promise<Achievement[]> {
  const { stats, unlocked } = await readStats(userId);
  return ACHIEVEMENTS.map((def) => {
    const meta = nameOf(def.id);
    const unlockedAt = unlocked.get(def.id) ?? null;
    return {
      id: def.id,
      name: meta?.name ?? def.id,
      description: meta?.description ?? '',
      reward: def.reward,
      itemId: `ach-${def.id}`,
      titleId: meta?.title ? `ach-title-${def.id}` : null,
      unlockedAt: unlockedAt ? unlockedAt.toISOString() : null,
      progress: def.showProgress ? { current: Math.min(stats[def.stat], def.target), target: def.target } : null,
    };
  });
}
