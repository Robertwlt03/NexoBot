// Nexo's answers to a member come in the member's own colour scheme (Mein Profil → Dashboard-Design). The scheme
// is read once and kept for a while, so replies do not wait on the database; saving a new scheme drops it.

import { DEFAULT_THEME, messagePalette, type MessagePalette } from '../shared/theme.js';
import { paintPayload } from '../utils/messagePalette.js';
import { readDashboardTheme } from './cosmetics/profile.js';

const TTL_MS = 10 * 60_000;
/** Per member: their palette, or null for the default scheme (nothing to repaint). */
const palettes = new Map<string, { palette: MessagePalette | null; until: number }>();

async function paletteOf(userId: string): Promise<MessagePalette | null> {
  const cached = palettes.get(userId);
  if (cached && cached.until > Date.now()) return cached.palette;
  const theme = await readDashboardTheme(userId).catch(() => DEFAULT_THEME);
  const palette = theme.preset === DEFAULT_THEME.preset ? null : messagePalette(theme);
  // ponytail: wholesale reset keeps memory bounded; prune expired entries if members ever notice the refetch
  if (palettes.size > 10_000) palettes.clear();
  palettes.set(userId, { palette, until: Date.now() + TTL_MS });
  return palette;
}

/** Drops the cached scheme (after the member saved a new one). */
export const forgetPalette = (userId: string) => palettes.delete(userId);

/** The payload painted in the member's scheme; the default scheme leaves it as it is. */
export async function paintFor<T>(userId: string | undefined, payload: T): Promise<T> {
  if (!userId || !payload || typeof payload !== 'object') return payload;
  const palette = await paletteOf(userId);
  return palette ? paintPayload(payload, palette) : payload;
}
