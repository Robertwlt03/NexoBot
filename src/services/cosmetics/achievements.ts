// Achievements: derived from stored data (levels, wallet, inventory, transactions, monthly scores), so a sync can
// always catch up. Each unlock pays Kristalle once (not capped) and grants its badge item `ach-<id>`.

import type { Achievement } from '../../web/dto/profile.js';
import { logger } from '../../utils/logger.js';
import { ACHIEVEMENT_BADGES } from './catalog.js';
import { T, cosmeticsPool, requirePool, withTx } from './db.js';
import { earnTx } from './wallet.js';

export interface AchievementStats {
  maxLevel: number; wins: number; items: number; streak: number; lifetime: number;
  purchases: number; gifts: number; blackMarket: number; top3: number;
}

interface AchievementDef { id: string; reward: number; stat: keyof AchievementStats; target: number; showProgress: boolean }

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_purchase', reward: 50, stat: 'purchases', target: 1, showProgress: false },
  { id: 'level_10', reward: 50, stat: 'maxLevel', target: 10, showProgress: true },
  { id: 'level_25', reward: 120, stat: 'maxLevel', target: 25, showProgress: true },
  { id: 'level_50', reward: 300, stat: 'maxLevel', target: 50, showProgress: true },
  { id: 'streak_7', reward: 75, stat: 'streak', target: 7, showProgress: true },
  { id: 'streak_30', reward: 300, stat: 'streak', target: 30, showProgress: true },
  { id: 'wins_100', reward: 100, stat: 'wins', target: 100, showProgress: true },
  { id: 'wins_1000', reward: 500, stat: 'wins', target: 1000, showProgress: true },
  { id: 'first_gift', reward: 50, stat: 'gifts', target: 1, showProgress: false },
  { id: 'black_market', reward: 150, stat: 'blackMarket', target: 1, showProgress: false },
  { id: 'monthly_top3', reward: 200, stat: 'top3', target: 1, showProgress: false },
  { id: 'collector_10', reward: 100, stat: 'items', target: 10, showProgress: true },
  { id: 'lifetime_10000', reward: 250, stat: 'lifetime', target: 10_000, showProgress: true },
];

const nameOf = (id: string) => ACHIEVEMENT_BADGES.find((entry) => entry.achievementId === id);

export function metAchievements(stats: AchievementStats, unlocked: Set<string>): AchievementDef[] {
  return ACHIEVEMENTS.filter((def) => !unlocked.has(def.id) && stats[def.stat] >= def.target);
}

async function readStats(userId: string): Promise<{ stats: AchievementStats; unlocked: Map<string, Date> }> {
  const pool = requirePool();
  const [stats, unlocked] = await Promise.all([
    pool.query<Record<keyof AchievementStats, string | null>>(
      `SELECT
         (SELECT MAX(level) FROM ${T.user_levels} WHERE user_id = $1) AS "maxLevel",
         (SELECT SUM(minigame_points) FROM ${T.monthly_scores} WHERE user_id = $1) AS wins,
         (SELECT COUNT(*) FROM ${T.user_inventory} WHERE user_id = $1) AS items,
         (SELECT daily_streak FROM ${T.user_wallets} WHERE user_id = $1) AS streak,
         (SELECT lifetime_earned FROM ${T.user_wallets} WHERE user_id = $1) AS lifetime,
         (SELECT COUNT(*) FROM ${T.wallet_transactions} WHERE user_id = $1 AND reason IN ('purchase', 'gift_sent')) AS purchases,
         (SELECT COUNT(*) FROM ${T.wallet_transactions} WHERE user_id = $1 AND reason = 'gift_sent') AS gifts,
         (SELECT COUNT(*) FROM ${T.wallet_transactions} WHERE user_id = $1 AND reason = 'purchase' AND meta->>'blackMarket' = '1') AS "blackMarket",
         (SELECT COUNT(*) FROM ${T.wallet_transactions} WHERE user_id = $1 AND reason = 'monthly_ranking' AND (meta->>'rank')::int <= 3) AS top3`,
      [userId],
    ),
    pool.query<{ achievement_id: string; unlocked_at: Date }>(`SELECT achievement_id, unlocked_at FROM ${T.user_achievements} WHERE user_id = $1`, [userId]),
  ]);
  const row = stats.rows[0];
  const n = (key: keyof AchievementStats) => Number(row[key] ?? 0);
  return {
    stats: {
      maxLevel: n('maxLevel'), wins: n('wins'), items: n('items'), streak: n('streak'), lifetime: n('lifetime'),
      purchases: n('purchases'), gifts: n('gifts'), blackMarket: n('blackMarket'), top3: n('top3'),
    },
    unlocked: new Map(unlocked.rows.map((entry) => [entry.achievement_id, entry.unlocked_at])),
  };
}

/** Unlocks every achievement whose condition is met. Never throws (bot hooks call it fire-and-forget). */
export async function syncAchievements(userId: string): Promise<string[]> {
  if (!cosmeticsPool()) return [];
  try {
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
          await client.query(
            `INSERT INTO ${T.user_inventory} (user_id, item_id, source) VALUES ($1, $2, 'achievement') ON CONFLICT DO NOTHING`,
            [userId, `ach-${def.id}`],
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
      unlockedAt: unlockedAt ? unlockedAt.toISOString() : null,
      progress: def.showProgress ? { current: Math.min(stats[def.stat], def.target), target: def.target } : null,
    };
  });
}
