// Toolbar switches (colour scheme, light/dark, desktop/phone) for every story. The sample API lives in sample.ts.
import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
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

/** The toolbar switches; a story lists in `parameters.switches` only those that change something on it. */
export type Switch = 'scheme' | 'mode' | 'device';

type Globals = Record<string, unknown>;
const THEME_KEY = 'nexo.dashboardTheme';
let appliedTheme = '';

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
  try { localStorage.setItem(THEME_KEY, value); } catch { /* private mode */ }
  const update = () => {
    applyTheme(theme);
    flushSync(() => window.dispatchEvent(new StorageEvent('storage', { key: THEME_KEY, newValue: value })));
  };
  // The first render only sets the theme up; nothing to fade from yet.
  if (first) applyTheme(theme);
  else if (now) update();
  else inTransition(update);
}

/**
 * For the overviews and the phone frame (frames.tsx useLiveFrame): they switch the previews in their iframes directly,
 * inside their own crossfade. Much faster than letting each preview's Storybook re-render the page; its globals are
 * updated quietly, so a later render agrees with what is shown.
 */
(window as unknown as { __nexoSwitchLook?: (scheme: string, mode: 'dark' | 'light') => void }).__nexoSwitchLook = (scheme, mode) => {
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
  initialGlobals: { scheme: 'walnuss', mode: 'dark', device: 'desktop' },
  // withDevice is the outer one: it frames the whole story, the frame then applies the theme itself.
  decorators: [withTheme, withDevice],
  parameters: {
    layout: 'fullscreen',
    switches: ['scheme', 'mode', 'device'] satisfies Switch[],
    options: { storySort: { order: ['Start', 'Übersicht', 'Vergleich', 'Discord', 'Grundlagen', 'Komponenten', ['Aktionen', 'Layout', 'Formular', 'Rückmeldung', 'Diagramme', 'Marke', 'Discord'], 'Seiten'] } },
    controls: { expanded: true, sort: 'requiredFirst' },
    // The example's code as a tab in the addon panel (the panel only opens on component stories, see manager.tsx).
    docs: { codePanel: true, container: ThemedDocs },
    // Code snippets keep a tag's attributes on one line while it fits, instead of one attribute per line.
    jsx: { maxInlineAttributesLineLength: 90 },
  },
};

export default preview;
