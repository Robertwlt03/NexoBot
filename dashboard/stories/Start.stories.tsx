// The start page: what this Storybook shows, what the toolbar switches do and how to find your way around.
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { THEME_PRESETS } from '../../src/shared/theme';
import { NexoLogo } from '../src/components/NexoLogo';
import { PAGES } from './pages';
import { openStory } from './frames';

type Globals = { scheme: string; mode: string; device: string };

const AREAS = [
  { id: 'übersicht--alle-seiten', title: 'Übersicht', text: `Alle ${PAGES.length} Dashboard-Seiten auf einmal, gruppiert wie die Navigation: Start, Server, Mein Profil und Owner. Jede Vorschau ist die echte Seite mit Beispieldaten. Ein Klick öffnet sie groß, mit dem Regler „Größe“ machst du die Vorschauen größer oder kleiner.` },
  { id: 'vergleich--alle-farbvorlagen', title: 'Vergleich', text: 'Eine Seite in allen zwölf Farbvorlagen nebeneinander. Welche Seite, wählst du oben auf der Seite. Hell oder dunkel und Desktop oder Handy kommen aus der Leiste.' },
  { id: 'discord--nachrichten', title: 'Discord', text: 'Nexos Antworten im Chat, gebaut mit dem echten Code des Bots (nexoCard, nexoMessage) und gefärbt wie für Mitglieder mit eigenem Dashboard-Design. Unter jeder Nachricht zeigt „Code anzeigen“ den Aufruf, der sie baut.' },
  { id: 'grundlagen--farben', title: 'Grundlagen', text: 'Farben mit Wert und Kontrast im gewählten Modus, Schrift, Rundungen und Schatten, alle Icons zum Kopieren und die zwölf Farbvorlagen.' },
  { id: 'komponenten-aktionen-knöpfe--arten', title: 'Komponenten', text: 'Jeder Baustein des Dashboards mit Anleitung: wann man ihn nimmt, alle Eigenschaften mit Typ, Beispiele mit „Show code“ zum Kopieren. Unten im Bereich „Controls“ änderst du Eigenschaften live, „Accessibility“ prüft Kontrast und Bedienbarkeit.' },
];

const SWITCHES = [
  { title: 'Farbvorlage · Auswahl', text: `Klick auf „Farbvorlage“ mit den zwei Farbtupfern öffnet die Liste der zwölf Vorlagen aus „Dashboard-Design“: ${THEME_PRESETS.map((p) => p.name).join(', ')}. Die aktive hat ein Häkchen.` },
  { title: 'Modus · Schalter', text: 'Zwei Seiten, Dunkel oder Hell; die gedrückte ist aktiv. Auf der Discord-Seite wechselt auch der Chat zwischen Discords dunklem und hellem Aussehen.' },
  { title: 'Gerät · Schalter', text: 'Desktop mit 1280 Pixeln Breite oder Handy mit 390 Pixeln; die gedrückte ist aktiv. Auf „Handy“ zeigt jede Seite das echte Handy-Layout in einem Handy-Rahmen.' },
];

const TOOLS = [
  'Die Seitenleiste links zeigt nur Start und die vier Bereiche. Einzelne Seiten öffnest du über die Übersicht oder mit der Suche (⌘K): Tipp den Namen der Seite ein, zum Beispiel „Shop“.',
  'Ganz links in der Leiste lädt der Pfeil die Ansicht neu. Rechts sitzen Zoom und ein Link zum Öffnen in einem neuen Tab.',
  'Am Handy zeigt die Leiste nur die Symbole (Farbtupfer, Mond und Sonne, Bildschirm und Handy); Zoom und die übrigen Storybook-Werkzeuge sind dort ausgeblendet.',
  'Übersicht und Vergleich laden alle Vorschauen auf einmal und zeigen solange eine Ladeanzeige; danach erscheinen sie zusammen, und du bleibst oben auf der Seite.',
  'Die gewählten Einstellungen stehen in der Adresse; du kannst eine Ansicht also als Lesezeichen speichern oder weitergeben.',
  'Das Zahnrad oben links zeigt alle Tastenkürzel.',
];

const Box = ({ title, children, onClick }: { title: string; children: ReactNode; onClick?: () => void }) => (
  <section onClick={onClick} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 20px', cursor: onClick ? 'pointer' : undefined }}>
    <h3 style={{ fontSize: 17, marginBottom: 6 }}>{title}{onClick ? ' →' : ''}</h3>
    <div style={{ color: 'var(--text-muted)', lineHeight: 1.55 }}>{children}</div>
  </section>
);

function Start({ globals }: { globals: Globals }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text)', padding: '36px clamp(16px, 4vw, 48px) 60px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gap: 30 }}>
        <header style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <NexoLogo className="w-24" />
          <div style={{ flex: 1, minWidth: 260 }}>
            <h1 style={{ fontSize: 34 }}>Nexo Storybook</h1>
            <p style={{ color: 'var(--text-muted)', marginTop: 6, maxWidth: 720, lineHeight: 1.55 }}>
              Das ganze Nexo-Dashboard auf einen Blick: jede Seite mit Beispieldaten, in jeder Farbvorlage, hell und dunkel, am Desktop und am Handy. Dazu die Nachrichten in Discord und die Bausteine der Seiten.
            </p>
          </div>
        </header>

        <div>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Die drei Schalter oben in der Leiste</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 14 }}>Die Leiste zeigt nur die Schalter, die auf der offenen Seite etwas ändern. Auf dieser Textseite ist das nur der Modus; im Vergleich fehlt die Farbvorlage, weil er alle zwölf zeigt; Logo, Münzen und Profilkarte haben feste Farben. Die Wahl bleibt beim Wechsel erhalten.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {SWITCHES.map((s) => <Box key={s.title} title={s.title}>{s.text}</Box>)}
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Die Bereiche</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {AREAS.map((a) => <Box key={a.id} title={a.title} onClick={() => openStory(a.id, globals)}>{a.text}</Box>)}
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Zurechtfinden</h2>
          <ul style={{ display: 'grid', gap: 8, paddingLeft: 20, color: 'var(--text-muted)', lineHeight: 1.55 }}>
            {TOOLS.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>

        <div>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Gut zu wissen</h2>
          <ul style={{ display: 'grid', gap: 8, paddingLeft: 20, color: 'var(--text-muted)', lineHeight: 1.55 }}>
            <li>Starten mit <code>npm run storybook</code>, dann <code>http://localhost:6006</code> öffnen.</li>
            <li>Die Beispieldaten kommen aus <code>dashboard/mock-fixtures.ts</code>, dieselben wie in der Mock-Vorschau. Die Datei liegt nur lokal; fehlt sie, zeigen die Seiten ihren Fehlerzustand.</li>
            <li>Die Discord-Nachrichten und ihre Banner baut der Entwicklungsserver mit dem Code des Bots. In der statischen Fassung (<code>npm run build-storybook</code>) fehlen sie. Eine neue Beispielnachricht kommt als Funktion in <code>.storybook/discordCards.ts</code>.</li>
            <li>Eine neue Komponente bekommt eine Datei in <code>dashboard/stories/components/</code>; ihre Anleitungsseite entsteht von selbst aus den Stories und den Kommentaren im Code.</li>
            <li>Eine neue Dashboard-Seite kommt in <code>dashboard/stories/pages.ts</code> und <code>Seiten.stories.tsx</code>, dann erscheint sie in Übersicht und Vergleich.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// Text page without accent colours: only light/dark changes it.
export default { title: 'Start', tags: ['!autodocs'], parameters: { switches: ['mode'] } } satisfies Meta;

export const Willkommen: StoryObj = {
  render: (_args, { globals }) => <Start globals={globals as Globals} />,
};
