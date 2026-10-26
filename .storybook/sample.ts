/// <reference types="vite/client" />
// The sample API for Storybook. Pages fetch from /dashboard/api like in production; here the answers come from the
// local dashboard/mock-fixtures.ts (the same data as the mock preview) and /me/theme follows the toolbar.
// One module for preview.tsx and the stories, so there is a single theme state and a single fetch hook.
import { normalizeTheme, type DashboardTheme, type ThemeMode } from '../src/shared/theme';

interface Fixtures {
  resolve: (path: string, query: URLSearchParams) => unknown;
  mutate: (method: string, path: string, body: unknown) => { status?: number; body: unknown } | undefined;
  routes: Record<string, unknown>;
}

// The fixtures are local only (not in git, like the mock preview); without them the pages show their error state.
export const fixtures = Object.values(import.meta.glob('../dashboard/mock-fixtures.ts', { eager: true }))[0] as Fixtures | undefined;

/**
 * The toolbar's theme as a stored theme; each theme brings its own mode. `mode` only matters for addresses from before
 * the themes, whose colour scheme is unknown now: they get the wood theme of that mode.
 */
export function themeFor(scheme: string, mode: ThemeMode): DashboardTheme {
  return normalizeTheme({ preset: scheme, mode });
}

/** What the sample API answers right now; the decorator in preview.tsx sets it from the toolbar. */
export const sample = { theme: themeFor('walnuss', 'dark'), loggedOut: false };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
  if (!url.pathname.startsWith('/dashboard/api')) return realFetch(input, init);
  const path = url.pathname.slice('/dashboard/api'.length);
  const method = init?.method ?? 'GET';
  // Logged out without 401: api() answers a 401 with a redirect to /dashboard/, which does not exist here.
  if (path === '/me' && sample.loggedOut) return json({ error: 'Nicht angemeldet.' }, 404);
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
