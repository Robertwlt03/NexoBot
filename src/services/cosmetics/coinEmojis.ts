// The Bernis coins as Discord application emojis, so bot messages show the same coins as the dashboard and the
// cards. Rendered from shared/coins.ts at start-up; existing ones are reused. The name carries a design version:
// a new design gets new emojis and the old ones are removed. Any failure keeps the unicode fallback (🟡 ⚪ 🟤 💠).
// The pet food bowl (shared/petArt.ts) comes along as `nexo_futter_<design>` (fallback 🍖).

import { createCanvas } from '@napi-rs/canvas';
import type { Client } from 'discord.js';
import { COIN_TIERS, drawCoin, setCoinEmojis, type CoinTier } from '../../shared/coins.js';
import { drawFoodBowl, setFoodEmoji } from '../../shared/pets.js';
import { logger } from '../../utils/logger.js';

/** Bump when the coin design changes. */
const DESIGN = 'v1';
const PREFIX = 'berni_';
const NAMES: Record<CoinTier, string> = { platinum: 'platin', gold: 'gold', silver: 'silber', bronze: 'bronze' };
const nameOf = (tier: CoinTier) => `${PREFIX}${NAMES[tier]}_${DESIGN}`;
const FOOD_PREFIX = 'nexo_futter_';
const FOOD_NAME = `${FOOD_PREFIX}${DESIGN}`;

/** PNG of the food bowl, 128 px. */
export function foodPng(): Buffer {
  const canvas = createCanvas(128, 128);
  drawFoodBowl(canvas.getContext('2d') as never, 64, 60, 122);
  return canvas.toBuffer('image/png');
}

/** PNG of one coin, 128 px with a little room for the bevel. */
export function coinPng(tier: CoinTier): Buffer {
  const canvas = createCanvas(128, 128);
  drawCoin(canvas.getContext('2d') as never, tier, 64, 64, 124);
  return canvas.toBuffer('image/png');
}

export async function ensureCoinEmojis(client: Client<true>): Promise<void> {
  try {
    const existing = await client.application.emojis.fetch();
    const emojis: Partial<Record<CoinTier, string>> = {};
    for (const { tier } of COIN_TIERS) {
      const name = nameOf(tier);
      const emoji = existing.find((entry) => entry.name === name)
        ?? await client.application.emojis.create({ attachment: coinPng(tier), name });
      emojis[tier] = `<:${name}:${emoji.id}>`;
    }
    setCoinEmojis(emojis);
    const food = existing.find((entry) => entry.name === FOOD_NAME) ?? await client.application.emojis.create({ attachment: foodPng(), name: FOOD_NAME });
    setFoodEmoji(`<:${FOOD_NAME}:${food.id}>`);
    // Emojis of an older coin design.
    for (const entry of existing.values()) {
      if ((entry.name?.startsWith(PREFIX) || entry.name?.startsWith(FOOD_PREFIX)) && !entry.name.endsWith(`_${DESIGN}`)) await entry.delete().catch(() => undefined);
    }
    logger.info('Berni-Münzen als Discord-Emojis bereit.');
  } catch (error) {
    logger.warn('Berni-Münzen-Emojis nicht verfügbar, Bot nutzt Unicode:', (error as Error).message);
  }
}
