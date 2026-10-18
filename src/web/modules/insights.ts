// Server statistics (insights): live snapshot, figures from the other modules and the daily history recorded by
// services/statsTracker.ts. Every module section degrades to null on its own, so one failing store never blanks the page.

import express from 'express';
import { ChannelType } from 'discord.js';
import type { Guild } from 'discord.js';
import type { DashboardModule } from './index.js';
import { INSIGHT_RANGES, type InsightDay, type InsightRange, type InsightsResponse, type InsightTotals } from '../dto/insights.js';
import { LEVELING_LEADERBOARD_MAX } from '../dto/leveling.js';
import { locals } from '../dashboard.js';
import { resolveNames } from '../moduleSupport.js';
import { addDays, dayKey, fillDays, readDailyStats } from '../../services/statsTracker.js';
import { ACTION_LABELS, getModerationCases } from '../../utils/moderation.js';
import { WarningService } from '../../services/moderation/warningService.js';
import { getGuildTicketStats } from '../../utils/database/tickets.js';
import { getLeaderboard } from '../../services/leveling/leveling.js';
import { getEconomyLeaderboard } from '../../utils/economy.js';
import { getGuildGiveaways } from '../../utils/giveaways.js';
import { getUpcomingBirthdays } from '../../services/birthdayService.js';
import { getApplications } from '../../utils/database.js';
import { getCountingGameConfig } from '../../services/countingGameService.js';
import { logger } from '../../utils/logger.js';
import type { NexoClient } from '../../types/index.js';

/** Upper bound of stored records scanned per request (cases, warnings, applications). */
const SCAN_LIMIT = 10_000;
const ONLINE_TTL_MS = 60_000;
const OTHER = 'Andere';

// approximatePresenceCount needs a REST call (no GuildPresences intent), so it is cached per guild.
const onlineCache = new Map<string, { at: number; online: number | null }>();

async function onlineCount(client: NexoClient, guild: Guild): Promise<number | null> {
  const cached = onlineCache.get(guild.id);
  if (cached && Date.now() - cached.at < ONLINE_TTL_MS) return cached.online;
  const fetched = await client.guilds.fetch({ guild: guild.id, withCounts: true, force: true }).catch(() => null);
  const online = fetched?.approximatePresenceCount ?? null;
  onlineCache.set(guild.id, { at: Date.now(), online });
  return online;
}

/** Runs a module getter; a failure becomes null (logged) instead of failing the whole page. */
async function section<T>(name: string, run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (error) {
    logger.warn(`Statistiken: ${name} nicht verfügbar:`, (error as Error).message);
    return null;
  }
}

function totals(days: InsightDay[], trackingSince: string | null): InsightTotals {
  const recorded = trackingSince ? days.filter((d) => d.day >= trackingSince) : [];
  const sum = (pick: (d: InsightDay) => number) => days.reduce((total, d) => total + pick(d), 0);
  return {
    joins: sum((d) => d.joins),
    leaves: sum((d) => d.leaves),
    messages: sum((d) => d.messages),
    voiceMinutes: sum((d) => d.voiceMinutes),
    activeAvg: recorded.length ? Math.round(recorded.reduce((total, d) => total + d.activeMembers, 0) / recorded.length) : 0,
  };
}

const parseRange = (value: unknown): InsightRange =>
  INSIGHT_RANGES.find((range) => String(range) === value) ?? 30;

async function readInsights(client: NexoClient, guild: Guild, range: InsightRange): Promise<InsightsResponse> {
  const today = dayKey();
  const start = addDays(today, -(range - 1));
  const previousStart = addDays(start, -range);

  const [stored, online, cases, warnings, tickets, leaderboard, economy, giveaways, birthdays, pending, counting] = await Promise.all([
    readDailyStats(guild.id, previousStart, today),
    onlineCount(client, guild),
    section('Moderation', () => getModerationCases(guild.id, { limit: SCAN_LIMIT })),
    section('Verwarnungen', () => WarningService.getGuildWarnings(guild.id, { limit: SCAN_LIMIT })),
    section('Tickets', () => getGuildTicketStats(guild.id)),
    section('Leveling', () => getLeaderboard(client, guild.id, LEVELING_LEADERBOARD_MAX)),
    section('Economy', () => getEconomyLeaderboard(client, guild.id)),
    section('Giveaways', () => getGuildGiveaways(client, guild.id)),
    section('Geburtstage', () => getUpcomingBirthdays(client, guild.id, 5)),
    section('Bewerbungen', () => getApplications(client, guild.id, { status: 'pending', limit: SCAN_LIMIT })),
    section('Zählspiel', () => getCountingGameConfig(client, guild.id)),
  ]);

  // Moderation: cases per day in the range, folded into the top three actions plus "Andere".
  const inRange = (cases ?? []).filter((entry) => dayKey(new Date(entry.createdAt)) >= start);
  const actionCounts = new Map<string, number>();
  for (const entry of inRange) actionCounts.set(entry.action, (actionCounts.get(entry.action) ?? 0) + 1);
  const byAction = [...actionCounts]
    .sort((a, b) => b[1] - a[1])
    .map(([action, count]) => ({ action, label: ACTION_LABELS[action] ?? action, count }));
  const shown = byAction.length > 4 ? byAction.slice(0, 3) : byAction;
  const series = [...shown.map((entry) => entry.label), ...(byAction.length > 4 ? [OTHER] : [])];
  const moderationByDay = new Map<string, number[]>();
  for (const entry of inRange) {
    const day = dayKey(new Date(entry.createdAt));
    const index = shown.findIndex((s) => s.action === entry.action);
    const counts = moderationByDay.get(day) ?? series.map(() => 0);
    counts[index === -1 ? series.length - 1 : index] += 1;
    moderationByDay.set(day, counts);
  }

  const filled = fillDays(stored?.rows ?? [], today, range * 2).map((day): InsightDay => ({
    ...day,
    moderation: moderationByDay.get(day.day) ?? series.map(() => 0),
  }));
  const days = filled.slice(range);
  const trackingSince = stored?.trackingSince ?? null;

  const leaderTop = (leaderboard ?? []).slice(0, 5);
  const names = await resolveNames(client, guild, [...leaderTop.map((e) => e.userId), ...(birthdays ?? []).map((b) => b.userId)]);
  const bots = guild.members.cache.filter((member) => member.user.bot).size;
  const channelCount = (...types: ChannelType[]) => guild.channels.cache.filter((c) => types.includes(c.type)).size;

  return {
    range,
    live: {
      members: guild.memberCount,
      humans: Math.max(0, guild.memberCount - bots),
      bots,
      online,
      boosts: guild.premiumSubscriptionCount ?? 0,
      boostTier: guild.premiumTier,
      createdAt: guild.createdAt.toISOString(),
      textChannels: channelCount(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum),
      voiceChannels: channelCount(ChannelType.GuildVoice, ChannelType.GuildStageVoice),
      roles: Math.max(0, guild.roles.cache.size - 1),
      emojis: guild.emojis.cache.size,
      stickers: guild.stickers.cache.size,
    },
    history: {
      days,
      trackingSince,
      totals: totals(days, trackingSince),
      previous: trackingSince && trackingSince <= previousStart ? totals(filled.slice(0, range), trackingSince) : null,
    },
    moderation: { total: inRange.length, series, byAction, warnings: warnings?.length ?? 0 },
    tickets: tickets && { open: tickets.openCount, closed: tickets.closedCount, avgCloseTimeMs: tickets.avgCloseTimeMs, avgRating: tickets.avgRating },
    leveling: leaderboard && {
      rankedMembers: leaderboard.length,
      top: leaderTop.map((e) => ({ userId: e.userId, name: names[e.userId] ?? e.username, level: e.level, totalXp: e.totalXp })),
    },
    economy: economy && { accounts: economy.length, inCirculation: economy.reduce((sum, e) => sum + e.net_worth, 0) },
    giveaways: giveaways && { active: giveaways.filter((g) => g.ended !== true && g.isEnded !== true).length },
    birthdays: birthdays && {
      upcoming: birthdays.map((b) => ({ userId: b.userId, name: names[b.userId] ?? b.userId, month: b.month, day: b.day, daysUntil: b.daysUntil })),
    },
    applications: pending && { pending: pending.length },
    counting: counting && { enabled: counting.enabled, currentStreak: counting.currentStreak, bestStreak: counting.bestStreak || 0 },
  };
}

export const insightsModule: DashboardModule = {
  id: 'insights',
  router: (client) => {
    const router = express.Router();
    router.get('/', async (req, res) => {
      res.json(await readInsights(client, locals(res).guild, parseRange(req.query.range)));
    });
    return router;
  },
};
