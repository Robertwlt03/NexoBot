// Seasons: one per calendar month (Berlin). Season points come from the things Nexo already rewards; ten tiers pay
// Bernis, tier 5 a badge and tier 10 a title that only exist for that season. Shared by the bot and the dashboard.

import type { BadgeGlyph } from './cosmetics.js';

/** Season points per action. */
export const SEASON_POINTS = { quest: 10, allQuests: 15, daily: 10, minigame: 2, levelUp: 5, community: 25, duelWin: 5 } as const;

export interface SeasonTier { points: number; bernis: number; item: 'badge' | 'title' | null }

export const SEASON_TIERS: readonly SeasonTier[] = [
  { points: 40, bernis: 50, item: null },
  { points: 100, bernis: 75, item: null },
  { points: 180, bernis: 100, item: null },
  { points: 280, bernis: 125, item: null },
  { points: 400, bernis: 100, item: 'badge' },
  { points: 540, bernis: 150, item: null },
  { points: 700, bernis: 175, item: null },
  { points: 880, bernis: 200, item: null },
  { points: 1080, bernis: 250, item: null },
  { points: 1300, bernis: 400, item: 'title' },
];

/** Highest tier reached with `points` (0 = none). */
export function seasonTier(points: number): number {
  return SEASON_TIERS.filter((tier) => points >= tier.points).length;
}

export const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTH_LOOK: [BadgeGlyph, string][] = [
  ['snowflake', '#93C5FD'], ['heart', '#FB7185'], ['mask', '#C084FC'], ['egg', '#86EFAC'], ['sun', '#FDE047'], ['sun', '#FDBA74'],
  ['fish', '#38BDF8'], ['star', '#FCD34D'], ['leaf', '#F59E0B'], ['pumpkin', '#FB923C'], ['acorn', '#D6A06A'], ['tree', '#4ADE80'],
];

/** "2026-10" → the season's own badge and title (ids, names and looks). */
export function seasonItems(season: string) {
  const [year, month] = season.split('-').map(Number);
  const name = `${MONTH_NAMES[month - 1]} ${year}`;
  const [glyph, color] = MONTH_LOOK[month - 1];
  return {
    name,
    badge: { id: `season-badge-${season}`, name: `Saison ${name}`, description: `Stufe 5 im Saisonpfad ${name}.`, data: { glyph, color } },
    title: { id: `season-title-${season}`, name: `Saisonheld ${name}`, description: `Stufe 10 im Saisonpfad ${name}.`, data: { text: `Saisonheld ${name}`, color } },
  };
}
