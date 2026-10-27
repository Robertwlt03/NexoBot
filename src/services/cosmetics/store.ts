// Read access to a user's global cosmetics for rendering (profile card, level-up card, welcome card).
// Contract between the economy backend (implements this file) and the card renderer (calls it).
// Without the database everyone has the default look and an empty wallet; read errors fall back the same way.

import type { CosmeticItem, ResolvedCosmetics, SlotData, UserProfileSettings } from '../../shared/cosmetics.js';
import { defaultProfileSettings, withSpot } from '../../shared/cosmetics.js';
import { logger } from '../../utils/logger.js';
import { loadCatalog } from './catalog.js';
import { T, cosmeticsPool } from './db.js';
import { readProfileSettings } from './profile.js';

export function emptyResolved(): ResolvedCosmetics {
  return { background: null, accent: null, nameStyle: null, frame: null, badges: [], title: null, xpBar: null, font: null, effect: null, levelup: null, layout: null, sticker: null, pet: null };
}

/** The user's profile settings (equipped item ids, bio, welcome opt-in). */
export async function getProfileSettings(userId: string): Promise<UserProfileSettings> {
  try {
    return await readProfileSettings(userId);
  } catch (error) {
    logger.warn('Profil-Einstellungen konnten nicht gelesen werden:', (error as Error).message);
    return defaultProfileSettings();
  }
}

/** Equipped item ids resolved against the catalog (inactive, unknown or wrong-slot items fall back to the default). */
export function resolveEquipped(settings: UserProfileSettings, catalog: Map<string, CosmeticItem>): ResolvedCosmetics {
  const pick = <S extends keyof SlotData>(id: string | null, slot: S): SlotData[S] | null => {
    const entry = id ? catalog.get(id) : undefined;
    return entry && entry.active && entry.slot === slot ? entry.data as SlotData[S] : null;
  };
  const { equipped } = settings;
  return {
    background: pick(equipped.background, 'background'),
    accent: pick(equipped.accent, 'accent'),
    nameStyle: pick(equipped.nameStyle, 'nameStyle'),
    frame: pick(equipped.frame, 'frame'),
    badges: equipped.badges.map((id) => pick(id, 'badge')).filter((data): data is SlotData['badge'] => data !== null),
    title: pick(equipped.title, 'title'),
    xpBar: pick(equipped.xpBar, 'xpBar'),
    font: pick(equipped.font, 'font'),
    effect: pick(equipped.effect, 'effect'),
    levelup: pick(equipped.levelup, 'levelup'),
    layout: pick(equipped.layout, 'layout'),
    sticker: withSpot(pick(equipped.sticker, 'sticker'), settings.stickerSpot),
    pet: pick(equipped.pet, 'pet'),
  };
}

/** Equipped items resolved to their data (inactive or unknown items fall back to the default look). */
export async function getResolvedCosmetics(userId: string): Promise<ResolvedCosmetics> {
  if (!cosmeticsPool()) return emptyResolved();
  try {
    const [settings, catalog] = await Promise.all([readProfileSettings(userId), loadCatalog()]);
    return resolveEquipped(settings, catalog);
  } catch (error) {
    logger.warn('Cosmetics konnten nicht geladen werden:', (error as Error).message);
    return emptyResolved();
  }
}

/** Current Bernis balance (0 when the user has no wallet yet). */
export async function getBalance(userId: string): Promise<number> {
  const pool = cosmeticsPool();
  if (!pool) return 0;
  try {
    const result = await pool.query<{ balance: string }>(`SELECT balance FROM ${T.user_wallets} WHERE user_id = $1`, [userId]);
    return Number(result.rows[0]?.balance ?? 0);
  } catch (error) {
    logger.warn('Berni-Kontostand konnte nicht gelesen werden:', (error as Error).message);
    return 0;
  }
}
