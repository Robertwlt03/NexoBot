// Owner-tunable economy settings (economy_config, single row id = 1). Defaults come from shared/cosmetics.ts;
// the stored JSON only overrides what the owner changed.

import {
  BLACK_MARKET_SIZE, DAILY_BONUS, DAILY_EARN_CAP, MONTHLY_MAX_SERVERS, MONTHLY_MIN_HUMANS, MONTHLY_RANK_REWARDS,
} from '../../shared/cosmetics.js';
import type { EconomyConfig } from '../../web/dto/profile.js';
import { badRequest, body, int } from '../../web/http.js';
import { T, cosmeticsPool, requirePool } from './db.js';

export function defaultEconomyConfig(): EconomyConfig {
  return {
    dailyEarnCap: DAILY_EARN_CAP,
    levelUpBase: 20,
    levelUpPerLevel: 6,
    milestoneMultiplier: 1.5,
    minigameReward: { min: 4, max: 12 },
    monthlyRewards: [...MONTHLY_RANK_REWARDS],
    monthlyMinHumans: MONTHLY_MIN_HUMANS,
    monthlyMaxServers: MONTHLY_MAX_SERVERS,
    blackMarketSize: BLACK_MARKET_SIZE,
    dailyBonus: { ...DAILY_BONUS },
  };
}

/** Bernis for reaching `level` (same formula as levelUpReward() in shared/cosmetics.ts, with tunable numbers). */
export function levelReward(config: EconomyConfig, level: number): number {
  const base = Math.round(config.levelUpBase + level * config.levelUpPerLevel);
  return level % 10 === 0 ? Math.round(base * config.milestoneMultiplier) : base;
}

/** Daily bonus for the given streak day (1 = first day). */
export function dailyBonusAmount(config: EconomyConfig, streak: number): number {
  const { base, perStreakDay, maxStreakBonus } = config.dailyBonus;
  return base + Math.min(maxStreakBonus, perStreakDay * Math.max(0, streak - 1));
}

const num = (value: unknown, field: string, min: number, max: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw badRequest(`${field}: Zahl zwischen ${min} und ${max} erwartet.`);
  }
  return value;
};

/** Validates a (partial) config on top of `current`; throws HttpError 400 with a German message. */
export function parseEconomyConfig(input: unknown, current: EconomyConfig = defaultEconomyConfig()): EconomyConfig {
  const raw = body(input);
  const merged: Record<string, unknown> = { ...current, ...raw };
  const reward = body(merged.minigameReward);
  const daily = body(merged.dailyBonus);
  const minigameReward = { min: int(reward.min, 'Minispiel-Belohnung (min)', 0, 1000), max: int(reward.max, 'Minispiel-Belohnung (max)', 0, 1000) };
  if (minigameReward.min > minigameReward.max) throw badRequest('Minispiel-Belohnung: Minimum darf nicht über dem Maximum liegen.');
  if (!Array.isArray(merged.monthlyRewards) || merged.monthlyRewards.length < 1 || merged.monthlyRewards.length > 10) {
    throw badRequest('Monatsbelohnungen: Liste mit 1 bis 10 Plätzen erwartet.');
  }
  return {
    dailyEarnCap: int(merged.dailyEarnCap, 'Tageslimit', 0, 100_000),
    levelUpBase: int(merged.levelUpBase, 'Level-up-Basis', 0, 10_000),
    levelUpPerLevel: num(merged.levelUpPerLevel, 'Level-up pro Level', 0, 1000),
    milestoneMultiplier: num(merged.milestoneMultiplier, 'Meilenstein-Multiplikator', 1, 10),
    minigameReward,
    monthlyRewards: merged.monthlyRewards.map((value: unknown, index: number) => int(value, `Monatsbelohnung Platz ${index + 1}`, 0, 100_000)),
    monthlyMinHumans: int(merged.monthlyMinHumans, 'Mindestanzahl Menschen', 1, 1_000_000),
    monthlyMaxServers: int(merged.monthlyMaxServers, 'Server pro Monat', 1, 50),
    blackMarketSize: int(merged.blackMarketSize, 'Schwarzmarkt-Größe', 1, 24),
    dailyBonus: {
      base: int(daily.base, 'Tagesbonus', 0, 10_000),
      perStreakDay: int(daily.perStreakDay, 'Tagesbonus pro Serientag', 0, 1000),
      maxStreakBonus: int(daily.maxStreakBonus, 'Maximaler Serienbonus', 0, 100_000),
    },
  };
}

let cache: { value: EconomyConfig; at: number } | null = null;
const CACHE_MS = 30_000;

export async function getEconomyConfig(): Promise<EconomyConfig> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const pool = cosmeticsPool();
  let value = defaultEconomyConfig();
  if (pool) {
    const result = await pool.query<{ config: unknown }>(`SELECT config FROM ${T.economy_config} WHERE id = 1`);
    // A stored config that no longer validates (e.g. after a code change) falls back to the defaults.
    try {
      if (result.rows[0]) value = parseEconomyConfig(result.rows[0].config, value);
    } catch {
      value = defaultEconomyConfig();
    }
  }
  cache = { value, at: Date.now() };
  return value;
}

export async function saveEconomyConfig(input: unknown): Promise<EconomyConfig> {
  const value = parseEconomyConfig(input, await getEconomyConfig());
  await requirePool().query(
    `INSERT INTO ${T.economy_config} (id, config) VALUES (1, $1::jsonb) ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config`,
    [JSON.stringify(value)],
  );
  cache = { value, at: Date.now() };
  return value;
}
