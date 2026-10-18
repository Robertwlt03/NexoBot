// Detail statistics for the Statistiken page: activity heatmap, channels, members and per-member profiles.
// Import-free (shared with the dashboard). All routes live under /dashboard/api/guilds/:guildId/insights.
// Per-member numbers are only recorded while the server allows it (settings.memberTracking); never message content.

import type { InsightRange } from './insights.js';

/** Detail tables (per member, channel and hour) are purged after this many days. */
export const DETAIL_RETENTION_DAYS = 180;

/** GET/PUT /insights/settings. Turning memberTracking off deletes the recorded per-member rows of this server. */
export interface InsightsSettings {
  memberTracking: boolean;
  retentionDays: number;
}

/** Messages per weekday and hour in Europe/Berlin time: heatmap[weekday][hour], weekday 0 = Monday … 6 = Sunday. */
export type ActivityHeatmap = number[][];

export interface ActivityDay {
  /** UTC day, YYYY-MM-DD. */
  day: string;
  messages: number;
  voiceMinutes: number;
}

export interface ChannelActivity {
  channelId: string;
  /** Channel name, or "#gelöschter-kanal" when it no longer exists. */
  name: string;
  messages: number;
}

export interface MemberActivity {
  userId: string;
  name: string;
  avatarUrl: string | null;
  messages: number;
  voiceMinutes: number;
}

/**
 * GET /insights/activity?range=7|30|90&userId=<id?>
 * Without userId: the whole server. With userId: everything scoped to that member (topMembers is then empty).
 */
export interface ActivityResponse {
  range: InsightRange;
  userId: string | null;
  memberTracking: boolean;
  /** First day with detail data, null when nothing was recorded yet. */
  trackingSince: string | null;
  days: ActivityDay[];
  heatmap: ActivityHeatmap;
  /** Top 10 channels by messages in the range. */
  topChannels: ChannelActivity[];
  /** Top 10 members by messages in the range (empty when scoped to a member or member tracking is off). */
  topMembers: MemberActivity[];
  /** Top 10 members by voice minutes in the range (same rules as topMembers). */
  topVoice: MemberActivity[];
  totals: { messages: number; voiceMinutes: number; activeDays: number };
}

/** GET /insights/members/search?q=<text> — up to 10 members of this server matching name, nickname or id. */
export interface MemberHit {
  userId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  bot: boolean;
}

/** GET /insights/members?range=7|30|90 — growth details beyond the daily joins/leaves. */
export interface MembersResponse {
  range: InsightRange;
  /** Members who joined in the range: how many are still on the server and how many wrote at least one message. */
  retention: { joined: number; stillHere: number; active: number } | null;
  /** Top inviters by invite uses (from invite tracking), up to 10. */
  inviters: { userId: string; name: string; uses: number }[];
  /** Newest members (up to 10) with join time. */
  newest: { userId: string; name: string; avatarUrl: string | null; joinedAt: string }[];
  /** Account age of current members, bucketed: < 7 days, < 30 days, < 1 year, older. */
  accountAge: { label: string; count: number }[];
}

/** GET /insights/moderation?range=7|30|90 — who moderates and how. */
export interface ModerationInsights {
  range: InsightRange;
  byModerator: { moderatorId: string | null; name: string; count: number }[];
  byAction: { action: string; label: string; count: number }[];
  /** Most moderated members in the range, up to 10. */
  topTargets: { userId: string | null; name: string; count: number }[];
}

/** GET /insights/members/:userId?range=7|30|90 — one member's profile across all modules. */
export interface MemberProfile {
  userId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  bot: boolean;
  inGuild: boolean;
  joinedAt: string | null;
  accountCreatedAt: string;
  roles: { id: string; name: string; color: string }[];
  invitedBy: { userId: string; name: string } | null;
  leveling: { level: number; xp: number; totalXp: number; rank: number | null } | null;
  economy: { wallet: number; bank: number } | null;
  moderation: { cases: number; warnings: number; notes: number; lastCaseAt: string | null };
  tickets: { open: number; total: number } | null;
  applications: { total: number; pending: number } | null;
  birthday: { month: number; day: number } | null;
  /** Same shape as ActivityResponse scoped to this member (topMembers/topVoice empty). */
  activity: ActivityResponse;
}
