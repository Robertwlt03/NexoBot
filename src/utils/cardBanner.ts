// The banner on top of every Nexo card: a motif (by the card's colour role or the message's topic) drawn in the
// card's colour by services/bannerArt.ts and served by the dashboard. Discord has to fetch it, so it only appears
// when DASHBOARD_URL is a public https URL.

import { getEnv } from '../config/env.js';
import { DEFAULT_MESSAGE_PALETTE, type MessageRole } from '../shared/theme.js';

/** Banner motifs: one per colour role, plus topic banners a message chooses itself (withBanner, nexoCard's `banner`). */
export type BannerName = MessageRole | 'gift' | 'giftEnded' | 'quests';

/** Bump when the drawing changes, so Discord's media cache fetches the new banners. */
const VERSION = 2;

const channels = (value: number) => [(value >> 16) & 255, (value >> 8) & 255, value & 255];
const ROLE_COLOURS = Object.entries(DEFAULT_MESSAGE_PALETTE).map(([role, hex]) => [role as MessageRole, channels(Number.parseInt(hex.slice(1), 16))] as const);

/** The colour role closest to `color` (feature colours like ticket states map onto the nine roles). */
export function bannerName(color: number): MessageRole {
  const [r, g, b] = channels(color);
  let best: MessageRole = 'nexo';
  let bestDistance = Infinity;
  for (const [role, [ar, ag, ab]] of ROLE_COLOURS) {
    const distance = (r - ar) ** 2 + (g - ag) ** 2 + (b - ab) ** 2;
    if (distance < bestDistance) [best, bestDistance] = [role, distance];
  }
  return best;
}

/** Topic banners chosen for embeds (e.g. giveaways); embedToCard uses them instead of the colour role's motif. */
const chosen = new WeakMap<object, BannerName>();
export function withBanner<T extends object>(embed: T, name: BannerName): T {
  chosen.set(embed, name);
  return embed;
}
export const chosenBanner = (embed: object): BannerName | undefined => chosen.get(embed);

const hex6 = (color: number) => color.toString(16).padStart(6, '0');

/** Public URL of a card's banner in the card's colour, or null when Discord could not fetch it (no https dashboard). */
export function cardBanner(color: number, { name, baseUrl = getEnv().DASHBOARD_URL }: { name?: BannerName; baseUrl?: string } = {}): string | null {
  if (!baseUrl?.startsWith('https://')) return null;
  return `${baseUrl.replace(/\/+$/, '')}/dashboard/banners/${name ?? bannerName(color)}.png?c=${hex6(color)}&v=${VERSION}`;
}

const BANNER_URL = /\/dashboard\/banners\/[A-Za-z]+\.png\?c=[0-9a-f]{6}/;
export const isBannerUrl = (url: string | undefined): boolean => Boolean(url && BANNER_URL.test(url));

/** The same banner in another colour (a member's scheme). */
export const recolorBanner = (url: string, color: number): string => url.replace(/([?&]c=)[0-9a-f]{6}/, `$1${hex6(color)}`);
