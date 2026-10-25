// Nexo's answers in Discord, built with the bot's own code (.storybook/discordCards.ts: nexoCard, nexoMessage) and
// painted in the toolbar's colour scheme like the bot does for members with their own Dashboard-Design. Under each
// message, "Code anzeigen" shows the call that builds it. Needs the Storybook dev server (`npm run storybook`).
import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { messagePalette } from '../../src/shared/theme';
import { themeFor } from '../../.storybook/sample';
import { NexoAnswer, discordStyles, type Part } from './discord';

interface Card { id: string; title: string; code: string; payload: { components: Part[]; flags?: number } }

function Channel({ scheme, mode }: { scheme: string; mode: 'dark' | 'light' }) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const palette = encodeURIComponent(JSON.stringify(messagePalette(themeFor(scheme, mode))));
    fetch(`/storybook/discord-cards?palette=${palette}`)
      .then((res) => (res.ok ? res.json() as Promise<Card[]> : Promise.reject(new Error(String(res.status)))))
      .then(setCards, () => setFailed(true));
  }, [scheme, mode]);

  // The answer colours follow the member's scheme; the channel itself follows light/dark like Discord's own theme.
  return (
    <div className={`dc-channel ${mode}`}>
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
