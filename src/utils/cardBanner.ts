// The banner on top of every Nexo card: one picture per accent colour (rendered by scripts/render-banners.ts),
// served by the dashboard. Discord has to fetch it, so it only appears when DASHBOARD_URL is a public https URL.

import { getEnv } from '../config/env.js';

/** Banners picked by the card's accent colour → the colour they are drawn in (the palette in config/bot.ts). */
const BY_COLOUR = {
  nexo: 0x8FB36B, amber: 0xE8A33D, gold: 0xF5C451, success: 0x4ADE80, info: 0x7DA0C4,
  warn: 0xF59E0B, danger: 0xEF4444, calm: 0x94A3B8, pink: 0xF472B6,
} as const;

/** All banners: the colour ones plus topic banners a message chooses itself (withBanner). */
export const BANNERS = { ...BY_COLOUR, gift: 0x8FB36B, giftEnded: 0x94A3B8 } as const;
export type BannerName = keyof typeof BANNERS;

/** Bump when the PNGs change, so Discord's media cache fetches the new ones. */
const VERSION = 1;

/** The colour banner whose accent is closest to `color` (feature colours like ticket states map onto the nine). */
export function bannerName(color: number): BannerName {
  const channels = (value: number) => [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  const [r, g, b] = channels(color);
  let best: BannerName = 'nexo';
  let bestDistance = Infinity;
  for (const [name, accent] of Object.entries(BY_COLOUR) as [BannerName, number][]) {
    const [ar, ag, ab] = channels(accent);
    const distance = (r - ar) ** 2 + (g - ag) ** 2 + (b - ab) ** 2;
    if (distance < bestDistance) [best, bestDistance] = [name, distance];
  }
  return best;
}

/** Topic banners chosen for embeds (e.g. giveaways); embedToCard uses them instead of the colour banner. */
const chosen = new WeakMap<object, BannerName>();
export function withBanner<T extends object>(embed: T, name: BannerName): T {
  chosen.set(embed, name);
  return embed;
}
export const chosenBanner = (embed: object): BannerName | undefined => chosen.get(embed);

/** Public URL of a card's banner, or null when Discord could not fetch it (no https dashboard). */
export function cardBanner(color: number, { name, baseUrl = getEnv().DASHBOARD_URL }: { name?: BannerName; baseUrl?: string } = {}): string | null {
  if (!baseUrl?.startsWith('https://')) return null;
  return `${baseUrl.replace(/\/+$/, '')}/dashboard/banners/${name ?? bannerName(color)}.png?v=${VERSION}`;
}
