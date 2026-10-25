// Toolbar switches (colour scheme, light/dark, desktop/phone) for every story. The sample API lives in sample.ts.
import type { Decorator, Preview } from '@storybook/react-vite';
import { applyTheme, ThemeProvider } from '../dashboard/src/theme';
import { sample, themeFor } from './sample';
import '../dashboard/src/tailwind.css';
import '../dashboard/src/styles.css';

/** Inside the phone frame of `withDevice` (see below); there the story renders normally at phone width. */
const framed = new URLSearchParams(window.location.search).has('framed');

/** The toolbar switches; a story lists in `parameters.switches` only those that change something on it. */
export type Switch = 'scheme' | 'mode' | 'device';

/**
 * Colour scheme and light/dark; stories remount on a change so pages fetch the new theme from the sample API. The
 * ThemeProvider gives the building blocks outside a page (charts) the theme too; inside a page the app's own wins.
 */
const withTheme: Decorator = (Story, context) => {
  const theme = themeFor(context.globals.scheme, context.globals.mode);
  sample.theme = theme;
  sample.loggedOut = Boolean(context.parameters.loggedOut);
  try { localStorage.setItem('nexo.dashboardTheme', JSON.stringify(theme)); } catch { /* private mode */ }
  applyTheme(theme);
  return <ThemeProvider key={`${theme.preset}-${theme.mode}-${sample.loggedOut}`} loggedIn={false}><Story /></ThemeProvider>;
};

/**
 * Desktop or phone. On "Handy" the story runs in a 390 px wide frame, so the dashboard's own phone layout (media
 * queries) applies. The overviews size their previews themselves (`parameters.ownDevice`).
 */
const withDevice: Decorator = (Story, context) => {
  const switches: Switch[] = context.parameters.switches;
  if (context.globals.device !== 'phone' || framed || context.viewMode === 'docs' || context.parameters.ownDevice || !switches.includes('device')) return <Story />;
  const { scheme, mode } = context.globals;
  applyTheme(themeFor(scheme, mode));
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 'min(24px, 4vw)', background: 'var(--bg-app)' }}>
      <iframe title="Handy-Ansicht" src={`iframe.html?id=${context.id}&viewMode=story&framed=1&globals=scheme:${scheme};mode:${mode}`}
        style={{ width: 'min(390px, 100%)', height: 'min(844px, calc(100vh - 2 * min(24px, 4vw)))', border: '1px solid var(--border-strong)', borderRadius: 28, background: 'var(--bg-main)', boxShadow: '0 24px 60px -24px rgba(0,0,0,.6)' }} />
    </div>
  );
};

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
  },
};

export default preview;
