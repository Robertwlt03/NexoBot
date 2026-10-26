// Nexo's answers in Discord, built with the bot's own code (.storybook/discordCards.ts: nexoCard, nexoMessage) and
// painted in the toolbar's colour scheme like the bot does for members with their own Dashboard-Design. Under each
// message, "Code anzeigen" shows the call that builds it. Needs the Storybook dev server (`npm run storybook`).
import { useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { messagePalette } from '../../src/shared/theme';
import { themeFor } from '../../.storybook/sample';
import { inTransition } from '../../.storybook/transition';
import { NexoAnswer, discordStyles, type Part } from './discord';

interface Card { id: string; title: string; code: string; payload: { components: Part[]; flags?: number } }

/** Loads the cards' banners (drawn per colour) before they are shown, so they do not pop in after the crossfade. */
function preloadBanners(cards: Card[]) {
  const urls = [...new Set(JSON.stringify(cards).match(/\/dashboard\/banners\/[^"]+/g) ?? [])];
  const loads = urls.map((url) => { const image = new Image(); image.src = url; return image.decode().catch(() => undefined); });
  return Promise.race([Promise.all(loads), new Promise((resolve) => setTimeout(resolve, 1500))]);
}

function Channel({ scheme, mode }: { scheme: string; mode: 'dark' | 'light' }) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [failed, setFailed] = useState(false);
  const loaded = useRef(false);
  // The cards are painted in the scheme on the server; a switch fetches them inside the theme crossfade (layout
  // effect: queued before the crossfade takes its snapshot), so old and new cards blend instead of jumping.
  useLayoutEffect(() => {
    const palette = encodeURIComponent(JSON.stringify(messagePalette(themeFor(scheme, mode))));
    const load = () => fetch(`/storybook/discord-cards?palette=${palette}`)
      .then((res) => (res.ok ? res.json() as Promise<Card[]> : Promise.reject(new Error(String(res.status)))))
      .then(async (next) => { await preloadBanners(next); flushSync(() => setCards(next)); }, () => setFailed(true));
    if (loaded.current) inTransition(load);
    else void load();
    loaded.current = true;
  }, [scheme, mode]);

  // The answer colours follow the member's scheme; the channel itself follows light/dark (data-mode) like Discord's.
  return (
    <div className="dc-channel">
      <style>{discordStyles}</style>
      <div className="dc-head"><i>#</i>allgemein<small>Gebaut mit dem Code des Bots · „Code anzeigen“ unter jeder Nachricht</small></div>
      {failed && <p style={{ padding: '20px 24px' }}>Die Nachrichten baut der Storybook-Entwicklungsserver mit dem Code des Bots. Starte ihn mit <code>npm run storybook</code>; in der statischen Fassung fehlen sie.</p>}
      <div className="dc-grid">
        {cards?.map((card, i) => (
          <div key={card.id}>
            <NexoAnswer components={card.payload.components} flags={card.payload.flags} time={`18:${String(4 + i).padStart(2, '0')}`} />
            <details className="dc-code-block">
              <summary>Code anzeigen · {card.title}</summary>
              <pre>{card.code}</pre>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}

export default { title: 'Discord', tags: ['!autodocs'] } satisfies Meta;

export const Nachrichten: StoryObj = {
  render: (_args, { globals }) => <Channel scheme={globals.scheme} mode={globals.mode} />,
};
