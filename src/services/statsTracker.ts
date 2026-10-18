// Daily server statistics for the dashboard (Statistiken): joins, leaves, messages, active members, voice minutes and
// the member count per guild and UTC day. Events only touch in-memory buffers; flushStats() writes them to
// guild_daily_stats every 60 s in a single UPSERT. Without PostgreSQL (degraded in-memory mode) nothing is recorded.

import { Events } from 'discord.js';
import type { Client, Message, VoiceState } from 'discord.js';
import type pg from 'pg';
import { db } from '../utils/database/wrapper.js';
import { pgConfig } from '../config/database/postgres.js';
import { logger } from '../utils/logger.js';

export const FLUSH_INTERVAL_MS = 60_000;
const MINUTE_MS = 60_000;
const TABLE = pgConfig.tables.guild_daily_stats;

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

// ---------- Buffers ----------

/** Key `${guildId}|${day}`. */
let counters = new Map<string, DayCounters>();
/** Distinct message authors per guild and day (approximate: per process, reset on restart). */
const authors = new Map<string, Set<string>>();
/** Members in a counted voice channel, key `${guildId}|${userId}`; `since` moves forward on every flush. */
const voiceSessions = new Map<string, { guildId: string; since: number }>();

function bump(guildId: string, change: Partial<DayCounters>, time = Date.now()) {
  const key = `${guildId}|${dayKey(time)}`;
  counters.set(key, mergeCounters(counters.get(key) ?? EMPTY, change));
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
  const key = `${message.guildId}|${dayKey(now)}`;
  let set = authors.get(key);
  if (!set) authors.set(key, set = new Set());
  set.add(message.author.id);
}

/** Voice channels count, except the server's AFK channel. */
const countsAsVoice = (state: VoiceState) => Boolean(state.channelId && state.channelId !== state.guild.afkChannelId);

function endVoiceSession(key: string, now: number) {
  const session = voiceSessions.get(key);
  if (!session) return;
  bump(session.guildId, { voiceMs: now - session.since }, now);
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

/** Writes the buffered counts (plus today's member count of every guild) in one UPSERT. */
export async function flushStats(client: Client): Promise<void> {
  if (flushing) return;
  flushing = true;
  const now = Date.now();
  const today = dayKey(now);
  try {
    for (const [key, session] of voiceSessions) {
      bump(session.guildId, { voiceMs: now - session.since }, now);
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
      return;
    }

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
