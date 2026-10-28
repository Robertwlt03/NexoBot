// User notes (`guild:{guildId}:usernotes:{userId}` holds an array of notes). Used by /usernotes and the web dashboard.

import { db, getFromDb, setInDb, getUserNotesKey } from '../../utils/database.js';
import { sanitizeInput } from '../../utils/validation.js';

export interface UserNote {
  id: number;
  content: string;
  type: string;
  author: string;
  authorId: string;
  timestamp: string;
}

export async function getUserNotes(guildId: string, userId: string): Promise<UserNote[]> {
  return getFromDb<UserNote[]>(getUserNotesKey(guildId, userId), []);
}

export async function saveUserNotes(guildId: string, userId: string, notes: UserNote[]): Promise<void> {
  await setInDb(getUserNotesKey(guildId, userId), notes);
}

/** Appends a note (content already trimmed and 1–1000 chars) and returns the new note list. */
export async function addUserNote(
  guildId: string,
  userId: string,
  note: { content: string; type: string; author: string; authorId: string },
): Promise<UserNote[]> {
  const notes = await getUserNotes(guildId, userId);
  notes.push({
    id: Date.now(),
    content: sanitizeInput(note.content),
    type: note.type,
    author: note.author,
    authorId: note.authorId,
    timestamp: new Date().toISOString(),
  });
  await saveUserNotes(guildId, userId, notes);
  return notes;
}

/** All notes of a guild, keyed by user id. */
export async function getGuildUserNotes(guildId: string): Promise<Map<string, UserNote[]>> {
  const prefix = getUserNotesKey(guildId, '');
  const keys = await db.list(prefix);
  const result = new Map<string, UserNote[]>();
  for (const key of Array.isArray(keys) ? keys : []) {
    const userId = key.slice(prefix.length);
    if (!/^\d+$/.test(userId)) continue; // skips the legacy `usernotes:list` key
    const notes = await getFromDb<UserNote[]>(key, []);
    if (Array.isArray(notes) && notes.length) result.set(userId, notes);
  }
  return result;
}
