// Dashboard DTO for the counting game (shared by API and frontend; keep import-free).

export interface CountingLeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  count: number;
}

export interface CountingStatus {
  enabled: boolean;
  channelId: string | null;
  system: string;
  systemLabel: string;
  nextNumber: number;
  /** The next value in the chosen system (e.g. "XII" for roman). */
  expected: string;
  currentStreak: number;
  bestStreak: number;
  lastUserId: string | null;
  lastUserName: string | null;
  systems: { value: string; label: string }[];
  /** Top COUNTING_LEADERBOARD_LIMIT counters by correct numbers. */
  leaderboard: CountingLeaderboardEntry[];
  /** Everyone who has counted at least once. */
  players: number;
}

export const COUNTING_LEADERBOARD_LIMIT = 25;
export const COUNTING_MAX_START = 1_000_000;
