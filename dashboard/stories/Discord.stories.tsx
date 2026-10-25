// Nexo's answers in Discord, in the colour scheme from the toolbar (like members see them with their own
// Dashboard-Design). Banners need the Storybook dev server (`npm run storybook`), which draws them like the bot.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { messagePalette } from '../../src/shared/theme';
import { CoinIcon } from '../src/components/CoinIcon';
import { themeFor } from '../../.storybook/preview';
import { Bar, DiscordMessage, discordStyles } from './discord';

function Channel({ scheme }: { scheme: string }) {
  const palette = messagePalette(themeFor(scheme, 'dark'));
  return (
    <div className="dc-channel">
      <style>{discordStyles}</style>
      <div className="dc-head"><i>#</i>allgemein<small>Farbvorlage oben in der Leiste umstellen</small></div>
      <div className="dc-grid">
        <DiscordMessage palette={palette} role="nexo" motif="quests" kicker="Tagesaufgaben" title="1 von 3 geschafft" time="18:04" ephemeral
          buttons={[{ label: 'Saisonpfad', link: true }, { label: 'Zum Shop', link: true }]}>
          <div><p>✅ <s>Schreib 25 Nachrichten</s></p><p className="dc-small">geschafft · <span className="dc-coins"><CoinIcon tier="bronze" size={16} />30</span></p></div>
          <div><p>⬜ <b>Reagiere 10-mal mit einem Emoji</b></p><p><Bar value={4} max={10} /> 4/10 · <span className="dc-coins"><CoinIcon tier="bronze" size={16} />20</span></p></div>
          <div><p>⬜ <b>Spiel 3 Minispiele</b></p><p><Bar value={1} max={3} /> 1/3 · <span className="dc-coins"><CoinIcon tier="bronze" size={16} />30</span></p></div>
          <div className="dc-sep" />
          <div><p><b>Saison Oktober 2026</b> · Stufe 5 von 10</p><p><Bar value={455} max={540} /> 455 / 540 Punkte</p></div>
        </DiscordMessage>

        <DiscordMessage palette={palette} role="gold" kicker="Bernis" title="Dein Kontostand" time="18:05" ephemeral
          buttons={[{ label: 'Zum Shop', link: true }, { label: 'Tagesbonus abholen', link: true }]}>
          <p style={{ fontSize: 26, fontWeight: 700, color: '#f2f3f5' }}><span className="dc-coins"><CoinIcon tier="silver" size={30} />28</span>{' '}<span className="dc-coins"><CoinIcon tier="bronze" size={30} />50</span></p>
          <p className="dc-small">2.850 Bernis insgesamt</p>
          <div className="dc-sep" />
          <p>Bernis bekommst du für Level-ups, Minispiele, Erfolge, Tagesaufgaben und den Tagesbonus.</p>
        </DiscordMessage>

        <DiscordMessage palette={palette} role="nexo" motif="gift" title="Steam-Gutschein 20 €" time="11:42"
          buttons={[{ label: 'Teilnehmen' }, { label: 'Beenden' }]}>
          <p>Klick auf den Button unten, um teilzunehmen!</p>
          <div className="dc-sep" />
          <p><b>Veranstaltet von:</b> <span className="dc-mention">@Alex</span></p>
          <p><b>Gewinner:</b> 1 · <b>Teilnahmen:</b> 17</p>
          <p><b>Endet</b> <span className="dc-ts">in 3 Stunden</span></p>
        </DiscordMessage>

        <DiscordMessage palette={palette} role="calm" motif="giftEnded" kicker="Gewinnspiel" title="Beendet" time="15:10">
          <p>Gewonnen hat <span className="dc-mention">@Lena</span>. Danke fürs Mitmachen!</p>
        </DiscordMessage>

        <DiscordMessage palette={palette} role="amber" kicker="Moderation" title="Verwarnung erteilt" time="15:12">
          <p><span className="dc-mention">@Max</span> wurde verwarnt: Spam in #allgemein.</p>
        </DiscordMessage>

        <DiscordMessage palette={palette} role="success" kicker="Verifizierung" title="Du bist verifiziert" time="15:14" ephemeral>
          <p>Ab jetzt siehst du alle Kanäle des Servers.</p>
        </DiscordMessage>

        <DiscordMessage palette={palette} role="danger" kicker="Fehler" title="Das hat nicht geklappt" time="15:15" ephemeral>
          <p>Dieses Mitglied ist nicht (mehr) auf diesem Server.</p>
        </DiscordMessage>

        <DiscordMessage palette={palette} role="warn" kicker="Profil-Shop" title="Gerade nicht erreichbar" time="15:16" ephemeral>
          <p>Das Dashboard ist gerade nicht erreichbar. Versuch es später noch einmal.</p>
        </DiscordMessage>

        <DiscordMessage palette={palette} role="info" kicker="Hilfe" title="Alle Befehle" time="15:18" ephemeral
          buttons={[{ label: '«', disabled: true }, { label: '‹', disabled: true }, { label: 'Seite 1 von 3', disabled: true }, { label: '›' }, { label: '»' }]}>
          <p>Mit <span className="dc-mention">/profil aufgaben</span> siehst du deine drei Tagesaufgaben.</p>
        </DiscordMessage>

        <DiscordMessage palette={palette} role="pink" kicker="Geburtstag" title="Alles Gute, Lena!" time="08:00">
          <p>Der ganze Server feiert mit dir.</p>
        </DiscordMessage>
      </div>
    </div>
  );
}

export default { title: 'Discord', parameters: { options: { showPanel: false } } } satisfies Meta;

export const Nachrichten: StoryObj = {
  name: 'Nachrichten',
  render: (_args, { globals }) => <Channel scheme={globals.scheme as string} />,
};
