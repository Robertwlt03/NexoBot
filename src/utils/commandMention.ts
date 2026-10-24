// Clickable command mentions (</profil aufgaben:123>): the ids come from the global registration at start-up.
// Until then (or for unknown commands) the plain "/profil aufgaben" text is used.

const ids = new Map<string, string>();

export function setCommandIds(registered: unknown): void {
  if (!Array.isArray(registered)) return;
  for (const entry of registered as { id?: string; name?: string; type?: number }[]) {
    if (entry.id && entry.name && (entry.type ?? 1) === 1) ids.set(entry.name, entry.id);
  }
}

/** "profil aufgaben" → </profil aufgaben:id>, or /profil aufgaben while the id is unknown. */
export function cmd(path: string): string {
  const id = ids.get(path.split(' ')[0]);
  return id ? `</${path}:${id}>` : `/${path}`;
}
