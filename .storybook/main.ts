// Storybook: every dashboard page with sample data, the four overviews (board, comparison, Discord, building blocks).
// Run with `npm run storybook`. Sample data comes from the local dashboard/mock-fixtures.ts (see preview.tsx).
import type { StorybookConfig } from '@storybook/react-vite';
import type { Plugin, ViteDevServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

/** Card banners like the bot serves them (/dashboard/banners/<motif>.png?c=<rrggbb>), drawn by the bot's own code. */
const banners = (): Plugin => ({
  name: 'nexo-banners',
  configureServer(server: ViteDevServer) {
    server.middlewares.use(async (req, res, next) => {
      const match = /^\/dashboard\/banners\/([A-Za-z]+)\.png\?c=([0-9a-f]{6})/i.exec(req.url ?? '');
      if (!match) return next();
      try {
        const { MOTIFS, renderBanner } = await server.ssrLoadModule(`${root}src/services/bannerArt.ts`);
        if (!Object.hasOwn(MOTIFS, match[1])) return next();
        const png: Buffer = await renderBanner(match[1], Number.parseInt(match[2], 16));
        res.setHeader('content-type', 'image/png');
        res.end(png);
      } catch (error) {
        next(error);
      }
    });
  },
});

const config: StorybookConfig = {
  stories: ['../dashboard/stories/**/*.stories.tsx'],
  framework: { name: '@storybook/react-vite', options: { builder: { viteConfigPath: 'dashboard/vite.config.ts' } } },
  // Single pages are only shown inside the overviews; the sidebar keeps Übersicht, Vergleich, Discord and Bausteine.
  tags: { seite: { defaultFilterSelection: 'exclude' } },
  // Storybook's own measuring tools and its viewport/background switches would compete with our toolbar.
  features: {
    viewport: false, backgrounds: false, measure: false, outline: false, actions: false, interactions: false,
    sidebarOnboardingChecklist: false, menuOnboardingChecklist: false,
  },
  staticDirs: [
    { from: '../dashboard/public', to: '/dashboard' },
    // Inter and Unbounded for Storybook's own frame (manager.tsx); the stories get them from the dashboard's CSS.
    { from: '../node_modules/@fontsource-variable/inter/files', to: '/fonts' },
    { from: '../node_modules/@fontsource-variable/unbounded/files', to: '/fonts' },
  ],
  managerHead: (head) => `${head}<style>
    @font-face { font-family: 'Inter Variable'; font-style: normal; font-display: swap; font-weight: 100 900; src: url(/fonts/inter-latin-wght-normal.woff2) format('woff2-variations'); }
    @font-face { font-family: 'Unbounded Variable'; font-style: normal; font-display: swap; font-weight: 200 900; src: url(/fonts/unbounded-latin-wght-normal.woff2) format('woff2-variations'); }
  </style>`,
  async viteFinal(config) {
    return { ...config, base: '/', plugins: [...(config.plugins ?? []), banners()] };
  },
};

export default config;
