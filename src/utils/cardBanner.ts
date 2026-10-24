// The banner on top of every Nexo card: one picture per accent colour (rendered by scripts/render-banners.ts),
// served by the dashboard. Discord has to fetch it, so it only appears when DASHBOARD_URL is a public https URL.

import { getEnv } from '../config/env.js';

/** Banner name → the accent colour it is drawn for (the palette in config/bot.ts). */
export const BANNERS = {
  nexo: 0x8FB36B, amber: 0xE8A33D, gold: 0xF5C451, success: 0x4ADE80, info: 0x7DA0C4,
  warn: 0xF59E0B, danger: 0xEF4444, calm: 0x94A3B8, pink: 0xF472B6,
} as const;

/** Bump when the PNGs change, so Discord's media cache fetches the new ones. */
const VERSION = 1;

/** The banner whose accent is closest to `color` (feature colours like ticket states map onto the nine). */
export function bannerName(color: number): keyof typeof BANNERS {
  const channels = (value: number) => [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  const [r, g, b] = channels(color);
  let best: keyof typeof BANNERS = 'nexo';
  let bestDistance = Infinity;
  for (const [name, accent] of Object.entries(BANNERS) as [keyof typeof BANNERS, number][]) {
    const [ar, ag, ab] = channels(accent);
    const distance = (r - ar) ** 2 + (g - ag) ** 2 + (b - ab) ** 2;
    if (distance < bestDistance) [best, bestDistance] = [name, distance];
  }
  return best;
}

/** Public URL of the banner for a card colour, or null when Discord could not fetch it (no https dashboard). */
export function cardBanner(color: number, baseUrl = getEnv().DASHBOARD_URL): string | null {
  if (!baseUrl?.startsWith('https://')) return null;
  return `${baseUrl.replace(/\/+$/, '')}/dashboard/banners/${bannerName(color)}.png?v=${VERSION}`;
}
