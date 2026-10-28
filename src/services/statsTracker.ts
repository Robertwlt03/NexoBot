// Daily server statistics for the dashboard (Statistiken): joins, leaves, messages, active members, voice minutes and
// the member count per guild and UTC day. Events only touch in-memory buffers; flushStats() writes them to
// guild_daily_stats every 60 s in a single UPSERT. Without PostgreSQL (degraded in-memory mode) nothing is recorded.
//
// Detail tables (v3 insights-detail), flushed in the same run with one UPSERT per table: messages per channel and day
// and per guild and UTC hour (always), messages per member and day/hour plus voice minutes per member and day (only
// while the guild's `insights.memberTracking` is not false). Never message content. Detail rows older than
// DETAIL_RETENTION_DAYS are purged once per day; guild_daily_stats is kept.

import { Events } from 'discord.js';
import type { Client, Message, VoiceState } from 'discord.js';
import type pg from 'pg';
import { db } from '../utils/database/wrapper.js';
import { pgConfig } from '../config/database/postgres.js';
import { getGuildConfig } from './config/guildConfig.js';
import { DETAIL_RETENTION_DAYS, type ActivityHeatmap } from '../web/dto/insightsDetail.js';
import { INSIGHT_RANGES, type InsightRange } from '../web/dto/insights.js';
import { logger } from '../utils/logger.js';
import { addActivity } from './cosmetics/activity.js';

export const FLUSH_INTERVAL_MS = 60_000;
const MINUTE_MS = 60_000;
const TABLE = pgConfig.tables.guild_daily_stats;
const MEMBER_DAILY = pgConfig.tables.member_daily_stats;
const MEMBER_HOURLY = pgConfig.tables.member_hourly_stats;
const CHANNEL_DAILY = pgConfig.tables.channel_daily_stats;
const GUILD_HOURLY = pgConfig.tables.guild_hourly_stats;
const DETAIL_TABLES = [MEMBER_DAILY, MEMBER_HOURLY, CHANNEL_DAILY, GUILD_HOURLY];
const TRACKING_TTL_MS = 10 * 60_000;

export interface DayCounters {
  joins: number;
  leaves: number;
  messages: number;
  /** Voice time in ms; whole minutes are written, the rest stays buffered. */
  voiceMs: number;
}

export interface DailyStatsRow {
  day: string;
  joins: number;
  leaves: number;
  messages: number;
  activeMembers: number;
  voiceMinutes: number;
  memberCount: number | null;
}

const EMPTY: DayCounters = { joins: 0, leaves: 0, messages: 0, voiceMs: 0 };

// ---------- Pure helpers (tested in tests/statsTracker.test.ts) ----------

/** UTC day as YYYY-MM-DD. */
export const dayKey = (time: Date | number = Date.now()): string => new Date(time).toISOString().slice(0, 10);

export function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return dayKey(date);
}

export function mergeCounters(a: DayCounters, b: Partial<DayCounters>): DayCounters {
  return {
    joins: a.joins + (b.joins ?? 0),
    leaves: a.leaves + (b.leaves ?? 0),
    messages: a.messages + (b.messages ?? 0),
    voiceMs: a.voiceMs + (b.voiceMs ?? 0),
  };
}

/**
 * One entry per day for the `days` days ending at `endDay`; missing days are zero. The member count is carried
 * forward from the last known value (rows before the range count too) and stays null until one is known.
 */
export function fillDays(rows: DailyStatsRow[], endDay: string, days: number): DailyStatsRow[] {
  const start = addDays(endDay, -(days - 1));
  const sorted = [...rows].sort((a, b) => a.day.localeCompare(b.day));
  const byDay = new Map(sorted.map((row) => [row.day, row]));
  let memberCount: number | null = null;
  for (const row of sorted) {
    if (row.day < start && row.memberCount !== null) memberCount = row.memberCount;
  }
  return Array.from({ length: days }, (_, index) => {
    const day = addDays(start, index);
    const row = byDay.get(day);
    if (row?.memberCount != null) memberCount = row.memberCount;
    return {
      day,
      joins: row?.joins ?? 0,
      leaves: row?.leaves ?? 0,
      messages: row?.messages ?? 0,
      activeMembers: row?.activeMembers ?? 0,
      voiceMinutes: row?.voiceMinutes ?? 0,
      memberCount,
    };
  });
}

/** Detail rows with a day before this one are purged. */
export const retentionCutoff = (today: string = dayKey()): string => addDays(today, -DETAIL_RETENTION_DAYS);

/** `range` query value: 7, 30 or 90; missing → 30, anything else → null. */
export function insightRangeOf(value: unknown): InsightRange | null {
  if (value === undefined || value === '') return 30;
  return INSIGHT_RANGES.find((range) => String(range) === value) ?? null;
}

const BERLIN = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', weekday: 'short', hour: 'numeric', hourCycle: 'h23' });
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** Weekday (0 = Monday) and hour in Europe/Berlin for a UTC day and hour (daylight saving time included). */
export function berlinSlot(day: string, utcHour: number): { weekday: number; hour: number } {
  const parts = BERLIN.formatToParts(new Date(`${day}T${String(utcHour).padStart(2, '0')}:00:00Z`));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? '';
  return { weekday: WEEKDAYS.indexOf(part('weekday')), hour: Number(part('hour')) % 24 };
}

/** heatmap[weekday][hour] in Berlin time from UTC hourly rows. */
export function buildHeatmap(rows: HourlyRow[]): ActivityHeatmap {
  const heatmap = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const row of rows) {
    const { weekday, hour } = berlinSlot(row.day, row.hour);
    heatmap[weekday][hour] += row.messages;
  }
  return heatmap;
}

// ---------- Buffers ----------

/** Key `${guildId}|${day}`. */
let counters = new Map<string, DayCounters>();
/** Distinct message authors per guild and day (approximate: per process, reset on restart). */
const authors = new Map<string, Set<string>>();
/** Members in a counted voice channel, key `${guildId}|${userId}`; `since` moves forward on every flush. */
const voiceSessions = new Map<string, { guildId: string; since: number }>();
/** Messages, key `${guildId}|${channelId}|${day}`. */
let channelDays = new Map<string, number>();
/** Messages, key `${guildId}|${day}|${utcHour}`. */
let guildHours = new Map<string, number>();
/** Key `${guildId}|${userId}|${day}`; dropped at flush time for guilds with member tracking off. */
let memberDays = new Map<string, { messages: number; voiceMs: number }>();
/** Messages, key `${guildId}|${userId}|${day}|${utcHour}`. */
let memberHours = new Map<string, number>();

function bump(guildId: string, change: Partial<DayCounters>, time = Date.now()) {
  const key = `${guildId}|${dayKey(time)}`;
  counters.set(key, mergeCounters(counters.get(key) ?? EMPTY, change));
}

const add = (map: Map<string, number>, key: string, amount: number) => map.set(key, (map.get(key) ?? 0) + amount);

function bumpMember(key: string, messages: number, voiceMs: number) {
  const current = memberDays.get(key) ?? { messages: 0, voiceMs: 0 };
  memberDays.set(key, { messages: current.messages + messages, voiceMs: current.voiceMs + voiceMs });
}

/** Voice time of one session (key `${guildId}|${userId}`) for the guild and the member. */
function addVoice(key: string, guildId: string, ms: number, now: number) {
  bump(guildId, { voiceMs: ms }, now);
  addActivity(key.split('|')[1], 'voice_ms', ms);
  bumpMember(`${key}|${dayKey(now)}`, 0, ms);
}

// ---------- Member tracking setting (guild config `insights.memberTracking`, default true) ----------

const trackingCache = new Map<string, { value: boolean; at: number }>();

/** Called by the dashboard after the setting changed. */
export function setMemberTrackingCache(guildId: string, value: boolean): void {
  trackingCache.set(guildId, { value, at: Date.now() });
  if (value) return;
  for (const key of memberDays.keys()) if (key.startsWith(`${guildId}|`)) memberDays.delete(key);
  for (const key of memberHours.keys()) if (key.startsWith(`${guildId}|`)) memberHours.delete(key);
}

export async function isMemberTrackingEnabled(client: Client, guildId: string): Promise<boolean> {
  const cached = trackingCache.get(guildId);
  if (cached && Date.now() - cached.at < TRACKING_TTL_MS) return cached.value;
  let value = true;
  if (client.isReady()) {
    try {
      value = (await getGuildConfig(client, guildId)).insights?.memberTracking !== false;
    } catch {
      return cached?.value ?? true;
    }
  }
  trackingCache.set(guildId, { value, at: Date.now() });
  return value;
}

function statsPool(): pg.Pool | null {
  return db.connectionType === 'postgresql' ? db.db?.pool ?? null : null;
}

export function recordJoin(guild: { id: string }): void {
  bump(guild.id, { joins: 1 });
}

export function recordLeave(guild: { id: string }): void {
  bump(guild.id, { leaves: 1 });
}

export function recordMessage(message: Message): void {
  if (!message.inGuild() || message.author.bot) return;
  const now = Date.now();
  bump(message.guildId, { messages: 1 }, now);
  const day = dayKey(now);
  const hour = new Date(now).getUTCHours();
  const key = `${message.guildId}|${day}`;
  let set = authors.get(key);
  if (!set) authors.set(key, set = new Set());
  set.add(message.author.id);

  // Threads count towards their parent channel.
  const channelId = (message.channel.isThread() ? message.channel.parentId : null) ?? message.channelId;
  add(channelDays, `${message.guildId}|${channelId}|${day}`, 1);
  add(guildHours, `${message.guildId}|${day}|${hour}`, 1);
  bumpMember(`${message.guildId}|${message.author.id}|${day}`, 1, 0);
  add(memberHours, `${message.guildId}|${message.author.id}|${day}|${hour}`, 1);
}

/** Voice channels count, except the server's AFK channel. */
const countsAsVoice = (state: VoiceState) => Boolean(state.channelId && state.channelId !== state.guild.afkChannelId);

function endVoiceSession(key: string, now: number) {
  const session = voiceSessions.get(key);
  if (!session) return;
  addVoice(key, session.guildId, now - session.since, now);
  voiceSessions.delete(key);
}

export function recordVoiceState(oldState: VoiceState, newState: VoiceState): void {
  const member = newState.member ?? oldState.member;
  if (!member || member.user.bot) return;
  const key = `${newState.guild.id}|${member.id}`;
  const now = Date.now();
  endVoiceSession(key, now);
  if (countsAsVoice(newState)) voiceSessions.set(key, { guildId: newState.guild.id, since: now });
}

/** Members already in voice when the bot starts never fire voiceStateUpdate, so pick them up once. */
function seedVoiceSessions(client: Client) {
  const now = Date.now();
  for (const guild of client.guilds.cache.values()) {
    for (const state of guild.voiceStates.cache.values()) {
      if (state.member && !state.member.user.bot && countsAsVoice(state)) {
        voiceSessions.set(`${guild.id}|${state.id}`, { guildId: guild.id, since: now });
      }
    }
  }
}

// ---------- Flush ----------

let flushing = false;
let purgedDay: string | null = null;

/** Columns for unnest(): the `|`-separated key parts, then the value. */
function columnsOf<V>(entries: [string, V][], parts: number, value: (v: V) => number): unknown[][] {
  return [
    ...Array.from({ length: parts }, (_, index) => entries.map(([key]) => key.split('|')[index])),
    entries.map(([, v]) => value(v)),
  ];
}

async function upsert(pool: pg.Pool, sql: string, columns: unknown[][], restore: () => void): Promise<void> {
  if (!columns[0]?.length) return;
  try {
    await pool.query(sql, columns);
  } catch (error) {
    restore();
    logger.warn('Statistik-Flush (Details) fehlgeschlagen (wird wiederholt):', (error as Error).message);
  }
}

const restoreCounts = (target: () => Map<string, number>, pending: Map<string, number>) => () => {
  for (const [key, value] of pending) add(target(), key, value);
};

/** Writes channel/hour/member buffers (one UPSERT per table) and purges old detail rows once per day. */
async function flushDetail(client: Client, pool: pg.Pool, now: number): Promise<void> {
  const today = dayKey(now);
  const channels = channelDays;
  const hours = guildHours;
  const members = memberDays;
  const memberHourly = memberHours;
  channelDays = new Map();
  guildHours = new Map();
  memberDays = new Map();
  memberHours = new Map();

  const tracking = new Map<string, boolean>();
  for (const key of [...members.keys(), ...memberHourly.keys()]) {
    const guildId = key.split('|')[0];
    if (!tracking.has(guildId)) tracking.set(guildId, await isMemberTrackingEnabled(client, guildId));
  }
  const tracked = (key: string) => tracking.get(key.split('|')[0]) === true;

  await upsert(pool,
    `INSERT INTO ${CHANNEL_DAILY} AS s (guild_id, channel_id, day, messages)
     SELECT * FROM unnest($1::text[], $2::text[], $3::date[], $4::int[])
     ON CONFLICT (guild_id, channel_id, day) DO UPDATE SET messages = s.messages + EXCLUDED.messages`,
    columnsOf([...channels], 3, (v) => v), restoreCounts(() => channelDays, channels));

  await upsert(pool,
    `INSERT INTO ${GUILD_HOURLY} AS s (guild_id, day, hour, messages)
     SELECT * FROM unnest($1::text[], $2::date[], $3::smallint[], $4::int[])
     ON CONFLICT (guild_id, day, hour) DO UPDATE SET messages = s.messages + EXCLUDED.messages`,
    columnsOf([...hours], 3, (v) => v), restoreCounts(() => guildHours, hours));

  const hourEntries = [...memberHourly].filter(([key]) => tracked(key));
  await upsert(pool,
    `INSERT INTO ${MEMBER_HOURLY} AS s (guild_id, user_id, day, hour, messages)
     SELECT * FROM unnest($1::text[], $2::text[], $3::date[], $4::smallint[], $5::int[])
     ON CONFLICT (guild_id, user_id, day, hour) DO UPDATE SET messages = s.messages + EXCLUDED.messages`,
    columnsOf(hourEntries, 4, (v) => v), restoreCounts(() => memberHours, new Map(hourEntries)));

  // Whole voice minutes are written; today's remainder stays buffered (like guild_daily_stats).
  const dayEntries = [...members].filter(([key]) => tracked(key));
  const keepRest = () => {
    for (const [key, value] of dayEntries) {
      const rest = value.voiceMs % MINUTE_MS;
      if (rest > 0 && key.endsWith(today)) bumpMember(key, 0, rest);
    }
  };
  const writable = dayEntries.filter(([, v]) => v.messages > 0 || v.voiceMs >= MINUTE_MS);
  let failed = false;
  await upsert(pool,
    `INSERT INTO ${MEMBER_DAILY} AS s (guild_id, user_id, day, messages, voice_minutes)
     SELECT * FROM unnest($1::text[], $2::text[], $3::date[], $4::int[], $5::int[])
     ON CONFLICT (guild_id, user_id, day) DO UPDATE SET
       messages = s.messages + EXCLUDED.messages,
       voice_minutes = s.voice_minutes + EXCLUDED.voice_minutes`,
    [...columnsOf(writable, 3, (v) => v.messages), writable.map(([, v]) => Math.floor(v.voiceMs / MINUTE_MS))],
    () => {
      failed = true;
      for (const [key, value] of dayEntries) bumpMember(key, value.messages, value.voiceMs);
    });
  if (!failed) keepRest();

  if (purgedDay !== today) {
    purgedDay = today;
    await purgeDetailStats(pool, today);
  }
}

async function purgeDetailStats(pool: pg.Pool, today: string): Promise<void> {
  const cutoff = retentionCutoff(today);
  try {
    for (const table of DETAIL_TABLES) await pool.query(`DELETE FROM ${table} WHERE day < $1::date`, [cutoff]);
  } catch (error) {
    logger.warn('Statistik-Details konnten nicht bereinigt werden:', (error as Error).message);
  }
}

/** Writes the buffered counts (plus today's member count of every guild) in one UPSERT. */
export async function flushStats(client: Client): Promise<void> {
  if (flushing) return;
  flushing = true;
  const now = Date.now();
  const today = dayKey(now);
  try {
    for (const [key, session] of voiceSessions) {
      addVoice(key, session.guildId, now - session.since, now);
      session.since = now;
      // A leave missed during a gateway outage must not count forever.
      const state = client.guilds.cache.get(session.guildId)?.voiceStates.cache.get(key.split('|')[1]);
      if (!state || !countsAsVoice(state)) voiceSessions.delete(key);
    }
    const pending = counters;
    counters = new Map();

    const pool = statsPool();
    if (!pool) {
      authors.clear();
      channelDays = new Map();
      guildHours = new Map();
      memberDays = new Map();
      memberHours = new Map();
      return;
    }
    await flushDetail(client, pool, now);

    const rows = new Map<string, { counters: DayCounters; memberCount: number | null }>();
    for (const [key, value] of pending) rows.set(key, { counters: value, memberCount: null });
    for (const guild of client.guilds.cache.values()) {
      const key = `${guild.id}|${today}`;
      rows.set(key, { counters: rows.get(key)?.counters ?? EMPTY, memberCount: guild.memberCount });
    }
    if (rows.size === 0) return;

    const entries = [...rows];
    const columns = [
      entries.map(([key]) => key.split('|')[0]),
      entries.map(([key]) => key.split('|')[1]),
      entries.map(([, row]) => row.counters.joins),
      entries.map(([, row]) => row.counters.leaves),
      entries.map(([, row]) => row.counters.messages),
      entries.map(([key]) => authors.get(key)?.size ?? 0),
      entries.map(([, row]) => Math.floor(row.counters.voiceMs / MINUTE_MS)),
      entries.map(([, row]) => row.memberCount),
    ];

    try {
      await pool.query(
        `INSERT INTO ${TABLE} AS s (guild_id, day, joins, leaves, messages, active_members, voice_minutes, member_count)
         SELECT * FROM unnest($1::text[], $2::date[], $3::int[], $4::int[], $5::int[], $6::int[], $7::int[], $8::int[])
         ON CONFLICT (guild_id, day) DO UPDATE SET
           joins = s.joins + EXCLUDED.joins,
           leaves = s.leaves + EXCLUDED.leaves,
           messages = s.messages + EXCLUDED.messages,
           active_members = GREATEST(s.active_members, EXCLUDED.active_members),
           voice_minutes = s.voice_minutes + EXCLUDED.voice_minutes,
           member_count = COALESCE(EXCLUDED.member_count, s.member_count)`,
        columns,
      );
      // Keep today's partial voice minute for the next flush.
      for (const [key, value] of pending) {
        const rest = value.voiceMs % MINUTE_MS;
        if (rest > 0 && key.endsWith(today)) bump(key.split('|')[0], { voiceMs: rest }, now);
      }
    } catch (error) {
      // Put everything back; the next flush retries.
      for (const [key, value] of pending) counters.set(key, mergeCounters(counters.get(key) ?? EMPTY, value));
      logger.warn('Statistik-Flush fehlgeschlagen (wird wiederholt):', (error as Error).message);
    }

    for (const key of authors.keys()) {
      if (!key.endsWith(today)) authors.delete(key);
    }
  } finally {
    flushing = false;
  }
}

let timer: NodeJS.Timeout | null = null;

export function startStatsTracker(client: Client): void {
  if (timer) return;
  if (client.isReady()) seedVoiceSessions(client);
  else client.once(Events.ClientReady, () => seedVoiceSessions(client));
  timer = setInterval(() => { void flushStats(client); }, FLUSH_INTERVAL_MS);
  timer.unref();
}

/** Stops the interval and writes what is still buffered (ongoing voice sessions included). */
export async function stopStatsTracker(client: Client): Promise<void> {
  if (timer) clearInterval(timer);
  timer = null;
  await flushStats(client);
}

// ---------- Reads (dashboard) ----------

/** Recorded days in [fromDay, toDay] plus the first recorded day; null without PostgreSQL or before the migration. */
export async function readDailyStats(guildId: string, fromDay: string, toDay: string): Promise<{ rows: DailyStatsRow[]; trackingSince: string | null } | null> {
  const pool = statsPool();
  if (!pool) return null;
  try {
    const [range, first] = await Promise.all([
      pool.query<{ day: string; joins: number; leaves: number; messages: number; active_members: number; voice_minutes: number; member_count: number | null }>(
        `SELECT to_char(day, 'YYYY-MM-DD') AS day, joins, leaves, messages, active_members, voice_minutes, member_count
         FROM ${TABLE} WHERE guild_id = $1 AND day BETWEEN $2::date AND $3::date ORDER BY day`,
        [guildId, fromDay, toDay],
      ),
      pool.query<{ since: string | null }>(`SELECT to_char(MIN(day), 'YYYY-MM-DD') AS since FROM ${TABLE} WHERE guild_id = $1`, [guildId]),
    ]);
    return {
      rows: range.rows.map((row) => ({
        day: row.day,
        joins: row.joins,
        leaves: row.leaves,
        messages: row.messages,
        activeMembers: row.active_members,
        voiceMinutes: row.voice_minutes,
        memberCount: row.member_count,
      })),
      trackingSince: first.rows[0]?.since ?? null,
    };
  } catch (error) {
    logger.warn('Statistik-Verlauf konnte nicht gelesen werden:', (error as Error).message);
    return null;
  }
}

/** Deletes every recorded per-member row of a guild (member tracking turned off). */
export async function deleteMemberStats(guildId: string): Promise<void> {
  const pool = statsPool();
  if (!pool) return;
  await pool.query(`DELETE FROM ${MEMBER_DAILY} WHERE guild_id = $1`, [guildId]);
  await pool.query(`DELETE FROM ${MEMBER_HOURLY} WHERE guild_id = $1`, [guildId]);
}

export interface HourlyRow {
  /** UTC day, YYYY-MM-DD. */
  day: string;
  /** UTC hour 0–23. */
  hour: number;
  messages: number;
}

export interface MemberTotals {
  userId: string;
  messages: number;
  voiceMinutes: number;
}

export interface DetailStats {
  /** First day in guild_hourly_stats. */
  trackingSince: string | null;
  hourly: HourlyRow[];
  /** Days of the member (only with userId). */
  memberDays: { day: string; messages: number; voiceMinutes: number }[];
  /** Top 10 channels (only without userId). */
  channels: { channelId: string; messages: number }[];
  /** Top 10 members by messages / by voice minutes (only without userId). */
  topMessages: MemberTotals[];
  topVoice: MemberTotals[];
}

/** Detail rows in [fromDay, toDay] for the guild or one member; null without PostgreSQL or on error. */
export async function readDetailStats(guildId: string, fromDay: string, toDay: string, userId: string | null): Promise<DetailStats | null> {
  const pool = statsPool();
  if (!pool) return null;
  const range = [guildId, fromDay, toDay];
  const totals = (order: 'messages' | 'voice_minutes') => pool.query<{ user_id: string; messages: number; voice_minutes: number }>(
    `SELECT user_id, SUM(messages)::int AS messages, SUM(voice_minutes)::int AS voice_minutes FROM ${MEMBER_DAILY}
     WHERE guild_id = $1 AND day BETWEEN $2::date AND $3::date
     GROUP BY user_id HAVING SUM(${order}) > 0 ORDER BY SUM(${order}) DESC LIMIT 10`,
    range,
  );
  const toTotals = (rows: { user_id: string; messages: number; voice_minutes: number }[]) =>
    rows.map((row) => ({ userId: row.user_id, messages: row.messages, voiceMinutes: row.voice_minutes }));
  try {
    const [first, hourly, memberDays, channels, topMessages, topVoice] = await Promise.all([
      pool.query<{ since: string | null }>(`SELECT to_char(MIN(day), 'YYYY-MM-DD') AS since FROM ${GUILD_HOURLY} WHERE guild_id = $1`, [guildId]),
      userId
        ? pool.query<HourlyRow>(
          `SELECT to_char(day, 'YYYY-MM-DD') AS day, hour, messages FROM ${MEMBER_HOURLY}
           WHERE guild_id = $1 AND day BETWEEN $2::date AND $3::date AND user_id = $4`, [...range, userId])
        : pool.query<HourlyRow>(
          `SELECT to_char(day, 'YYYY-MM-DD') AS day, hour, messages FROM ${GUILD_HOURLY}
           WHERE guild_id = $1 AND day BETWEEN $2::date AND $3::date`, range),
      userId
        ? pool.query<{ day: string; messages: number; voice_minutes: number }>(
          `SELECT to_char(day, 'YYYY-MM-DD') AS day, messages, voice_minutes FROM ${MEMBER_DAILY}
           WHERE guild_id = $1 AND day BETWEEN $2::date AND $3::date AND user_id = $4`, [...range, userId])
        : null,
      userId ? null : pool.query<{ channel_id: string; messages: number }>(
        `SELECT channel_id, SUM(messages)::int AS messages FROM ${CHANNEL_DAILY}
         WHERE guild_id = $1 AND day BETWEEN $2::date AND $3::date
         GROUP BY channel_id ORDER BY SUM(messages) DESC LIMIT 10`, range),
      userId ? null : totals('messages'),
      userId ? null : totals('voice_minutes'),
    ]);
    return {
      trackingSince: first.rows[0]?.since ?? null,
      hourly: hourly.rows,
      memberDays: (memberDays?.rows ?? []).map((row) => ({ day: row.day, messages: row.messages, voiceMinutes: row.voice_minutes })),
      channels: (channels?.rows ?? []).map((row) => ({ channelId: row.channel_id, messages: row.messages })),
      topMessages: toTotals(topMessages?.rows ?? []),
      topVoice: toTotals(topVoice?.rows ?? []),
    };
  } catch (error) {
    logger.warn('Statistik-Details konnten nicht gelesen werden:', (error as Error).message);
    return null;
  }
}

/** How many of `userIds` wrote at least one message since `fromDay`; null without PostgreSQL or on error. */
export async function countActiveMembers(guildId: string, fromDay: string, userIds: string[]): Promise<number | null> {
  const pool = statsPool();
  if (!pool) return null;
  if (!userIds.length) return 0;
  try {
    const result = await pool.query<{ count: number }>(
      `SELECT COUNT(DISTINCT user_id)::int AS count FROM ${MEMBER_DAILY}
       WHERE guild_id = $1 AND day >= $2::date AND messages > 0 AND user_id = ANY($3::text[])`,
      [guildId, fromDay, userIds],
    );
    return result.rows[0]?.count ?? 0;
  } catch (error) {
    logger.warn('Statistik-Details konnten nicht gelesen werden:', (error as Error).message);
    return null;
  }
}
