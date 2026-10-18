// Dashboard DTO for the leveling module (shared by API and frontend; keep import-free).

export interface LevelRoleReward {
  level: number;
  roleId: string;
}

export interface LevelingSettings {
  enabled: boolean;
  xpMin: number;
  xpMax: number;
  /** Seconds between XP grants per user. */
  cooldownSeconds: number;
  announceLevelUp: boolean;
  /** null = the server's system channel. */
  levelUpChannelId: string | null;
  levelUpMessage: string;
  roleRewards: LevelRoleReward[];
  ignoredChannels: string[];
  ignoredRoles: string[];
}

export interface LevelingMember {
  userId: string;
  name: string;
  avatarUrl: string | null;
  level: number;
  /** XP inside the current level. */
  xp: number;
  totalXp: number;
}

export interface LevelingLeaderboard {
  entries: (LevelingMember & { rank: number })[];
  page: number;
  pages: number;
  /** Ranked members (the leaderboard covers the top LEVELING_LEADERBOARD_MAX). */
  total: number;
}

export type LevelingMemberAction = 'set' | 'add' | 'remove';

export interface LevelRoleSyncResult {
  rolesReAwarded: number;
  prunedRewardEntries: number;
  errors: number;
}

export const LEVEL_UP_PLACEHOLDERS = ['{user}', '{level}', '{xp}', '{xpNeeded}'];
export const LEVELING_LEADERBOARD_MAX = 100;
export const LEVELING_PAGE_SIZE = 10;
export const LEVELING_MAX_LEVEL = 1000;
