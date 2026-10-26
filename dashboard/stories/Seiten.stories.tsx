// Every dashboard page as its own story, with the sample data and the toolbar's colour scheme. The sidebar hides
// them (tag `seite`); the board (Übersicht) and the comparison (Vergleich) show them as live previews.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { App } from '../src/App';
import { fixtures } from '../../.storybook/sample';
import { pageByKey } from './pages';

const firstGuild = () => (fixtures?.routes['/guilds'] as { id: string }[] | undefined)?.[0]?.id ?? '0';

function page(key: string): StoryObj {
  const entry = pageByKey(key);
  return {
    name: entry.label,
    parameters: { loggedOut: entry.path === '/' },
    render: () => <App initialPath={entry.path.replace(':guild', firstGuild())} />,
  };
}

export default { title: 'Seiten', tags: ['seite', '!autodocs'] } satisfies Meta;

export const Startseite = page('startseite');
export const Serverauswahl = page('serverauswahl');
export const ServerUebersicht = page('server-uebersicht');
export const ServerStatistiken = page('server-statistiken');
export const ServerAllgemein = page('server-allgemein');
export const ServerBefehle = page('server-befehle');
export const ServerAutomod = page('server-automod');
export const ServerModeration = page('server-moderation');
export const ServerProtokolle = page('server-protokolle');
export const ServerWillkommen = page('server-willkommen');
export const ServerVerifizierung = page('server-verifizierung');
export const ServerReaktionsrollen = page('server-reaktionsrollen');
export const ServerTickets = page('server-tickets');
export const ServerBewerbungen = page('server-bewerbungen');
export const ServerLevel = page('server-level');
export const ServerWirtschaft = page('server-wirtschaft');
export const ServerGewinnspiele = page('server-gewinnspiele');
export const ServerGeburtstage = page('server-geburtstage');
export const ServerZaehlspiel = page('server-zaehlspiel');
export const ServerJoinToCreate = page('server-join-to-create');
export const ServerServerStatistiken = page('server-server-statistiken');
export const ServerMusik = page('server-musik');
export const ServerMeldungen = page('server-meldungen');
export const Profil = page('profil');
export const Shop = page('shop');
export const BlackMarket = page('black-market');
export const Inventar = page('inventar');
export const Verlauf = page('verlauf');
export const Ranglisten = page('ranglisten');
export const Erfolge = page('erfolge');
export const Saison = page('saison');
export const Design = page('design');
export const OwnerUebersicht = page('owner-uebersicht');
export const OwnerArtikel = page('owner-artikel');
export const OwnerEvents = page('owner-events');
export const OwnerBlackMarket = page('owner-black-market');
export const OwnerBernis = page('owner-bernis');
export const OwnerEinstellungen = page('owner-einstellungen');
