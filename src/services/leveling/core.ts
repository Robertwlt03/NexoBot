// Pure leveling rules: no I/O, no discord.js. Covered by tests/levelingCore.test.ts.

export const MAX_LEVEL = 1000;
export const MIN_LEVEL = 0;

/** Leveling settings stored under `guildConfig.leveling`. */
export interface GuildLevelingConfig {
  enabled: boolean;
  xpPerMessage: { min: number; max: number };
  xpCooldown: number;
  levelUpMessage: string;
  levelUpChannel: string | null;
  ignoredChannels: string[];
  ignoredRoles: string[];
  blacklistedUsers: string[];
  roleRewards: Record<string, string>;
  announceLevelUp: boolean;
  xpMultiplier: number;
  xpRange?: { min: number; max: number };
  configured?: boolean;
  [key: string]: unknown;
}

/** Stored per-user level record (`guild:{guildId}:leveling:users:{userId}`). */
export interface LevelData {
  xp: number;
  level: number;
  totalXp: number;
  lastMessage: number;
  rank: number;
}

/** A fresh copy each call: callers mutate the config before saving it. */
export function defaultLevelingConfig(): GuildLevelingConfig {
  return {
    enabled: true,
    xpPerMessage: { min: 15, max: 25 },
    xpCooldown: 20,
    levelUpMessage: '{user} ist auf Level {level} aufgestiegen!',
    levelUpChannel: null,
    ignoredChannels: [],
    ignoredRoles: [],
    blacklistedUsers: [],
    roleRewards: {},
    announceLevelUp: true,
    xpMultiplier: 1,
  };
}

/** XP needed to go from `level` to `level + 1`. */
export function getXpForLevel(level: number): number {
  return 5 * Math.pow(level, 2) + 50 * level + 50;
}

export function calculateTotalXp(level: number, currentXp = 0): number {
  let total = currentXp;
  for (let i = 0; i < level; i++) {
    total += getXpForLevel(i);
  }
  return total;
}

/** Clamps a stored or incoming record to valid numbers (missing record = level 0). */
export function normalizeLevelData(data: Partial<LevelData> | null | undefined): LevelData {
  return {
    xp: Math.max(0, Number(data?.xp) || 0),
    level: Math.max(MIN_LEVEL, Math.min(Number(data?.level) || 0, MAX_LEVEL)),
    totalXp: Math.max(0, Number(data?.totalXp) || 0),
    lastMessage: Number(data?.lastMessage) || 0,
    rank: Number(data?.rank) || 0,
  };
}

/** Adds XP and rolls over into new levels; `reached` lists every level gained, in order. */
export function applyXp(data: LevelData, xpToAdd: number, now: number): { data: LevelData; reached: number[] } {
  const next = { ...data, xp: data.xp + xpToAdd, totalXp: data.totalXp + xpToAdd, lastMessage: now };
  const reached: number[] = [];
  while (next.xp >= getXpForLevel(next.level) && next.level < MAX_LEVEL) {
    next.xp -= getXpForLevel(next.level);
    next.level += 1;
    reached.push(next.level);
  }
  return { data: next, reached };
}

/** Whether the member is still inside the XP cooldown since their last counted message. */
export function isOnCooldown(config: GuildLevelingConfig, lastMessage: number, now: number): boolean {
  return now - (lastMessage || 0) < (config.xpCooldown || 60) * 1000;
}

/** Random XP for one message within the configured range, times the server multiplier. */
export function rollMessageXp(config: GuildLevelingConfig, random = Math.random): number {
  const min = Math.max(1, config.xpRange?.min || config.xpPerMessage?.min || 15);
  const max = Math.max(min, config.xpRange?.max || config.xpPerMessage?.max || 25);
  const xp = Math.floor(random() * (max - min + 1)) + min;
  return config.xpMultiplier && config.xpMultiplier > 1 ? Math.floor(xp * config.xpMultiplier) : xp;
}

/** Progress towards the next level in whole percent (0–100). */
export function progressPercent(xp: number, xpNeeded: number): number {
  return xpNeeded > 0 ? Math.max(0, Math.min(100, Math.floor((xp / xpNeeded) * 100))) : 0;
}
