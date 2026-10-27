// Daily quests: three small tasks per member and Berlin day, picked from QUESTS by a hash of user and day (so
// nothing has to be stored for the pick). Progress is today's share of the activity counters, kept in user_stats as
// `q:<day>:<counter>` next to the lifetime counters; finished quests are marked as `q:<day>:done:<id>` and paid
// once (not capped). All three done pays a bonus, a portion of pet food (services/cosmetics/pets.ts) and counts a quest
// day for the achievements.

import { createHash } from 'node:crypto';
import type { DailyQuests } from '../../web/dto/profile.js';
import { logger } from '../../utils/logger.js';
import type { ActivityCounter } from './activity.js';
import { T, cosmeticsPool, requirePool, withTx } from './db.js';
import { berlinDay, nextBerlinMidnight, shiftDay } from './time.js';
import { earnTx } from './wallet.js';
import { addSeasonPoints } from './season.js';
import { grantPetFood } from './pets.js';
import { SEASON_POINTS } from '../../shared/season.js';

interface QuestDef { id: string; label: string; counters: ActivityCounter[]; target: number; reward: number }

const GAMES: ActivityCounter[] = ['game_work', 'game_fish', 'game_mine', 'game_gamble', 'game_crime', 'game_rob', 'game_beg', 'game_daily', 'game_fight', 'game_flip', 'game_roll', 'game_duel'];

/** Only tasks every member can do on any server (no voice or counting: not every server has them). */
export const QUESTS: QuestDef[] = [
  { id: 'chat', label: 'Schreib 25 Nachrichten', counters: ['messages'], target: 25, reward: 30 },
  { id: 'chat_more', label: 'Schreib 60 Nachrichten', counters: ['messages'], target: 60, reward: 45 },
  { id: 'reply', label: 'Antworte 5-mal auf andere', counters: ['msg_reply'], target: 5, reward: 25 },
  { id: 'question', label: 'Stell 3 Fragen', counters: ['msg_question'], target: 3, reward: 20 },
  { id: 'react', label: 'Reagiere 10-mal mit einem Emoji', counters: ['reactions'], target: 10, reward: 20 },
  { id: 'emoji', label: 'Nutze Emojis in 5 Nachrichten', counters: ['msg_emoji'], target: 5, reward: 15 },
  { id: 'media', label: 'Teile 2 Bilder oder Videos', counters: ['msg_media'], target: 2, reward: 20 },
  { id: 'long', label: 'Schreib eine Nachricht mit 300 Zeichen', counters: ['msg_long'], target: 1, reward: 20 },
  { id: 'games', label: 'Spiel 3 Minispiele', counters: GAMES, target: 3, reward: 30 },
  { id: 'commands', label: 'Nutze 5 Nexo-Befehle', counters: ['commands'], target: 5, reward: 20 },
];
export const QUESTS_PER_DAY = 3;
export const QUEST_BONUS = 50;

/** Counters that also count towards today's quests. */
export const QUEST_COUNTERS = new Set<ActivityCounter>(QUESTS.flatMap((quest) => quest.counters));

export const dailyStat = (day: string, counter: string) => `q:${day}:${counter}`;
const doneStat = (day: string, id: string) => `q:${day}:done:${id}`;

/** Today's three quests for a member (deterministic; never two with the same counters). */
export function questsFor(userId: string, day: string): QuestDef[] {
  const scored = QUESTS.map((quest) => ({ quest, score: createHash('sha256').update(`${userId}:${day}:${quest.id}`).digest().readUInt32BE(0) }))
    .sort((a, b) => a.score - b.score);
  const picked: QuestDef[] = [];
  for (const { quest } of scored) {
    if (picked.some((other) => other.counters[0] === quest.counters[0])) continue;
    picked.push(quest);
    if (picked.length === QUESTS_PER_DAY) break;
  }
  return picked;
}

/** Progress from today's counters (stored plus not yet flushed). Pure, for tests. */
export function questProgress(quests: QuestDef[], counts: Map<string, number>, done: Set<string>) {
  return quests.map((quest) => {
    const current = quest.counters.reduce((sum, counter) => sum + (counts.get(counter) ?? 0), 0);
    return { id: quest.id, label: quest.label, target: quest.target, reward: quest.reward, current: Math.min(current, quest.target), done: done.has(quest.id) || current >= quest.target };
  });
}

async function readDay(userId: string, day: string, pending: Map<string, number>) {
  const result = await requirePool().query<{ stat: string; value: string }>(
    `SELECT stat, value FROM ${T.user_stats} WHERE user_id = $1 AND stat LIKE $2`, [userId, `q:${day}:%`],
  );
  const counts = new Map(pending);
  const paid = new Set<string>();
  for (const row of result.rows) {
    const rest = row.stat.slice(`q:${day}:`.length);
    if (rest.startsWith('done:')) paid.add(rest.slice(5));
    else counts.set(rest, (counts.get(rest) ?? 0) + Number(row.value));
  }
  return { counts, paid };
}

/** Today's quests for the dashboard and /profil aufgaben (`pending`: today's counts not flushed yet). */
export async function getDailyQuests(userId: string, pending: Map<string, number> = new Map(), now = new Date()): Promise<DailyQuests> {
  const day = berlinDay(now);
  const { counts, paid } = await readDay(userId, day, pending);
  return {
    quests: questProgress(questsFor(userId, day), counts, paid),
    bonus: { reward: QUEST_BONUS, done: paid.has('all') },
    resetsAt: nextBerlinMidnight(now).toISOString(),
  };
}

/** Pays every quest of today that is finished and not paid yet (after each activity flush). Never throws. */
export async function syncQuests(userId: string): Promise<string[]> {
  if (!cosmeticsPool()) return [];
  try {
    const day = berlinDay();
    const { counts, paid } = await readDay(userId, day, new Map());
    const quests = questProgress(questsFor(userId, day), counts, new Set());
    const due = quests.filter((quest) => quest.done && !paid.has(quest.id));
    if (due.length === 0) return [];
    const allDone = quests.every((quest) => quest.done) && !paid.has('all');
    const newly = await withTx(async (client) => {
      const newly: string[] = [];
      for (const quest of [...due, ...(allDone ? [{ id: 'all', label: 'Alle Tagesaufgaben', reward: QUEST_BONUS }] : [])]) {
        // The marker row makes paying idempotent across overlapping flushes.
        const marked = await client.query(
          `INSERT INTO ${T.user_stats} (user_id, stat, value) VALUES ($1, $2, 1) ON CONFLICT DO NOTHING`, [userId, doneStat(day, quest.id)],
        );
        if (!marked.rowCount) continue;
        await earnTx(client, userId, quest.reward, 'quest', quest.id === 'all' ? 'Bonus: alle Tagesaufgaben geschafft' : `Tagesaufgabe: ${quest.label}`, null);
        if (quest.id === 'all') {
          await grantPetFood(client, userId);
          await client.query(
            `INSERT INTO ${T.user_stats} AS s (user_id, stat, value) VALUES ($1, 'quest_days', 1)
             ON CONFLICT (user_id, stat) DO UPDATE SET value = s.value + 1`, [userId],
          );
        }
        newly.push(quest.id);
      }
      return newly;
    });
    await addSeasonPoints(userId, newly.reduce((sum, id) => sum + (id === 'all' ? SEASON_POINTS.allQuests : SEASON_POINTS.quest), 0));
    return newly;
  } catch (error) {
    logger.warn('Tagesaufgaben konnten nicht geprüft werden:', (error as Error).message);
    return [];
  }
}

/** Drops the per-day quest rows older than yesterday (once a day). */
export async function purgeOldQuestStats(now = new Date()): Promise<void> {
  const pool = cosmeticsPool();
  if (!pool) return;
  await pool.query(`DELETE FROM ${T.user_stats} WHERE stat LIKE 'q:%' AND split_part(stat, ':', 2) < $1`, [shiftDay(berlinDay(now), -1)]);
}
