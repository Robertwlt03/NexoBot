// Toolbar switches (colour scheme, light/dark, desktop/phone) for every story. The sample API lives in sample.ts.
import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import type { Decorator, Preview } from '@storybook/react-vite';
import { DocsContainer, type DocsContainerProps } from '@storybook/addon-docs/blocks';
import { themes } from 'storybook/theming';
import { applyTheme, ThemeProvider } from '../dashboard/src/theme';
import { sample, themeFor } from './sample';
import { useLiveFrame } from '../dashboard/stories/frames';
import '../dashboard/src/tailwind.css';
import '../dashboard/src/styles.css';
import './docs.css';

/** Inside the phone frame of `withDevice` (see below); there the story renders normally at phone width. */
const framed = new URLSearchParams(window.location.search).has('framed');

/** The toolbar switches; a story lists in `parameters.switches` only those that change something on it. */
export type Switch = 'scheme' | 'mode' | 'device';

const THEME_KEY = 'nexo.dashboardTheme';
let appliedTheme = '';
let fadeTimer: ReturnType<typeof setTimeout> | undefined;

/** Lets colours glide to the new theme for a moment (docs.css .sb-colour-fade), unless reduced motion is on. */
function fadeColours() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.documentElement.classList.add('sb-colour-fade');
  clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => document.documentElement.classList.remove('sb-colour-fade'), 450);
}

/**
 * Colour scheme and light/dark, switched live: nothing remounts or reloads. The CSS variables change in place, and
 * every ThemeProvider (the one around the building blocks here and the one inside a page) follows through the same
 * storage event another dashboard tab would send (dashboard/src/theme.tsx), so charts recolour too.
 */
function switchTheme(scheme: string, mode: 'dark' | 'light') {
  const theme = themeFor(scheme, mode);
  sample.theme = theme;
  const value = JSON.stringify(theme);
  if (value === appliedTheme) return;
  if (appliedTheme) fadeColours();
  appliedTheme = value;
  try { localStorage.setItem(THEME_KEY, value); } catch { /* private mode */ }
  applyTheme(theme);
  // After this render: the providers update their state then.
  queueMicrotask(() => window.dispatchEvent(new StorageEvent('storage', { key: THEME_KEY, newValue: value })));
}

type Globals = Record<string, unknown>;
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
function PhoneFrame({ id, scheme, mode }: { id: string; scheme: string; mode: string }) {
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
 * Guide pages in the toolbar's Modus (Dunkel/Hell), like the examples on them: the container follows the data-mode
 * attribute that applyTheme sets (switchTheme), and so does docs.css.
 */
function ThemedDocs({ context, children }: PropsWithChildren<DocsContainerProps>) {
  const store = (context as unknown as { store?: { userGlobals?: { get(): Record<string, unknown> } } }).store;
  const [mode, setMode] = useState(() => store?.userGlobals?.get().mode ?? 'dark');
  useEffect(() => {
    const root = document.documentElement;
    const follow = () => setMode(root.dataset.mode ?? 'dark');
    const observer = new MutationObserver(follow);
    observer.observe(root, { attributes: true, attributeFilter: ['data-mode'] });
    return () => observer.disconnect();
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
