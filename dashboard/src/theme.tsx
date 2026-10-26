// Applies the member's personal dashboard colours (src/shared/theme.ts) as CSS variables on <html>.
// The last theme is cached in localStorage so the page starts in the right colours; the account copy wins on login.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { DEFAULT_THEME, chartPalette, chartPrimary, heatRamp, normalizeTheme, themeVariables, type DashboardTheme } from '../../src/shared/theme';
import { api } from './api';

const CACHE_KEY = 'nexo.dashboardTheme';

export function applyTheme(theme: DashboardTheme) {
  const root = document.documentElement;
  root.dataset.mode = theme.mode;
  for (const [name, value] of Object.entries(themeVariables(theme))) root.style.setProperty(name, value);
}

export function cachedTheme(): DashboardTheme {
  try {
    return normalizeTheme(JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null'));
  } catch {
    return { ...DEFAULT_THEME };
  }
}

function cacheTheme(theme: DashboardTheme) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(theme));
  } catch { /* private mode: the account copy still applies */ }
}

interface ThemeState {
  /** The theme shown right now (may be an unsaved preview). */
  theme: DashboardTheme;
  /** The theme saved on the account. */
  saved: DashboardTheme;
  /** Show a theme without saving (design page live preview); pass null to go back to the saved one. */
  preview: (theme: DashboardTheme | null) => void;
  /** Persist on the account and keep it applied. */
  save: (theme: DashboardTheme) => Promise<void>;
}

const ThemeContext = createContext<ThemeState>({ theme: DEFAULT_THEME, saved: DEFAULT_THEME, preview: () => undefined, save: async () => undefined });

export function ThemeProvider({ loggedIn, children }: { loggedIn: boolean; children: ReactNode }) {
  const [saved, setSaved] = useState<DashboardTheme>(cachedTheme);
  const [draft, setDraft] = useState<DashboardTheme | null>(null);
  const theme = draft ?? saved;

  useEffect(() => { applyTheme(theme); }, [theme]);
  // Another tab saved a theme (or Storybook's toolbar switched it): follow it without reloading.
  useEffect(() => {
    const follow = (event: StorageEvent) => {
      if (event.key !== CACHE_KEY || !event.newValue) return;
      try { setSaved(normalizeTheme(JSON.parse(event.newValue))); } catch { /* not ours */ }
    };
    window.addEventListener('storage', follow);
    return () => window.removeEventListener('storage', follow);
  }, []);
  useEffect(() => {
    if (!loggedIn) return;
    api<DashboardTheme>('/me/theme')
      .then((remote) => { const next = normalizeTheme(remote); setSaved(next); cacheTheme(next); })
      .catch(() => undefined);
  }, [loggedIn]);

  const preview = useCallback((next: DashboardTheme | null) => setDraft(next), []);
  const save = useCallback(async (next: DashboardTheme) => {
    const stored = normalizeTheme(await api<DashboardTheme>('/me/theme', { method: 'PUT', body: next }));
    setSaved(stored);
    setDraft(null);
    cacheTheme(stored);
  }, []);

  const value = useMemo(() => ({ theme, saved, preview, save }), [theme, saved, preview, save]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/** Chart colours following the member's theme: single series, multi-series palette and heatmap ramp (light mode: low = light). */
export function useChartTheme() {
  const { theme } = useTheme();
  return useMemo(() => ({ primary: chartPrimary(theme.primary, theme.mode), palette: chartPalette(theme), heat: theme.mode === 'light' ? heatRamp(theme.primary).reverse() : heatRamp(theme.primary) }), [theme]);
}
