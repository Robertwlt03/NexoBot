/// <reference types="vite/client" />
// Toolbar switches (colour scheme, light/dark, desktop/phone) and the sample API. Pages fetch from /dashboard/api like
// in production; here the answers come from dashboard/mock-fixtures.ts, the same data as the mock preview.
import type { Decorator, Preview } from '@storybook/react-vite';
import { THEME_PRESETS, type DashboardTheme, type ThemeMode } from '../src/shared/theme';
import { applyTheme } from '../dashboard/src/theme';
import '../dashboard/src/tailwind.css';
import '../dashboard/src/styles.css';

interface Fixtures {
  resolve: (path: string, query: URLSearchParams) => unknown;
  mutate: (method: string, path: string, body: unknown) => { status?: number; body: unknown } | undefined;
  routes: Record<string, unknown>;
}

// The fixtures are local only (not in git, like the mock preview); without them the pages show their error state.
export const fixtures = Object.values(import.meta.glob('../dashboard/mock-fixtures.ts', { eager: true }))[0] as Fixtures | undefined;

export function themeFor(scheme: string, mode: ThemeMode): DashboardTheme {
  const preset = THEME_PRESETS.find((p) => p.id === scheme) ?? THEME_PRESETS[0];
  return { preset: preset.id, primary: preset.primary, secondary: preset.secondary, mode };
}

const sample = { theme: themeFor('walnuss', 'dark'), loggedOut: false };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
  if (!url.pathname.startsWith('/dashboard/api')) return realFetch(input, init);
  const path = url.pathname.slice('/dashboard/api'.length);
  const method = init?.method ?? 'GET';
  if (path === '/me' && sample.loggedOut) return json({ error: 'Nicht angemeldet.' }, 401);
  if (path === '/me/theme' && method === 'GET') return json(sample.theme);
  if (!fixtures) return json({ error: 'Keine Beispieldaten: dashboard/mock-fixtures.ts fehlt.' }, 404);
  if (method !== 'GET') {
    let body: unknown = null;
    try { body = typeof init?.body === 'string' ? JSON.parse(init.body) : null; } catch { /* keep null */ }
    const reply = fixtures.mutate(method, path, body);
    return json(reply ? reply.body : fixtures.routes[path] ?? { ok: true }, reply?.status ?? 200);
  }
  const body = fixtures.resolve(path, url.searchParams);
  return body ? json(body) : json({ error: 'Keine Beispieldaten für diese Seite.' }, 404);
};

/** Every story gets the chosen scheme; pages remount on a change so they fetch the new theme. */
const withTheme: Decorator = (Story, context) => {
  const theme = themeFor(context.globals.scheme, context.globals.mode);
  sample.theme = theme;
  sample.loggedOut = Boolean(context.parameters.loggedOut);
  try { localStorage.setItem('nexo.dashboardTheme', JSON.stringify(theme)); } catch { /* private mode */ }
  applyTheme(theme);
  return <Story key={`${theme.preset}-${theme.mode}-${sample.loggedOut}`} />;
};

const preview: Preview = {
  globalTypes: {
    scheme: {
      description: 'Farbvorlage',
      toolbar: { title: 'Farbvorlage', icon: 'paintbrush', items: THEME_PRESETS.map((p) => ({ value: p.id, title: p.name })), dynamicTitle: true },
    },
    mode: {
      description: 'Hell oder dunkel',
      toolbar: { title: 'Modus', icon: 'mirror', items: [{ value: 'dark', title: 'Dunkel' }, { value: 'light', title: 'Hell' }], dynamicTitle: true },
    },
    device: {
      description: 'Desktop oder Handy (Übersicht und Vergleich)',
      toolbar: { title: 'Gerät', icon: 'mobile', items: [{ value: 'desktop', title: 'Desktop' }, { value: 'phone', title: 'Handy' }], dynamicTitle: true },
    },
  },
  initialGlobals: { scheme: 'walnuss', mode: 'dark', device: 'desktop' },
  decorators: [withTheme],
  parameters: {
    layout: 'fullscreen',
    options: { storySort: { order: ['Übersicht', 'Vergleich', 'Discord', 'Bausteine', 'Seiten'] } },
  },
};

export default preview;
