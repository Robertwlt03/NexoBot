// "Dein Nexo-Jahr": a member's year in numbers for the year card (/profil jahr). Year-bound data comes from the
// transaction log, achievements and monthly scores; chat counters are lifetime values (the tracker only started in
// 2026, so for now lifetime and year are the same).

import { MONTH_NAMES } from '../../shared/season.js';
import type { YearReview } from '../../shared/profileCard.js';
import { GAME_IDS } from './activity.js';
import { T, requirePool } from './db.js';
import { berlinTime } from './time.js';

const GAME_NAMES: Record<(typeof GAME_IDS)[number], string> = {
  work: 'Arbeiten', fish: 'Angeln', mine: 'Bergbau', gamble: 'Glücksspiel', crime: 'Verbrechen', rob: 'Raub', beg: 'Betteln',
  daily: 'Tägliche Belohnung', fight: 'Duelle', flip: 'Münzwurf', roll: 'Würfeln', duel: 'Spiele gegen andere',
};

interface YearNumbers {
  earned: number; spent: number; purchases: number; achievements: number; xp: number; minigames: number;
  bestMonth: { month: number; xp: number } | null; topGuild: { guildId: string; xp: number } | null;
  counters: Map<string, number>;
}

/** Tiles and highlights from the raw numbers. Pure, for tests. */
export function buildYearReview(year: number, n: YearNumbers, guildName: (id: string) => string | null): YearReview {
  const counter = (stat: string) => n.counters.get(stat) ?? 0;
  const highlights: string[] = [];
  const guild = n.topGuild && guildName(n.topGuild.guildId);
  if (guild) highlights.push(`Dein Lieblingsserver: ${guild} mit ${n.topGuild!.xp.toLocaleString('de-DE')} XP`);
  if (n.bestMonth && n.bestMonth.xp > 0) highlights.push(`Dein stärkster Monat: ${MONTH_NAMES[n.bestMonth.month - 1]}`);
  const favourite = GAME_IDS.map((game) => ({ game, count: counter(`game_${game}`) })).sort((a, b) => b.count - a.count)[0];
  if (favourite && favourite.count > 0) highlights.push(`Dein Lieblingsspiel: ${GAME_NAMES[favourite.game]} (${favourite.count.toLocaleString('de-DE')}-mal)`);
  if (n.purchases > 0) highlights.push(`${n.purchases.toLocaleString('de-DE')} Artikel für deine Profilkarte geholt`);
  return {
    year,
    tiles: [
      { label: 'Nachrichten geschrieben', value: counter('messages') },
      { label: 'XP gesammelt', value: n.xp },
      { label: 'Bernis verdient', value: n.earned, coins: true },
      { label: 'Tage gechattet', value: counter('chat_days') },
      { label: 'Längste Chat-Serie', value: counter('chat_streak_best'), unit: counter('chat_streak_best') === 1 ? 'Tag' : 'Tage' },
      { label: 'Erfolge freigeschaltet', value: n.achievements },
    ],
    highlights: highlights.slice(0, 3),
  };
}

export async function loadYearReview(userId: string, year: number, guildName: (id: string) => string | null): Promise<YearReview> {
  const pool = requirePool();
  const from = berlinTime(year, 1, 1);
  const to = berlinTime(year + 1, 1, 1);
  const [wallet, achievements, months, guilds, counters] = await Promise.all([
    pool.query<{ earned: string | null; spent: string | null; purchases: string }>(
      `SELECT SUM(amount) FILTER (WHERE amount > 0) AS earned,
              SUM(-amount) FILTER (WHERE reason IN ('purchase', 'gift_sent')) AS spent,
              COUNT(*) FILTER (WHERE reason = 'purchase') AS purchases
       FROM ${T.wallet_transactions} WHERE user_id = $1 AND created_at >= $2 AND created_at < $3`,
      [userId, from, to],
    ),
    pool.query<{ count: string }>(`SELECT COUNT(*) AS count FROM ${T.user_achievements} WHERE user_id = $1 AND unlocked_at >= $2 AND unlocked_at < $3`, [userId, from, to]),
    pool.query<{ month: number; xp: string; points: string }>(
      `SELECT EXTRACT(MONTH FROM month)::int AS month, SUM(xp_gained) AS xp, SUM(minigame_points) AS points
       FROM ${T.monthly_scores} WHERE user_id = $1 AND EXTRACT(YEAR FROM month) = $2 GROUP BY 1 ORDER BY 2 DESC`,
      [userId, year],
    ),
    pool.query<{ guild_id: string; xp: string }>(
      `SELECT guild_id, SUM(xp_gained) AS xp FROM ${T.monthly_scores} WHERE user_id = $1 AND EXTRACT(YEAR FROM month) = $2
       GROUP BY guild_id ORDER BY 2 DESC LIMIT 5`,
      [userId, year],
    ),
    pool.query<{ stat: string; value: string }>(`SELECT stat, value FROM ${T.user_stats} WHERE user_id = $1 AND stat NOT LIKE '%:%'`, [userId]),
  ]);
  const row = wallet.rows[0];
  const topGuild = guilds.rows.find((entry) => guildName(entry.guild_id));
  return buildYearReview(year, {
    earned: Number(row?.earned ?? 0),
    spent: Number(row?.spent ?? 0),
    purchases: Number(row?.purchases ?? 0),
    achievements: Number(achievements.rows[0]?.count ?? 0),
    xp: months.rows.reduce((sum, entry) => sum + Number(entry.xp), 0),
    minigames: months.rows.reduce((sum, entry) => sum + Number(entry.points), 0),
    bestMonth: months.rows[0] ? { month: months.rows[0].month, xp: Number(months.rows[0].xp) } : null,
    topGuild: topGuild ? { guildId: topGuild.guild_id, xp: Number(topGuild.xp) } : null,
    counters: new Map(counters.rows.map((entry) => [entry.stat, Number(entry.value)])),
  }, guildName);
}
