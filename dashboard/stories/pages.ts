// Every dashboard page, grouped like the dashboard navigation. `key` is the story id in Seiten.stories.tsx
// (export name in kebab case), `path` the route; `:guild` is replaced by the first sample server.

export interface PageEntry { key: string; label: string; path: string }
export interface PageGroup { title: string; pages: PageEntry[] }

const server = (key: string, label: string, id: string): PageEntry => ({ key: `server-${key}`, label, path: `/servers/:guild/${id}` });

export const PAGE_GROUPS: PageGroup[] = [
  { title: 'Start und Zugang', pages: [
    { key: 'startseite', label: 'Startseite', path: '/' },
    { key: 'serverauswahl', label: 'Serverauswahl', path: '/servers' },
    { key: 'server-uebersicht', label: 'Server-Übersicht', path: '/servers/:guild' },
  ] },
  { title: 'Server · Allgemein', pages: [server('statistiken', 'Statistiken', 'insights'), server('allgemein', 'Allgemein', 'general'), server('befehle', 'Befehle', 'commands')] },
  { title: 'Server · Moderation', pages: [server('automod', 'AutoMod', 'automod'), server('moderation', 'Moderation', 'moderation'), server('protokolle', 'Protokolle', 'logging')] },
  { title: 'Server · Community', pages: [
    server('willkommen', 'Willkommen', 'welcome'), server('verifizierung', 'Verifizierung', 'verification'),
    server('reaktionsrollen', 'Reaktionsrollen', 'reactionroles'), server('tickets', 'Tickets', 'tickets'), server('bewerbungen', 'Bewerbungen', 'applications'),
  ] },
  { title: 'Server · Engagement', pages: [
    server('level', 'Level', 'leveling'), server('wirtschaft', 'Wirtschaft', 'economy'), server('gewinnspiele', 'Gewinnspiele', 'giveaways'),
    server('geburtstage', 'Geburtstage', 'birthdays'), server('zaehlspiel', 'Zählspiel', 'counting'),
  ] },
  { title: 'Server · Werkzeuge', pages: [
    server('join-to-create', 'Join-to-Create', 'jointocreate'), server('server-statistiken', 'Server-Statistiken', 'serverstats'),
    server('musik', 'Musik', 'music'), server('meldungen', 'Meldungen', 'reports'),
  ] },
  { title: 'Mein Profil', pages: [
    { key: 'profil', label: 'Profil', path: '/me' }, { key: 'shop', label: 'Shop', path: '/me/shop' },
    { key: 'black-market', label: 'Black Market', path: '/me/blackmarket' }, { key: 'inventar', label: 'Inventar', path: '/me/inventar' },
    { key: 'verlauf', label: 'Verlauf', path: '/me/verlauf' }, { key: 'ranglisten', label: 'Ranglisten', path: '/me/ranglisten' },
    { key: 'erfolge', label: 'Erfolge', path: '/me/erfolge' }, { key: 'saison', label: 'Saison', path: '/me/saison' },
    { key: 'design', label: 'Dashboard-Design', path: '/me/design' },
  ] },
  { title: 'Owner', pages: [
    { key: 'owner-uebersicht', label: 'Übersicht', path: '/owner' }, { key: 'owner-artikel', label: 'Artikel', path: '/owner/artikel' },
    { key: 'owner-events', label: 'Events', path: '/owner/events' }, { key: 'owner-black-market', label: 'Black Market', path: '/owner/blackmarket' },
    { key: 'owner-bernis', label: 'Bernis vergeben', path: '/owner/bernis' }, { key: 'owner-einstellungen', label: 'Einstellungen', path: '/owner/einstellungen' },
  ] },
];

export const PAGES = PAGE_GROUPS.flatMap((group) => group.pages);
export const pageByKey = (key: string) => PAGES.find((page) => page.key === key)!;

/** Preview URL of one page in a given look, for the iframes of the overviews. */
export function pageFrameUrl(key: string, globals: { scheme: string; mode: string }) {
  return `iframe.html?id=seiten--${key}&viewMode=story&globals=scheme:${globals.scheme};mode:${globals.mode}`;
}
