import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ApiGuildDetail, ApiUser } from '../../src/web/apiTypes';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const BASE = '/dashboard/api';

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    credentials: 'same-origin',
    headers: {
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      // Required by the server for every non-GET request (CSRF protection).
      'x-nexo-dashboard': '1',
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
      ? data.error
      : `Anfrage fehlgeschlagen (${response.status})`;
    if (response.status === 401 && !location.pathname.endsWith('/dashboard/')) {
      location.href = '/dashboard/';
    }
    throw new ApiError(message, response.status);
  }
  return data as T;
}

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (path === null) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    api<T>(path)
      .then((result) => { if (!cancelled) { setData(result); setError(null); } })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, setData, error, loading, reload };
}

// ---------- Session & guild context ----------

export const UserContext = createContext<ApiUser | null>(null);
export const useUser = () => useContext(UserContext);

export interface GuildContextValue {
  guild: ApiGuildDetail;
  reload: () => void;
}
export const GuildContext = createContext<GuildContextValue | null>(null);
export function useGuild(): GuildContextValue {
  const value = useContext(GuildContext);
  if (!value) {
    throw new Error('useGuild outside of a guild page');
  }
  return value;
}

// ---------- Toasts ----------

export interface Toast { id: number; text: string; error?: boolean }
export const ToastContext = createContext<(text: string, error?: boolean) => void>(() => undefined);
export const useToast = () => useContext(ToastContext);

// ---------- Settings forms ----------

/** Unsaved-changes state shared with the save bar. */
export const DirtyContext = createContext<{ setGuard: (dirty: boolean) => void }>({ setGuard: () => undefined });

/**
 * Loads a module's settings (GET /guilds/:id/<module>), tracks local edits and saves them (PUT).
 * `value`/`set` hold the draft, `dirty` drives the Discord-style save bar.
 */
export function useSettings<T>(moduleId: string) {
  const { guild } = useGuild();
  const toast = useToast();
  const { setGuard } = useContext(DirtyContext);
  const path = `/guilds/${guild.id}/${moduleId}`;
  const { data, setData, error, loading, reload } = useApi<T>(path);
  const [draft, setDraft] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);
  const original = useRef<string>('');

  useEffect(() => {
    if (data) {
      original.current = JSON.stringify(data);
      setDraft(structuredClone(data));
    }
  }, [data]);

  const dirty = useMemo(() => draft !== null && JSON.stringify(draft) !== original.current, [draft]);
  useEffect(() => { setGuard(dirty); return () => setGuard(false); }, [dirty, setGuard]);

  const set = useCallback((update: Partial<T> | ((prev: T) => T)) => {
    setDraft((prev) => {
      if (prev === null) return prev;
      return typeof update === 'function' ? update(prev) : { ...prev, ...update };
    });
  }, []);

  const save = useCallback(async () => {
    if (draft === null) return;
    setSaving(true);
    try {
      const saved = await api<T>(path, { method: 'PUT', body: draft });
      setData(saved);
      toast('Änderungen gespeichert.');
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setSaving(false);
    }
  }, [draft, path, setData, toast]);

  const reset = useCallback(() => {
    if (data) setDraft(structuredClone(data));
  }, [data]);

  return { value: draft, set, dirty, save, reset, saving, error, loading, reload, path };
}

/** Runs a module action (POST) with toast feedback; returns the result or null on failure. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(async <R,>(path: string, body: unknown = {}, success?: string): Promise<R | null> => {
    setBusy(path);
    try {
      const result = await api<R>(path, { method: 'POST', body });
      if (success) toast(success);
      return result;
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), true);
      return null;
    } finally {
      setBusy(null);
    }
  }, [toast]);
  return { run, busy };
}
