// Storybook: every dashboard page with sample data, the overviews (board, comparison, Discord), the foundations and a
// docs page per component. Run with `npm run storybook`. Sample data comes from the local dashboard/mock-fixtures.ts.
import type { StorybookConfig } from '@storybook/react-vite';
import type { Plugin, ViteDevServer } from 'vite';
import { readFileSync } from 'node:fs';
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

/**
 * The Discord story's messages (/storybook/discord-cards?palette=<json>): built by .storybook/discordCards.ts with the
 * bot's own code, painted in the member's palette like the bot does (paintPayload), plus each sample's source.
 */
const discordCards = (): Plugin => ({
  name: 'nexo-discord-cards',
  configureServer(server: ViteDevServer) {
    server.middlewares.use('/storybook/discord-cards', async (req, res, next) => {
      try {
        // Banners only go into cards when the dashboard URL is public; the story rewrites them to this server.
        if (!process.env.DASHBOARD_URL?.startsWith('https://')) process.env.DASHBOARD_URL = 'https://nexo.example';
        const file = `${root}.storybook/discordCards.ts`;
        const [{ SAMPLES }, { paintPayload }] = await Promise.all([server.ssrLoadModule(file), server.ssrLoadModule(`${root}src/utils/messagePalette.ts`)]);
        const palette = JSON.parse(new URL(req.url ?? '', 'http://x').searchParams.get('palette') ?? 'null');
        const source = readFileSync(file, 'utf8');
        const cards = SAMPLES.map(({ id, title, build }: { id: string; title: string; build: () => unknown }) => ({
          id, title,
          payload: palette ? paintPayload(build(), palette) : build(),
          code: /export function \w+\(\) \{\n[\s\S]*?\n\}\n/.exec(source.slice(source.indexOf(`export function ${id}()`)))?.[0].trim() ?? '',
        }));
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(cards));
      } catch (error) {
        next(error);
      }
    });
  },
});

const config: StorybookConfig = {
  stories: ['../dashboard/stories/**/*.stories.tsx'],
  framework: { name: '@storybook/react-vite', options: { builder: { viteConfigPath: 'dashboard/vite.config.ts' } } },
  // Docs: a page per component (description, props table, examples with their code); a11y: accessibility checks.
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  docs: { defaultName: 'Anleitung' },
  // Single pages are only shown inside the overviews; the sidebar keeps the overviews and the components.
  tags: { seite: { defaultFilterSelection: 'exclude' } },
  // Storybook's own measuring tools and its viewport/background switches would compete with our toolbar. Actions
  // stay on: the component stories log their callbacks (onChange, onClick …) there.
  features: {
    viewport: false, backgrounds: false, measure: false, outline: false, interactions: false,
    sidebarOnboardingChecklist: false, menuOnboardingChecklist: false,
  },
  staticDirs: [{ from: '../dashboard/public', to: '/dashboard' }],
  async viteFinal(config) {
    return { ...config, base: '/', plugins: [...(config.plugins ?? []), banners(), discordCards()] };
  },
};

export default config;
