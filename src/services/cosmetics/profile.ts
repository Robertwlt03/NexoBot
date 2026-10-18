// Profile settings (equipped cosmetics, bio, welcome opt-in): strict validation for saves, lenient normalisation for
// reads (a stored value that no longer fits simply falls back to the default look).

import {
  COSMETIC_SLOTS, MAX_BIO_LENGTH, MAX_EQUIPPED_BADGES, SLOT_LABELS, defaultProfileSettings,
  type CosmeticItem, type CosmeticSlot, type EquippedCosmetics, type UserProfileSettings,
} from '../../shared/cosmetics.js';
import { HttpError, badRequest, body, bool } from '../../web/http.js';
import { T, cosmeticsPool, requirePool } from './db.js';

/** Equipped key per single-item slot (badges are a list). */
type SingleSlot = Exclude<CosmeticSlot, 'badge'>;
const SINGLE_SLOTS = COSMETIC_SLOTS.filter((slot): slot is SingleSlot => slot !== 'badge');

/** Removes links, invites and mentions; collapses whitespace. */
export function sanitizeBio(text: string): string {
  return text
    .replace(/<(?:@[!&]?|#)\d+>/g, '')
    .replace(/@(?:everyone|here)\b/gi, '')
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, '')
    .replace(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|de|net|org|gg|io|xyz|me|tv|ly|app|link|ru|co|info|eu|at|ch)(?:\/\S*)?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Validates a profile save: known items in the right slot, all owned, ≤ 3 badges, clean bio ≤ MAX_BIO_LENGTH. */
export function parseProfileSettings(input: unknown, catalog: Map<string, CosmeticItem>, owned: Set<string>): UserProfileSettings {
  const raw = body(input);
  const rawEquipped = raw.equipped === undefined ? {} : body(raw.equipped);
  const check = (value: unknown, slot: CosmeticSlot): string => {
    const entry = typeof value === 'string' ? catalog.get(value) : undefined;
    if (!entry || entry.slot !== slot) throw badRequest(`${SLOT_LABELS[slot]}: unbekanntes Item.`);
    if (!owned.has(entry.id)) throw new HttpError(403, `Du besitzt „${entry.name}“ nicht.`);
    return entry.id;
  };

  const equipped = defaultProfileSettings().equipped;
  for (const slot of SINGLE_SLOTS) {
    const value = rawEquipped[slot];
    equipped[slot] = value === null || value === undefined || value === '' ? null : check(value, slot);
  }
  const badges = rawEquipped.badges ?? [];
  if (!Array.isArray(badges)) throw badRequest('Abzeichen: Liste erwartet.');
  equipped.badges = [...new Set(badges.map((value) => check(value, 'badge')))];
  if (equipped.badges.length > MAX_EQUIPPED_BADGES) throw badRequest(`Du kannst höchstens ${MAX_EQUIPPED_BADGES} Abzeichen tragen.`);

  if (raw.bio !== undefined && typeof raw.bio !== 'string') throw badRequest('Bio: Text erwartet.');
  if (typeof raw.bio === 'string' && raw.bio.length > MAX_BIO_LENGTH * 4) throw badRequest(`Bio: höchstens ${MAX_BIO_LENGTH} Zeichen.`);
  const bio = sanitizeBio(typeof raw.bio === 'string' ? raw.bio : '');
  if (bio.length > MAX_BIO_LENGTH) throw badRequest(`Bio: höchstens ${MAX_BIO_LENGTH} Zeichen.`);

  return { equipped, bio, showOnWelcome: raw.showOnWelcome === undefined ? true : bool(raw.showOnWelcome, 'Auf Willkommenskarten zeigen') };
}

/** Lenient read of stored settings (wrong types are dropped). */
export function normalizeSettings(stored: unknown): UserProfileSettings {
  const settings = defaultProfileSettings();
  if (!stored || typeof stored !== 'object') return settings;
  const raw = stored as Record<string, unknown>;
  const rawEquipped = (raw.equipped && typeof raw.equipped === 'object' ? raw.equipped : {}) as Partial<Record<keyof EquippedCosmetics, unknown>>;
  for (const slot of SINGLE_SLOTS) {
    const value = rawEquipped[slot];
    settings.equipped[slot] = typeof value === 'string' ? value : null;
  }
  settings.equipped.badges = Array.isArray(rawEquipped.badges)
    ? rawEquipped.badges.filter((id): id is string => typeof id === 'string').slice(0, MAX_EQUIPPED_BADGES)
    : [];
  settings.bio = typeof raw.bio === 'string' ? raw.bio.slice(0, MAX_BIO_LENGTH) : '';
  settings.showOnWelcome = raw.showOnWelcome !== false;
  return settings;
}

export async function readProfileSettings(userId: string): Promise<UserProfileSettings> {
  const pool = cosmeticsPool();
  if (!pool) return defaultProfileSettings();
  const result = await pool.query<{ settings: unknown }>(`SELECT settings FROM ${T.user_profiles} WHERE user_id = $1`, [userId]);
  return normalizeSettings(result.rows[0]?.settings);
}

export async function writeProfileSettings(userId: string, settings: UserProfileSettings): Promise<void> {
  await requirePool().query(
    `INSERT INTO ${T.user_profiles} (user_id, settings, updated_at) VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (user_id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = NOW()`,
    [userId, JSON.stringify(settings)],
  );
}
