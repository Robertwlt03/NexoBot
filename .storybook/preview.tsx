// Toolbar switches (colour scheme, light/dark, desktop/phone) for every story. The sample API lives in sample.ts.
import type { Decorator, Preview } from '@storybook/react-vite';
import { THEME_PRESETS } from '../src/shared/theme';
import { applyTheme } from '../dashboard/src/theme';
import { sample, themeFor } from './sample';
import '../dashboard/src/tailwind.css';
import '../dashboard/src/styles.css';

/** Inside the phone frame of `withDevice` (see below); there the story renders normally at phone width. */
const framed = new URLSearchParams(window.location.search).has('framed');

/** Colour scheme and light/dark; pages remount on a change so they fetch the new theme from the sample API. */
const withTheme: Decorator = (Story, context) => {
  const theme = themeFor(context.globals.scheme, context.globals.mode);
  sample.theme = theme;
  sample.loggedOut = Boolean(context.parameters.loggedOut);
  try { localStorage.setItem('nexo.dashboardTheme', JSON.stringify(theme)); } catch { /* private mode */ }
  applyTheme(theme);
  return <Story key={`${theme.preset}-${theme.mode}-${sample.loggedOut}`} />;
};

/**
 * Desktop or phone. On "Handy" the story runs in a 390 px wide frame, so the dashboard's own phone layout (media
 * queries) applies. The overviews size their previews themselves (`parameters.ownDevice`).
 */
const withDevice: Decorator = (Story, context) => {
  if (context.globals.device !== 'phone' || framed || context.parameters.ownDevice) return <Story />;
  const { scheme, mode } = context.globals;
  applyTheme(themeFor(scheme, mode));
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg-app)' }}>
      <iframe title="Handy-Ansicht" src={`iframe.html?id=${context.id}&viewMode=story&framed=1&globals=scheme:${scheme};mode:${mode}`}
        style={{ width: 390, height: 'min(844px, calc(100vh - 48px))', border: '1px solid var(--border-strong)', borderRadius: 28, background: 'var(--bg-main)', boxShadow: '0 24px 60px -24px rgba(0,0,0,.6)' }} />
    </div>
  );
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
      description: 'Desktop oder Handy',
      toolbar: { title: 'Gerät', icon: 'mobile', items: [{ value: 'desktop', title: 'Desktop' }, { value: 'phone', title: 'Handy' }], dynamicTitle: true },
    },
  },
  initialGlobals: { scheme: 'walnuss', mode: 'dark', device: 'desktop' },
  // withDevice is the outer one: it frames the whole story, the frame then applies the theme itself.
  decorators: [withTheme, withDevice],
  parameters: {
    layout: 'fullscreen',
    options: { storySort: { order: ['Start', 'Übersicht', 'Vergleich', 'Discord', 'Bausteine', 'Seiten'] } },
  },
};

export default preview;
