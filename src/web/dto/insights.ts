// GET /guilds/:id/insights?range=7|30|90 — live snapshot, module figures and the recorded daily history.

export const INSIGHT_RANGES = [7, 30, 90] as const;
export type InsightRange = (typeof INSIGHT_RANGES)[number];

export interface InsightDay {
  /** UTC day, YYYY-MM-DD. */
  day: string;
  joins: number;
  leaves: number;
  messages: number;
  activeMembers: number;
  voiceMinutes: number;
  /** Carried forward from the last snapshot; null before the first one. */
  memberCount: number | null;
  /** Moderation cases of this day, aligned with `moderation.series`. */
  moderation: number[];
}

export interface InsightTotals {
  joins: number;
  leaves: number;
  messages: number;
  voiceMinutes: number;
  /** Average distinct message authors per recorded day. */
  activeAvg: number;
}

export interface InsightsResponse {
  range: InsightRange;
  live: {
    members: number;
    humans: number;
    bots: number;
    /** Approximate online count from Discord (null when unavailable). */
    online: number | null;
    boosts: number;
    boostTier: number;
    createdAt: string;
    textChannels: number;
    voiceChannels: number;
    roles: number;
    emojis: number;
    stickers: number;
  };
  history: {
    days: InsightDay[];
    /** First recorded day for this server, null when nothing was recorded yet (or no database). */
    trackingSince: string | null;
    totals: InsightTotals;
    /** Same totals for the period before; null when that period was not fully recorded. */
    previous: InsightTotals | null;
  };
  moderation: {
    /** Cases in the range. */
    total: number;
    /** Up to four labels: the top three actions, then "Andere". */
    series: string[];
    byAction: { action: string; label: string; count: number }[];
    warnings: number;
  };
  tickets: { open: number; closed: number; avgCloseTimeMs: number | null; avgRating: number | null } | null;
  leveling: { rankedMembers: number; top: { userId: string; name: string; level: number; totalXp: number }[] } | null;
  economy: { accounts: number; inCirculation: number } | null;
  giveaways: { active: number } | null;
  birthdays: { upcoming: { userId: string; name: string; month: number; day: number; daysUntil: number }[] } | null;
  applications: { pending: number } | null;
  counting: { enabled: boolean; currentStreak: number; bestStreak: number } | null;
}
