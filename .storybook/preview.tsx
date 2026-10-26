// Toolbar switches (colour scheme, light/dark, desktop/phone) for every story. The sample API lives in sample.ts.
import { useEffect, useLayoutEffect, useRef, useState, type PropsWithChildren } from 'react';
import { flushSync } from 'react-dom';
import type { Decorator, Preview } from '@storybook/react-vite';
import { DocsContainer, type DocsContainerProps } from '@storybook/addon-docs/blocks';
import { themes } from 'storybook/theming';
import { applyTheme, ThemeProvider } from '../dashboard/src/theme';
import { sample, themeFor } from './sample';
import { useLiveFrame, type Look } from '../dashboard/stories/frames';
import { inTransition } from './transition';
import '../dashboard/src/tailwind.css';
import '../dashboard/src/styles.css';
import './docs.css';

/** Inside the phone frame of `withDevice` (see below); there the story renders normally at phone width. */
const framed = new URLSearchParams(window.location.search).has('framed');

/**
 * A preview in the overview or the comparison (`still=1`): the page behaves as with "reduce motion", so it shows its
 * final state without entrance and chart animations. 38 previews animating at once, and again after every theme
 * switch, held the overview at a few frames per second. The dashboard asks matchMedia (also through gsap.matchMedia).
 */
if (new URLSearchParams(window.location.search).has('still')) {
  document.documentElement.classList.add('sb-still');
  const realMatchMedia = window.matchMedia.bind(window);
  window.matchMedia = (query: string) => {
    if (!query.includes('prefers-reduced-motion')) return realMatchMedia(query);
    const matches = query.includes('reduce');
    return { matches, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined,
      addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false } as MediaQueryList;
  };
}

/** The toolbar switches; a story lists in `parameters.switches` only those that change something on it. */
export type Switch = 'scheme' | 'mode' | 'device';

type Globals = Record<string, unknown>;
const THEME_KEY = 'nexo.dashboardTheme';
let appliedTheme = '';

/**
 * The dashboard caches its theme in localStorage and follows other tabs through storage events. In Storybook every
 * preview is a document of the same origin, so a write in one reached all others: the overview's 38 previews re-rendered
 * each other 38 × 38 times per switch, and the comparison's previews could take each other's scheme. Here the key is
 * this document's own: reading it gives this preview's theme, writes are dropped, and switches reach the providers only
 * through the event switchTheme sends within the document.
 */
const realGetItem = Storage.prototype.getItem;
const realSetItem = Storage.prototype.setItem;
Storage.prototype.getItem = function getItem(this: Storage, key: string) {
  return this === window.localStorage && key === THEME_KEY ? JSON.stringify(sample.theme) : realGetItem.call(this, key);
};
Storage.prototype.setItem = function setItem(this: Storage, key: string, value: string) {
  if (this === window.localStorage && key === THEME_KEY) return;
  realSetItem.call(this, key, value);
};

/**
 * Decodes every image on the page, also hidden ones: the backdrop holds a walnut and an oak image and hides one per
 * mode, and a browser decodes a hidden image only when it first shows, which stalled the first light/dark switch.
 */
const decodeImages = () => Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));
/**
 * Colour scheme and light/dark, switched live: nothing remounts or reloads. The CSS variables change in place, and
 * every ThemeProvider (the one around the building blocks here and the one inside a page) follows through the same
 * storage event another dashboard tab would send (dashboard/src/theme.tsx), so charts recolour too. A switch crossfades
 * as one view transition (transition.ts); flushSync commits the React state inside it.
 */
function switchTheme(scheme: string, mode: 'dark' | 'light', { now = false } = {}) {
  const theme = themeFor(scheme, mode);
  sample.theme = theme;
  const value = JSON.stringify(theme);
  if (value === appliedTheme) return;
  const first = !appliedTheme;
  appliedTheme = value;
  // Without CSS transitions while the new colours apply (docs.css .sb-switching): the dashboard's hover transitions
  // would otherwise all start at once and lag behind the crossfade, and in the overview's previews they piled up by
  // the thousand. The forced layout applies the new styles before the class goes again, so nothing transitions.
  const apply = () => {
    const root = document.documentElement;
    root.classList.add('sb-switching');
    applyTheme(theme);
    flushSync(() => window.dispatchEvent(new StorageEvent('storage', { key: THEME_KEY, newValue: value })));
    void document.body.offsetHeight;
    root.classList.remove('sb-switching');
    // A guide page's examples that run in iframes of their own (Dialog, SaveBar) switch along, in the same crossfade.
    if (root.classList.contains('sb-docs-scroll')) {
      for (const frame of document.querySelectorAll<HTMLIFrameElement>('.docs-story iframe')) {
        (frame.contentWindow as unknown as LookWindow | null)?.__nexoSwitchLook?.(scheme, mode);
      }
    }
  };
  // The first render only sets the theme up (and decodes the other mode's images once the page is idle).
  if (first) { applyTheme(theme); setTimeout(() => void decodeImages(), 1500); }
  else if (now) apply();
  else inTransition(async () => { await decodeImages(); apply(); });
}

/**
 * For the overviews and the phone frame (frames.tsx useLiveFrame): they switch the previews in their iframes directly,
 * inside their own crossfade. Much faster than letting each preview's Storybook re-render the page; its globals are
 * updated quietly, so a later render agrees with what is shown.
 */
interface LookWindow {
  __nexoSwitchLook?: (scheme: string, mode: 'dark' | 'light') => void;
  __nexoLook?: () => { scheme: string; mode: 'dark' | 'light' };
}
(window as unknown as LookWindow).__nexoLook = () => ({ scheme: sample.theme.preset, mode: sample.theme.mode });

/**
 * A guide page's example that runs in an iframe of its own starts in the guide page's look: Storybook loads it without
 * globals in the address, so it would otherwise always show the default scheme in dark.
 */
const parentLook = (() => {
  if (window.parent === window || new URLSearchParams(window.location.search).has('globals')) return null;
  try { return (window.parent as unknown as LookWindow).__nexoLook?.() ?? null; } catch { return null; }
})();

(window as unknown as LookWindow).__nexoSwitchLook = (scheme, mode) => {
  (window as unknown as { __STORYBOOK_PREVIEW__?: { storyStoreValue?: { userGlobals: { update(g: Globals): void } } } })
    .__STORYBOOK_PREVIEW__?.storyStoreValue?.userGlobals.update({ scheme, mode });
  switchTheme(scheme, mode, { now: true });
};

interface DocsRender { type: string; rerender?: () => Promise<void>; keepsLook?: boolean }
interface PreviewWeb { currentRender?: DocsRender; storyStoreValue?: { userGlobals: { get(): Globals } } }

/** Everything but scheme and mode: the globals that do change what a guide page shows. */
const layoutGlobals = ({ scheme: _scheme, mode: _mode, ...rest }: Globals) => JSON.stringify(rest);

/**
 * On a guide page Storybook re-renders the whole page for every globals change (and reloads it when an example is
 * still rendering, see StoryRender.teardown). Scheme and mode only change colours, so for those the page stays and
 * switches live; any other change still re-renders it.
 */
function keepGuidePageOnLookSwitch() {
  const preview = (window as unknown as { __STORYBOOK_PREVIEW__?: PreviewWeb }).__STORYBOOK_PREVIEW__;
  const render = preview?.currentRender;
  if (!preview?.storyStoreValue || render?.type !== 'docs' || !render.rerender || render.keepsLook) return;
  const rerender = render.rerender;
  let layout = layoutGlobals(preview.storyStoreValue.userGlobals.get());
  render.keepsLook = true;
  render.rerender = async () => {
    const globals = preview.storyStoreValue!.userGlobals.get();
    if (layoutGlobals(globals) === layout) return switchTheme(String(globals.scheme), globals.mode as 'dark' | 'light');
    layout = layoutGlobals(globals);
    return rerender();
  };
}

const withTheme: Decorator = (Story, context) => {
  switchTheme(context.globals.scheme, context.globals.mode);
  if (context.viewMode === 'docs') keepGuidePageOnLookSwitch();
  sample.loggedOut = Boolean(context.parameters.loggedOut);
  return <ThemeProvider key={String(sample.loggedOut)} loggedIn={false}><Story /></ThemeProvider>;
};

/** The phone frame of `withDevice`: loads once, then takes scheme and mode live like the overview previews. */
function PhoneFrame({ id, scheme, mode }: { id: string } & Look) {
  const frame = useRef<HTMLIFrameElement>(null);
  const src = useLiveFrame(frame, (g) => `iframe.html?id=${id}&viewMode=story&framed=1&globals=scheme:${g.scheme};mode:${g.mode}`, { scheme, mode });
  return (
    <iframe ref={frame} title="Handy-Ansicht" src={src}
      style={{ width: 'min(390px, 100%)', height: 'min(844px, calc(100vh - 2 * min(24px, 4vw)))', border: '1px solid var(--border-strong)', borderRadius: 28, background: 'var(--bg-main)', boxShadow: '0 24px 60px -24px rgba(0,0,0,.6)' }} />
  );
}

/**
 * Desktop or phone. On "Handy" the story runs in a 390 px wide frame, so the dashboard's own phone layout (media
 * queries) applies. The overviews size their previews themselves (`parameters.ownDevice`).
 */
const withDevice: Decorator = (Story, context) => {
  const switches: Switch[] = context.parameters.switches;
  if (context.globals.device !== 'phone' || framed || context.viewMode === 'docs' || context.parameters.ownDevice || !switches.includes('device')) return <Story />;
  switchTheme(context.globals.scheme, context.globals.mode);
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 'min(24px, 4vw)', background: 'var(--bg-app)' }}>
      <PhoneFrame key={context.id} id={context.id} scheme={context.globals.scheme} mode={context.globals.mode} />
    </div>
  );
};

/**
 * Guide pages in the toolbar's Modus (Dunkel/Hell), like the examples on them: the container follows the theme
 * switch's storage event (switchTheme), so it changes inside the same crossfade; docs.css follows data-mode.
 */
function ThemedDocs({ context, children }: PropsWithChildren<DocsContainerProps>) {
  const store = (context as unknown as { store?: { userGlobals?: { get(): Record<string, unknown> } } }).store;
  const [mode, setMode] = useState(() => store?.userGlobals?.get().mode ?? 'dark');
  useEffect(() => {
    const follow = (event: StorageEvent) => {
      if (event.key !== THEME_KEY || !event.newValue) return;
      try { setMode((JSON.parse(event.newValue) as { mode?: string }).mode ?? 'dark'); } catch { /* not ours */ }
    };
    window.addEventListener('storage', follow);
    return () => window.removeEventListener('storage', follow);
  }, []);
  // The guide page scrolls inside #storybook-docs, not the document (docs.css .sb-docs-scroll): the theme crossfade
  // snapshots the unscrolled document, which older Chromium (the Claude app's built-in browser) got wrong for a
  // scrolled one, showing the old and new page offset or switching it in halves. Each guide page starts at the top.
  useLayoutEffect(() => {
    document.documentElement.classList.add('sb-docs-scroll');
    document.getElementById('storybook-docs')?.scrollTo(0, 0);
    // The guide page applies its look itself (data-mode, for docs.css and its examples), also when all its examples
    // run in iframes and no story decorator runs in this document; then later switches keep the page too.
    const globals = store?.userGlobals?.get() ?? {};
    switchTheme(String(globals.scheme ?? 'walnuss'), (globals.mode ?? 'dark') as 'dark' | 'light');
    keepGuidePageOnLookSwitch();
    return () => document.documentElement.classList.remove('sb-docs-scroll');
  }, [context]); // `store` belongs to `context`
  return <DocsContainer context={context} theme={mode === 'light' ? themes.light : themes.dark}>{children}</DocsContainer>;
}

const preview: Preview = {
  // Every component gets a docs page; the overviews, pages and foundations opt out with '!autodocs'.
  tags: ['autodocs'],
  // The toolbar controls for these globals are our own (manager.tsx), so the default dropdowns are switched off.
  globalTypes: {
    scheme: { description: 'Farbvorlage' },
    mode: { description: 'Hell oder dunkel' },
    device: { description: 'Desktop oder Handy' },
  },
  initialGlobals: { scheme: parentLook?.scheme ?? 'walnuss', mode: parentLook?.mode ?? 'dark', device: 'desktop' },
  // withDevice is the outer one: it frames the whole story, the frame then applies the theme itself.
  decorators: [withTheme, withDevice],
  parameters: {
    layout: 'fullscreen',
    switches: ['scheme', 'mode', 'device'] satisfies Switch[],
    options: { storySort: { order: ['Start', 'Übersicht', 'Vergleich', 'Discord', 'Grundlagen', 'Komponenten', ['Aktionen', 'Layout', 'Formular', 'Rückmeldung', 'Diagramme', 'Marke', 'Discord'], 'Seiten'] } },
    controls: { expanded: true, sort: 'requiredFirst' },
    // The example's code as a tab in the addon panel (the panel only opens on component stories, see manager.tsx).
    // Every example box on a guide page gets the bar on top (zoom, open), not only the first; the code buttons sit in
    // its footer (docs.css).
    docs: { codePanel: true, container: ThemedDocs, canvas: { withToolbar: 'open' } },
    // Code snippets keep a tag's attributes on one line while it fits, instead of one attribute per line.
    jsx: { maxInlineAttributesLineLength: 90 },
  },
};

export default preview;
