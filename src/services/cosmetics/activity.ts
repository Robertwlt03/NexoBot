// Lifetime activity counters for achievements: messages (by time of day and kind), chat streak, reactions, voice,
// slash commands, counting and mini games. Buffered in memory and written once a minute (like
// services/statsTracker.ts); after each write the achievements of everyone who was active catch up.

import type { Message } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { syncAchievements } from './achievements.js';
import { QUEST_COUNTERS, dailyStat, purgeOldQuestStats, syncQuests } from './quests.js';
import { T, cosmeticsPool } from './db.js';
import { berlinDay, berlinParts } from './time.js';

export const GAME_IDS = ['work', 'fish', 'mine', 'gamble', 'crime', 'rob', 'beg', 'daily', 'fight', 'flip', 'roll', 'duel'] as const;

/** Counters that only ever grow by the amounts recorded here. */
export const ACTIVITY_COUNTERS = [
  'messages', 'msg_night', 'msg_early', 'msg_midnight', 'msg_leet', 'msg_weekend', 'msg_morning', 'msg_reply', 'msg_question',
  'msg_long', 'msg_media', 'msg_emoji', 'msg_link', 'msg_caps', 'reactions', 'voice_ms', 'commands', 'counting', 'quest_days',
  ...GAME_IDS.map((game) => `game_${game}` as const),
] as const;
export type ActivityCounter = (typeof ACTIVITY_COUNTERS)[number];
/** Kept by the flush itself: distinct chat days and the streak of consecutive ones (Berlin days). */
export const CHAT_STATS = ['chat_days', 'chat_streak', 'chat_streak_best', 'chat_last_day'] as const;

const FLUSH_MS = 60_000;
const MORNING_GREETING = /^(guten morgen|moin|morgen|gm|good morning)\b/i;
const EMOJI = /\p{Extended_Pictographic}|<a?:\w+:\d+>/u;

/** Lifetime counters plus today's quest counters (`q:<day>:<counter>`) per user. */
let pending = new Map<string, Map<string, number>>();
/** Users who chatted, with the Berlin day number of their latest message since the last flush. */
let chatDays = new Map<string, number>();

function bump(userId: string, stat: string, amount: number): void {
  let stats = pending.get(userId);
  if (!stats) pending.set(userId, stats = new Map());
  stats.set(stat, (stats.get(stat) ?? 0) + amount);
}

export function addActivity(userId: string, stat: ActivityCounter, amount = 1): void {
  if (!cosmeticsPool() || amount <= 0) return;
  bump(userId, stat, amount);
  if (QUEST_COUNTERS.has(stat)) bump(userId, dailyStat(berlinDay(), stat), amount);
}

/** Today's quest counts of a user that are not written yet (so the dashboard shows them right away). */
export function pendingQuestCounts(userId: string, day = berlinDay()): Map<string, number> {
  const prefix = dailyStat(day, '');
  return new Map([...(pending.get(userId) ?? [])].filter(([stat]) => stat.startsWith(prefix)).map(([stat, value]) => [stat.slice(prefix.length), value]));
}

const dayNumber = (year: number, month: number, day: number) => Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);

/** Which counters one message moves (Berlin time). Pure, for tests. */
export function messageCounters(content: string, at: Date, kind: { reply: boolean; media: boolean }): ActivityCounter[] {
  const { year, month, day, hour, minute } = berlinParts(at);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const text = content.trim();
  const letters = text.replace(/[^\p{L}]/gu, '');
  const checks: [ActivityCounter, boolean][] = [
    ['messages', true],
    ['msg_night', hour < 5],
    ['msg_early', hour === 5 || hour === 6],
    ['msg_midnight', hour === 0 && minute === 0],
    ['msg_leet', hour === 13 && minute === 37],
    ['msg_weekend', weekday === 0 || weekday === 6],
    ['msg_morning', hour >= 5 && hour < 11 && MORNING_GREETING.test(text)],
    ['msg_reply', kind.reply],
    ['msg_question', text.endsWith('?')],
    ['msg_long', text.length >= 300],
    ['msg_media', kind.media],
    ['msg_emoji', EMOJI.test(text)],
    ['msg_link', /https?:\/\/\S+/i.test(text)],
    ['msg_caps', letters.length >= 10 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()],
  ];
  return checks.filter(([, hit]) => hit).map(([stat]) => stat);
}

export function recordMessageActivity(message: Message): void {
  if (message.author.bot || !cosmeticsPool()) return;
  const at = new Date(message.createdTimestamp);
  const media = message.attachments.some((file) => /^(image|video)\//.test(file.contentType ?? ''));
  for (const stat of messageCounters(message.content, at, { reply: Boolean(message.reference?.messageId), media })) addActivity(message.author.id, stat);
  const { year, month, day } = berlinParts(at);
  chatDays.set(message.author.id, dayNumber(year, month, day));
}

/** Next chat-streak values after chatting on `today` (pure, for tests). */
export function nextChatStreak(current: Record<(typeof CHAT_STATS)[number], number>, today: number): Record<(typeof CHAT_STATS)[number], number> {
  if (current.chat_last_day === today) return current;
  const streak = current.chat_last_day === today - 1 ? current.chat_streak + 1 : 1;
  return { chat_days: current.chat_days + 1, chat_streak: streak, chat_streak_best: Math.max(current.chat_streak_best, streak), chat_last_day: today };
}

let flushing = false;

/** Writes the buffered counters and the chat streaks, then syncs the achievements of everyone involved. */
export async function flushActivity(): Promise<void> {
  const pool = cosmeticsPool();
  if (flushing || !pool) return;
  flushing = true;
  const batch = pending;
  const days = chatDays;
  pending = new Map();
  chatDays = new Map();
  try {
    const rows = [...batch].flatMap(([userId, stats]) => [...stats].map(([stat, value]) => [userId, stat, value] as const));
    if (rows.length) {
      await pool.query(
        `INSERT INTO ${T.user_stats} AS s (user_id, stat, value) SELECT * FROM unnest($1::text[], $2::text[], $3::bigint[])
         ON CONFLICT (user_id, stat) DO UPDATE SET value = s.value + EXCLUDED.value`,
        [rows.map((row) => row[0]), rows.map((row) => row[1]), rows.map((row) => row[2])],
      );
    }
    if (days.size) {
      const users = [...days.keys()];
      const stored = await pool.query<{ user_id: string; stat: string; value: string }>(
        `SELECT user_id, stat, value FROM ${T.user_stats} WHERE user_id = ANY($1::text[]) AND stat = ANY($2::text[])`,
        [users, [...CHAT_STATS]],
      );
      const current = new Map(users.map((id) => [id, Object.fromEntries(CHAT_STATS.map((stat) => [stat, 0])) as Record<(typeof CHAT_STATS)[number], number>]));
      for (const row of stored.rows) current.get(row.user_id)![row.stat as (typeof CHAT_STATS)[number]] = Number(row.value);
      const next = users.flatMap((id) => Object.entries(nextChatStreak(current.get(id)!, days.get(id)!)).map(([stat, value]) => [id, stat, value] as const));
      await pool.query(
        `INSERT INTO ${T.user_stats} AS s (user_id, stat, value) SELECT * FROM unnest($1::text[], $2::text[], $3::bigint[])
         ON CONFLICT (user_id, stat) DO UPDATE SET value = EXCLUDED.value`,
        [next.map((row) => row[0]), next.map((row) => row[1]), next.map((row) => row[2])],
      );
    }
  } catch (error) {
    // Put the counters back; the next flush retries. Chat days are only lost for this minute (same day = no change).
    for (const [userId, stats] of batch) for (const [stat, value] of stats) bump(userId, stat, value);
    for (const [userId, day] of days) if (!chatDays.has(userId)) chatDays.set(userId, day);
    logger.warn('Aktivitätszähler konnten nicht gespeichert werden (wird wiederholt):', (error as Error).message);
    flushing = false;
    return;
  }
  flushing = false;
  // ponytail: one sync per active user and minute, sequentially; batch the stat reads if the bot grows large.
  for (const userId of new Set([...batch.keys(), ...days.keys()])) {
    await syncQuests(userId);
    await syncAchievements(userId);
  }
  const today = berlinDay();
  if (purgedDay !== today) {
    purgedDay = today;
    await purgeOldQuestStats().catch((error: unknown) => logger.warn('Alte Tagesaufgaben-Zähler konnten nicht gelöscht werden:', (error as Error).message));
  }
}

let purgedDay: string | null = null;

let timer: NodeJS.Timeout | null = null;

export function startActivityTracker(): void {
  if (timer || !cosmeticsPool()) return;
  timer = setInterval(() => { void flushActivity(); }, FLUSH_MS);
  timer.unref();
}

export async function stopActivityTracker(): Promise<void> {
  if (timer) clearInterval(timer);
  timer = null;
  await flushActivity();
}
