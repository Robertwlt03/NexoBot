// Server statistics (insights): live snapshot, figures from the other modules and the daily history recorded by
// services/statsTracker.ts. Every module section degrades to null on its own, so one failing store never blanks the page.
// Detail routes (dto/insightsDetail.ts): settings, activity heatmap, member search, growth, moderation, member profile.

import express from 'express';
import { ChannelType } from 'discord.js';
import type { Guild, GuildMember } from 'discord.js';
import type { DashboardModule } from './index.js';
import { type InsightDay, type InsightRange, type InsightsResponse, type InsightTotals } from '../dto/insights.js';
import { LEVELING_LEADERBOARD_MAX } from '../dto/leveling.js';
import {
  DETAIL_RETENTION_DAYS, type ActivityDay, type ActivityResponse, type InsightsSettings, type MemberActivity,
  type MemberHit, type MemberProfile, type MembersResponse, type ModerationInsights,
} from '../dto/insightsDetail.js';
import { locals } from '../dashboard.js';
import { HttpError, badRequest, body, bool } from '../http.js';
import { resolveNames } from '../moduleSupport.js';
import {
  addDays, buildHeatmap, countActiveMembers, dayKey, deleteMemberStats, fillDays, insightRangeOf, isMemberTrackingEnabled,
  readDailyStats, readDetailStats, setMemberTrackingCache,
} from '../../services/statsTracker.js';
import { patchGuildConfig } from '../../services/config/guildConfig.js';
import { getUserNotes } from '../../services/moderation/userNotesService.js';
import { getUserBirthday } from '../../services/birthdayService.js';
import { getEconomyKey } from '../../utils/economy.js';
import { listGuildTickets } from '../../utils/database/tickets.js';
import { ACTION_LABELS, getModerationCases } from '../../utils/moderation.js';
import { WarningService } from '../../services/moderation/warningService.js';
import { getGuildTicketStats } from '../../utils/database/tickets.js';
import { getLeaderboard, getRank, getUserLevelData } from '../../services/leveling/leveling.js';
import { getEconomyLeaderboard } from '../../utils/economy.js';
import { getGuildGiveaways } from '../../utils/giveaways.js';
import { getUpcomingBirthdays } from '../../services/birthdayService.js';
import { getApplications } from '../../utils/database.js';
import { getCountingGameConfig } from '../../services/countingGameService.js';
import { isSnowflake } from '../../utils/validation.js';
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

/** `range` query parameter: 7, 30 or 90 (default 30). */
function parseRange(value: unknown): InsightRange {
  const range = insightRangeOf(value);
  if (range === null) throw badRequest('Zeitraum: 7, 30 oder 90 Tage erwartet.');
  return range;
}

function parseUserId(value: unknown): string {
  if (typeof value !== 'string' || !isSnowflake(value)) throw badRequest('Ungültige Mitglieds-ID.');
  return value;
}

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
      top: leaderTop.map((e) => ({ userId: e.userId, name: names[e.userId] ?? e.userId, level: e.level, totalXp: e.totalXp })),
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

// ---------- Detail statistics (dto/insightsDetail.ts) ----------

const DAY_MS = 86_400_000;
const TOP = 10;
const DELETED_CHANNEL = '#gelöschter-kanal';

/** Entries counted per key, most frequent first. */
function tally<K>(keys: K[]): [K, number][] {
  const counts = new Map<K, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}

const avatarOf = (client: NexoClient, guild: Guild, id: string): string | null =>
  (guild.members.cache.get(id) ?? client.users.cache.get(id))?.displayAvatarURL() ?? null;

async function readSettings(client: NexoClient, guild: Guild): Promise<InsightsSettings> {
  return { memberTracking: await isMemberTrackingEnabled(client, guild.id), retentionDays: DETAIL_RETENTION_DAYS };
}

async function readActivity(client: NexoClient, guild: Guild, range: InsightRange, userId: string | null): Promise<ActivityResponse> {
  const today = dayKey();
  const start = addDays(today, -(range - 1));
  const [memberTracking, detail, daily] = await Promise.all([
    isMemberTrackingEnabled(client, guild.id),
    readDetailStats(guild.id, start, today, userId),
    userId ? null : readDailyStats(guild.id, start, today),
  ]);

  // Server days come from guild_daily_stats (kept forever), member days from member_daily_stats.
  const source = userId ? detail?.memberDays ?? [] : daily?.rows ?? [];
  const byDay = new Map(source.map((row) => [row.day, row]));
  const days = Array.from({ length: range }, (_, index): ActivityDay => {
    const day = addDays(start, index);
    return { day, messages: byDay.get(day)?.messages ?? 0, voiceMinutes: byDay.get(day)?.voiceMinutes ?? 0 };
  });

  const showMembers = !userId && memberTracking;
  const topMessages = showMembers ? detail?.topMessages ?? [] : [];
  const topVoice = showMembers ? detail?.topVoice ?? [] : [];
  const names = await resolveNames(client, guild, [...topMessages, ...topVoice].map((entry) => entry.userId));
  const toActivity = (entry: { userId: string; messages: number; voiceMinutes: number }): MemberActivity => ({
    ...entry,
    name: names[entry.userId] ?? entry.userId,
    avatarUrl: avatarOf(client, guild, entry.userId),
  });

  return {
    range,
    userId,
    memberTracking,
    trackingSince: detail?.trackingSince ?? null,
    days,
    heatmap: buildHeatmap(detail?.hourly ?? []),
    topChannels: (detail?.channels ?? []).map((entry) => ({ ...entry, name: guild.channels.cache.get(entry.channelId)?.name ?? DELETED_CHANNEL })),
    topMembers: topMessages.map(toActivity),
    topVoice: topVoice.map(toActivity),
    totals: {
      messages: days.reduce((sum, day) => sum + day.messages, 0),
      voiceMinutes: days.reduce((sum, day) => sum + day.voiceMinutes, 0),
      activeDays: days.filter((day) => day.messages > 0 || day.voiceMinutes > 0).length,
    },
  };
}

const toHit = (member: GuildMember): MemberHit => ({
  userId: member.id,
  name: member.displayName,
  username: member.user.username,
  avatarUrl: member.displayAvatarURL(),
  bot: member.user.bot,
});

async function searchMembers(guild: Guild, query: string): Promise<MemberHit[]> {
  if (!query) return [];
  const hits = new Map<string, GuildMember>();
  if (isSnowflake(query)) {
    const member = guild.members.cache.get(query) ?? await guild.members.fetch(query).catch(() => null);
    if (member) hits.set(member.id, member);
    return [...hits.values()].map(toHit);
  }
  const needle = query.toLowerCase();
  for (const member of guild.members.cache.values()) {
    if (hits.size >= TOP) break;
    const names = [member.displayName, member.user.username, member.user.globalName ?? ''];
    if (names.some((name) => name.toLowerCase().includes(needle))) hits.set(member.id, member);
  }
  if (hits.size < TOP) {
    const found = await guild.members.search({ query, limit: TOP }).catch(() => null);
    for (const member of found?.values() ?? []) if (hits.size < TOP) hits.set(member.id, member);
  }
  return [...hits.values()].map(toHit);
}

async function readMembers(client: NexoClient, guild: Guild, range: InsightRange): Promise<MembersResponse> {
  const today = dayKey();
  const start = addDays(today, -(range - 1));
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const members = [...(guild.members.cache.size < guild.memberCount
    ? await guild.members.fetch().catch(() => guild.members.cache)
    : guild.members.cache).values()];
  const joined = members.filter((member) => (member.joinedTimestamp ?? 0) >= startMs);

  const [daily, active, invites] = await Promise.all([
    readDailyStats(guild.id, start, today),
    countActiveMembers(guild.id, start, joined.map((member) => member.id)),
    // No invite tracking is recorded yet, so inviters come from the server's current invites (needs "Server verwalten").
    guild.invites.fetch().catch(() => null),
  ]);

  const uses = new Map<string, number>();
  for (const invite of invites?.values() ?? []) {
    if (invite.inviterId && invite.uses) uses.set(invite.inviterId, (uses.get(invite.inviterId) ?? 0) + invite.uses);
  }
  const inviters = [...uses].sort((a, b) => b[1] - a[1]).slice(0, TOP);
  const newest = [...members].sort((a, b) => (b.joinedTimestamp ?? 0) - (a.joinedTimestamp ?? 0)).slice(0, TOP);
  const names = await resolveNames(client, guild, inviters.map(([id]) => id));

  const now = Date.now();
  const buckets = [
    { label: 'Unter 7 Tage', maxAgeMs: 7 * DAY_MS },
    { label: 'Unter 30 Tage', maxAgeMs: 30 * DAY_MS },
    { label: 'Unter 1 Jahr', maxAgeMs: 365 * DAY_MS },
    { label: 'Älter', maxAgeMs: Infinity },
  ];
  const accountAge = buckets.map((bucket) => ({ label: bucket.label, count: 0 }));
  for (const member of members) {
    if (member.user.bot) continue;
    accountAge[buckets.findIndex((bucket) => now - member.user.createdTimestamp < bucket.maxAgeMs)].count += 1;
  }

  const joinsRecorded = daily?.rows.reduce((sum, row) => sum + row.joins, 0) ?? 0;
  return {
    range,
    retention: daily && active !== null
      ? { joined: Math.max(joinsRecorded, joined.length), stillHere: joined.length, active }
      : null,
    inviters: inviters.map(([userId, count]) => ({ userId, name: names[userId] ?? userId, uses: count })),
    newest: newest.map((member) => ({
      userId: member.id,
      name: member.displayName,
      avatarUrl: member.displayAvatarURL(),
      joinedAt: new Date(member.joinedTimestamp ?? 0).toISOString(),
    })),
    accountAge,
  };
}

/** Id from a stored id or a "tag (id)" string. */
const idFrom = (id: string | undefined, tag: string | undefined): string | null =>
  id ?? tag?.match(/\((\d{17,20})\)\s*$/)?.[1] ?? null;

async function readModeration(client: NexoClient, guild: Guild, range: InsightRange): Promise<ModerationInsights> {
  const start = addDays(dayKey(), -(range - 1));
  const cases = (await section('Moderation', () => getModerationCases(guild.id, { limit: SCAN_LIMIT }))) ?? [];
  const inRange = cases.filter((entry) => dayKey(new Date(entry.createdAt)) >= start);
  const byModerator = tally(inRange.map((entry) => idFrom(entry.moderatorId, entry.executor))).slice(0, TOP);
  const topTargets = tally(inRange.map((entry) => idFrom(entry.targetUserId ?? entry.metadata?.userId, entry.target))).slice(0, TOP);
  const ids = [...byModerator, ...topTargets].map(([id]) => id).filter((id): id is string => id !== null);
  const names = await resolveNames(client, guild, ids);
  const nameOf = (id: string | null) => (id ? names[id] ?? id : 'Unbekannt');
  return {
    range,
    byModerator: byModerator.map(([moderatorId, count]) => ({ moderatorId, name: nameOf(moderatorId), count })),
    byAction: tally(inRange.map((entry) => entry.action)).map(([action, count]) => ({ action, label: ACTION_LABELS[action] ?? action, count })),
    topTargets: topTargets.map(([userId, count]) => ({ userId, name: nameOf(userId), count })),
  };
}

async function readProfile(client: NexoClient, guild: Guild, userId: string, range: InsightRange): Promise<MemberProfile> {
  const member = guild.members.cache.get(userId) ?? await guild.members.fetch(userId).catch(() => null);
  const user = member?.user ?? await client.users.fetch(userId).catch(() => null);
  if (!user) throw new HttpError(404, 'Dieses Mitglied gibt es nicht (mehr).');

  const [leveling, economy, cases, warnings, notes, tickets, applications, birthday, activity] = await Promise.all([
    section('Leveling', async () => {
      const data = await getUserLevelData(client, guild.id, userId);
      if (!data.totalXp && !data.level) return null;
      return { level: data.level, xp: data.xp, totalXp: data.totalXp, rank: await getRank(client, guild.id, userId) };
    }),
    section('Economy', () => client.db.get<{ wallet?: number; bank?: number }>(getEconomyKey(guild.id, userId))),
    section('Moderation', () => getModerationCases(guild.id, { userId, limit: SCAN_LIMIT })),
    section('Verwarnungen', () => WarningService.getWarningCount(guild.id, userId)),
    section('Notizen', () => getUserNotes(guild.id, userId)),
    section('Tickets', () => listGuildTickets(guild.id)),
    section('Bewerbungen', () => getApplications(client, guild.id, { userId, limit: SCAN_LIMIT })),
    section('Geburtstage', () => getUserBirthday(client, guild.id, userId)),
    readActivity(client, guild, range, userId),
  ]);
  const ownTickets = tickets && tickets.filter((ticket) => ticket.userId === userId);

  return {
    userId,
    name: member?.displayName ?? user.globalName ?? user.username,
    username: user.username,
    avatarUrl: (member ?? user).displayAvatarURL(),
    bot: user.bot,
    inGuild: Boolean(member),
    joinedAt: member?.joinedAt?.toISOString() ?? null,
    accountCreatedAt: user.createdAt.toISOString(),
    roles: member
      ? [...member.roles.cache.values()]
        .filter((role) => role.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map((role) => ({ id: role.id, name: role.name, color: role.hexColor }))
      : [],
    // Nothing records who invited whom yet.
    invitedBy: null,
    leveling,
    economy: economy && { wallet: economy.wallet ?? 0, bank: economy.bank ?? 0 },
    moderation: {
      cases: cases?.length ?? 0,
      warnings: warnings ?? 0,
      notes: notes?.length ?? 0,
      lastCaseAt: cases?.[0]?.createdAt ?? null,
    },
    tickets: ownTickets && { open: ownTickets.filter((ticket) => ticket.status === 'open').length, total: ownTickets.length },
    applications: applications && {
      total: applications.length,
      pending: applications.filter((application) => application.status === 'pending').length,
    },
    birthday: birthday && { month: birthday.month, day: birthday.day },
    activity,
  };
}

export const insightsModule: DashboardModule = {
  id: 'insights',
  router: (client) => {
    const router = express.Router();
    router.get('/', async (req, res) => {
      res.json(await readInsights(client, locals(res).guild, parseRange(req.query.range)));
    });

    router.get('/settings', async (_req, res) => {
      res.json(await readSettings(client, locals(res).guild));
    });

    router.put('/settings', async (req, res) => {
      const { guild } = locals(res);
      const memberTracking = bool(body(req.body).memberTracking, 'Mitglieder-Statistik');
      await patchGuildConfig(client, guild.id, { insights: { memberTracking } });
      setMemberTrackingCache(guild.id, memberTracking);
      if (!memberTracking) {
        // ponytail: a flush already running when this lands can still write one more minute of member rows.
        await deleteMemberStats(guild.id).catch((error: unknown) => {
          logger.warn('Mitglieder-Statistiken konnten nicht gelöscht werden:', (error as Error).message);
          throw new HttpError(503, 'Die gespeicherten Mitglieder-Statistiken konnten nicht gelöscht werden. Versuch es gleich noch mal.');
        });
      }
      res.json(await readSettings(client, guild));
    });

    router.get('/activity', async (req, res) => {
      const range = parseRange(req.query.range);
      const userId = req.query.userId === undefined || req.query.userId === '' ? null : parseUserId(req.query.userId);
      res.json(await readActivity(client, locals(res).guild, range, userId));
    });

    router.get('/members/search', async (req, res) => {
      const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
      res.json(await searchMembers(locals(res).guild, query));
    });

    router.get('/members', async (req, res) => {
      res.json(await readMembers(client, locals(res).guild, parseRange(req.query.range)));
    });

    router.get('/moderation', async (req, res) => {
      res.json(await readModeration(client, locals(res).guild, parseRange(req.query.range)));
    });

    router.get('/members/:userId', async (req, res) => {
      res.json(await readProfile(client, locals(res).guild, parseUserId(req.params.userId), parseRange(req.query.range)));
    });
    return router;
  },
};
