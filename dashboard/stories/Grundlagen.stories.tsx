// The foundations the components are built from: colour tokens, type, shapes, spacing, motion, icons and the colour schemes. Values are
// read live from the page (styles.css plus the toolbar's scheme and mode), so this page never goes stale.
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { THEME_PRESETS, chartPalette, normalizeTheme, themeLook, themeVariables, type DashboardTheme } from '../../src/shared/theme';
import walnut from '../src/assets/wood/walnut.webp';
import oak from '../src/assets/wood/oak.webp';
import { ICON_PATHS, Icon, type IconName } from '../src/icons';
import { Badge, Meter, Notice, TableWrap } from '../src/components/ui';
import { Bernis, RarityLabel } from '../src/me/visuals';

const GROUPS: { title: string; text: string; tokens: string[] }[] = [
  { title: 'Flächen', text: 'Von hinten nach vorn: App-Hintergrund, Seitenleiste, Seite, Karte. Eingabefelder haben ihre eigene Fläche.', tokens: ['--bg-app', '--bg-sidebar', '--bg-main', '--bg-card', '--bg-card-hover', '--bg-input', '--bg-hover', '--bg-active'] },
  { title: 'Linien', text: 'Trennlinien und Rahmen (Tailwind line, line-strong); Knöpfe, Chips und Abzeichen haben den Steuerrand (control), Eingabefelder den kräftigsten (field-line, 3:1 nach WCAG). Jede zweite Tabellenzeile liegt auf --stripe.', tokens: ['--border', '--border-strong', '--border-control', '--border-input', '--stripe'] },
  { title: 'Text', text: 'Vier Stufen; alle halten auf der Seite mindestens 4.5:1 (geprüft in tests/contrast.test.ts).', tokens: ['--text-strong', '--text', '--text-muted', '--text-faint'] },
  { title: 'Akzent', text: 'Kommt aus dem Theme des Mitglieds (src/shared/theme.ts) und ändert sich mit der Auswahl oben.', tokens: ['--accent', '--accent-strong', '--accent-hover', '--accent-ink', '--accent-text', '--accent-soft', '--accent-line', '--accent-2', '--chart-primary'] },
  { title: 'Zustände', text: 'Erfolg, Fehler und Warnung; --success und --danger für Knopfflächen, die anderen für Text und Icons.', tokens: ['--pos', '--neg', '--warning', '--success', '--danger', '--blurple'] },
  { title: 'Seltenheit', text: 'Nur an Artikeln: Beschriftung und Rand nach Seltenheit (Gewöhnlich bleibt neutral).', tokens: ['--rarity-rare', '--rarity-epic', '--rarity-legendary', '--rarity-mythic'] },
  { title: 'Ticket-Priorität', text: 'Nur an Ticket-Prioritäten, immer zusammen mit eigenem Symbol und Text.', tokens: ['--prio-urgent', '--prio-high', '--prio-medium', '--prio-low'] },
];
const TEXT_TOKENS = new Set(['--text-strong', '--text', '--text-muted', '--text-faint', '--accent-text', '--pos', '--neg', '--warning', '--rarity-rare', '--rarity-epic', '--rarity-legendary', '--rarity-mythic']);

// ---------- Contrast (WCAG relative luminance) ----------

const channels = (css: string) => (css.match(/[\d.]+/g) ?? []).map(Number);
const luminance = ([r, g, b]: number[]) => {
  const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
/** Contrast of a text colour (possibly translucent) on an opaque background, both as computed rgb()/rgba(). */
function contrast(fg: string, bg: string) {
  const [br, bgG, bb] = channels(bg);
  const [r, g, b, a = 1] = channels(fg);
  const mixed = [r * a + br * (1 - a), g * a + bgG * (1 - a), b * a + bb * (1 - a)];
  const [l1, l2] = [luminance(mixed), luminance([br, bgG, bb])].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const page = { padding: 'clamp(16px, 4vw, 36px)', background: 'var(--bg-main)', color: 'var(--text)', minHeight: '100vh', display: 'grid', gap: 30, alignContent: 'start' } as const;
const Section = ({ title, text, children }: { title: string; text?: string; children: ReactNode }) => (
  <section>
    <h2 style={{ marginBottom: 4 }}>{title}</h2>
    {text && <p style={{ color: 'var(--text-muted)', margin: '0 0 14px', maxWidth: 760 }}>{text}</p>}
    {children}
  </section>
);
const grid = (min: number) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, 100%), 1fr))`, gap: 12 }) as const;

/** One token: swatch, name, the value it has right now and, for text colours, the contrast on the page. */
function Token({ name }: { name: string }) {
  const swatch = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState('');
  const [ratio, setRatio] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = swatch.current;
    if (!el) return;
    const color = getComputedStyle(el).backgroundColor;
    setValue(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
    if (TEXT_TOKENS.has(name)) {
      const probe = document.createElement('span');
      probe.style.background = 'var(--bg-main)';
      el.append(probe);
      setRatio(contrast(color, getComputedStyle(probe).backgroundColor));
      probe.remove();
    }
  }, [name]);
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 10, borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <span ref={swatch} style={{ width: 40, height: 40, flex: 'none', borderRadius: 10, background: `var(${name})`, border: '1px solid var(--border-strong)' }} />
      <span style={{ minWidth: 0, display: 'grid', gap: 2 }}>
        <code style={{ color: 'var(--text-strong)', fontSize: 13 }}>{name}</code>
        <span style={{ color: 'var(--text-muted)', fontSize: 12, overflowWrap: 'anywhere' }}>{value}{ratio !== null && ` · Kontrast ${ratio.toFixed(1)}:1`}</span>
      </span>
    </div>
  );
}

function Colours() {
  return (
    <div style={page}>
      <div>
        <h1>Farben</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 6, maxWidth: 760 }}>
          Alle Farben als CSS-Variablen aus <code>dashboard/src/styles.css</code>, mit dem Wert im gewählten Theme. Im Code nie feste Farben verwenden, sondern <code>var(--name)</code> oder die Tailwind-Klassen (<code>bg-surface</code>, <code>text-mute</code> …).
        </p>
      </div>
      {GROUPS.map((group) => (
        <Section key={group.title} title={group.title} text={group.text}>
          <div style={grid(260)}>{group.tokens.map((name) => <Token key={name} name={name} />)}</div>
        </Section>
      ))}
    </div>
  );
}

// ---------- Colour roles ----------

/** Every colour on a page has one of these meanings; a colour without one of them stays neutral. */
const ROLES: { role: string; tokens: string; use: string; never: string; sample: ReactNode }[] = [
  { role: 'Neutral', tokens: 'Flächen, Text (ink, body, mute, faint), Linien (line, line-strong, control), tint, stripe', use: 'Alles ohne besondere Bedeutung: Karten, Texte, Rahmen, Icons, Abschnittsbeschriftungen, Zähler.', never: 'Weiß oder Schwarz mit Deckkraft (white/10, black/20) und feste Hex-Werte; dafür gibt es line und tint.', sample: <Badge>Geplant</Badge> },
  { role: 'Akzent', tokens: '--accent, --accent-text, accent-mute (Theme-Farbe)', use: 'Hauptaktion, aktiv oder ausgewählt, Fokus, Links, laufender Fortschritt, höchstens eine Hero-Fläche je Seite.', never: 'Dekoration, Icons in Listen, Überschriften, reine Zähler.', sample: <><button type="button" className="btn btn-primary btn-sm">Speichern</button><Badge tone="accent">Ausgewählt</Badge></> },
  { role: 'Erfolg', tokens: '--pos (Text, Rand), --success (Knopffläche)', use: 'An, aktiv, läuft, erledigt, im Besitz, Gewinne, Rabatte und Ersparnis, Annehmen.', never: 'Hauptaktionen ohne Erfolgsbedeutung.', sample: <><Badge on>Aktiv</Badge><span style={{ color: 'var(--pos)' }}>−20 %</span></> },
  { role: 'Warnung', tokens: '--warning (Text: text-warn)', use: 'Braucht Aufmerksamkeit, offen, läuft bald ab, nur für kurze Zeit, Kanal fehlt.', never: 'Angebote und Rabatte (die sind Erfolg), Dekoration.', sample: <><Badge tone="warn">Offen</Badge><span style={{ color: 'var(--warning)' }}>Nur bis Sonntag</span></> },
  { role: 'Gefahr', tokens: '--neg (Text, Rand), --danger (Knopffläche beim Überfahren)', use: 'Fehler, Löschen und Deaktivieren (btn-danger), Verluste, Abgelehnt.', never: 'Hervorhebungen ohne Fehler- oder Verlustbedeutung.', sample: <><button type="button" className="btn btn-danger btn-sm">Löschen</button><Badge tone="neg">Abgelehnt</Badge></> },
  { role: 'Bernis', tokens: 'Münz-Icons (Platin, Gold, Silber, Bronze)', use: 'Die Münzen tragen die Währung, der Betrag steht in Textfarbe; Gewinne in Erfolg, Ausgaben in Gefahr.', never: 'Eine eigene Geldfarbe für Beträge.', sample: <Bernis amount={123456} nowrap /> },
  { role: 'Seltenheit', tokens: '--rarity-rare … --rarity-mythic (text-rarity-*, border-rarity-*/40)', use: 'Nur an Artikeln: Beschriftung, Rand und Leuchten der Kachel.', never: 'Alles, was kein Artikel ist.', sample: <><RarityLabel rarity="rare" /><RarityLabel rarity="epic" /><RarityLabel rarity="legendary" /><RarityLabel rarity="mythic" /></> },
  { role: 'Rang, Priorität', tokens: 'Medaillen Gold, Silber, Bronze; --prio-*', use: 'Plätze 1 bis 3 in Ranglisten; Ticket-Prioritäten mit eigenem Symbol.', never: 'Andere Reihenfolgen oder Zustände.', sample: <span style={{ color: 'var(--prio-urgent)' }}>Dringend</span> },
  { role: 'Discord, Diagramme, Kunst', tokens: 'Discord-Farben, Diagrammpalette, Szenen', use: 'Discord-Vorschauen in Discords eigenen Farben, Datenfarben nur in Diagrammen, Event-Szenen, Logo und Holz als Illustration.', never: 'Bedienelemente oder Zustände außerhalb dieser Bereiche.', sample: <span className="mention">@Nexo</span> },
];

function Roles() {
  return (
    <div style={page}>
      <div>
        <h1>Farbrollen</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 6, maxWidth: 760 }}>
          Jede Farbe auf einer Seite hat genau eine dieser Bedeutungen, damit Gleiches überall gleich aussieht. Seiten bauen aus den gemeinsamen Komponenten (<code>Badge</code> mit <code>tone</code>, <code>Notice</code>, <code>Meter</code>, <code>btn-*</code>) und den Tailwind-Namen der Tokens, nie aus festen Hex-Werten.
        </p>
      </div>
      <TableWrap>
        <thead><tr><th>Rolle</th><th>Tokens</th><th>Wofür</th><th>Nicht für</th><th>Beispiel</th></tr></thead>
        <tbody>
          {ROLES.map((r) => (
            <tr key={r.role}>
              <td><b style={{ color: 'var(--text-strong)' }}>{r.role}</b></td>
              <td><code style={{ fontSize: 12 }}>{r.tokens}</code></td>
              <td>{r.use}</td>
              <td style={{ color: 'var(--text-muted)' }}>{r.never}</td>
              <td><span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>{r.sample}</span></td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <Section title="Rückmeldungen" text="Hinweise im Seitenfluss: neutral, Warnung, Fehler. Fortschritt läuft im Akzent und wird beim Abschluss grün.">
        <div style={{ display: 'grid', gap: 12, maxWidth: 640 }}>
          <Notice>Änderungen gelten erst nach dem Speichern.</Notice>
          <Notice tone="warn">Der Kanal ist für Nexo nicht sichtbar.</Notice>
          <Notice tone="danger">Die Daten konnten nicht geladen werden.</Notice>
          <Meter value={6} max={10} label="Laufend" />
          <Meter value={10} max={10} done label="Geschafft" />
        </div>
      </Section>
    </div>
  );
}

// The scales (dashboard/src/tailwind.css); tests/designScale.test.ts rejects every value that is not one of them.
const TYPE_STEPS: [string, string, string][] = [
  ['hero', '48', 'Die eine große Zahl einer Seite (Kontostand, Server-Übersicht).'],
  ['display', '36', 'Große Zahlen und Bühnen-Überschriften (Black Market, Saisonstufe).'],
  ['page', '28', 'Seitentitel (h1).'],
  ['section', '22', 'Abschnittsköpfe innerhalb einer Seite.'],
  ['heading', '18', 'h2, Dialogtitel, Namen in großen Kacheln.'],
  ['title', '16', 'Kartentitel (h3), Artikelnamen, Werte in Listen.'],
  ['copy', '14.5', 'Fließtext, Eingaben, Tabellenzellen, Knöpfe. Grundgröße der Seite.'],
  ['small', '13.5', 'Zweitrangiger Text: Beschreibungen, Reiter, Hinweise, kleine Knöpfe.'],
  ['caption', '12.5', 'Beschriftungen, Feldhinweise, Metadaten, Abzeichen, Tabellenköpfe.'],
  ['micro', '11', 'Nur Zähler und winzige Marken (Reiter-Zähler, Achsen).'],
];
const RADIUS_STEPS: [string, string, string][] = [
  ['tag', '--radius-xs', 'Code, Farbfelder, kleine Vorschauen im Text.'],
  ['control', '--radius-sm', 'Knöpfe, Eingaben, Reiter, Icon-Kacheln, Menüeinträge.'],
  ['box', '--radius-md', 'Kästen in Karten: Listenzeilen, Hinweise, Tabellen, Artikelkacheln.'],
  ['panel', '--radius-lg', 'Karten, Kennzahlen, Dialoge, große Bühnen.'],
  ['pill', '--radius-pill', 'Abzeichen, Chips, Pillen (in Cyberpunk ein schräges Etikett).'],
  ['full', '50 %', 'Kreise: Avatare, Punkte, Fortschrittsbalken.'],
];
const SPACE_STEPS: [string, number, string][] = [
  ['0.5', 2, 'Haarbreit: Punkt neben Text, Rahmen um Vorschauen.'],
  ['1', 4, 'Text zu seinem Hinweis, Titel zu seiner Unterzeile.'],
  ['1.5', 6, 'Icon zu Text in kleinen Teilen, Beschriftung zum Feld.'],
  ['2', 8, 'Zwischen Knöpfen und Chips in einer Reihe, Icon zu Text in Knöpfen.'],
  ['3', 12, 'Zwischen Zeilen und Feldern in einer Karte, zwischen kleinen Kacheln.'],
  ['4', 16, 'Zwischen Karten, Kartengitter, Innenabstand kleiner Kästen.'],
  ['5', 20, 'Kartenkopf zum Inhalt.'],
  ['6', 24, 'Innenabstand von Karten und Dialogen.'],
  ['8', 32, 'Seitenkopf zum ersten Inhalt.'],
  ['10', 40, 'Zwischen Abschnitten einer Seite, seitlicher Seitenrand ab Tablet.'],
];
const MOTION_STEPS: [string, string, string][] = [
  ['fast', '150 ms', 'Hover, Drücken, Farbwechsel.'],
  ['base', '250 ms', 'Schalter, wandernde Markierungen, alles was schließt oder geht.'],
  ['slow', '400 ms', 'Alles was erscheint: Seiten, Karten, Dialoge, sich füllende Balken.'],
  ['long', '800 ms', 'Diagramme zeichnen, Zahlen zählen hoch, Glanz über Kacheln.'],
];
const EASES: [string, string][] = [
  ['enter', 'Kommt an oder bewegt sich an einen neuen Platz (schnell los, sanft am Ziel).'],
  ['exit', 'Geht: beschleunigt hinaus.'],
  ['pop', 'Belohnungen, Dialoge, ein einrastender Schalter: schießt leicht über das Ziel.'],
  ['loop', 'Hin und her in Dauerschleifen.'],
];
const row = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '6px 16px', alignItems: 'baseline', padding: '12px 0', borderBottom: '1px solid var(--border)' } as const;
const Code = ({ children }: { children: ReactNode }) => <code style={{ color: 'var(--text-muted)', fontSize: 12 }}>{children}</code>;

function Type() {
  return (
    <div style={page}>
      <div>
        <h1>Schrift</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 6, maxWidth: 760 }}>
          Zwei Schriften: <b>Unbounded</b> (<code>--font-display</code>) für <code>h1</code> bis <code>h3</code>, <b>Inter</b> für alles andere. Jede Größe ist eine Rolle mit eigenem Zeilenabstand; die großen bringen ihre Laufweite mit. Man wählt nach dem, was der Text ist, nicht nach Augenmaß: <code>text-caption</code> statt <code>text-[12px]</code>.
        </p>
      </div>
      <div>
        {TYPE_STEPS.map(([name, px, use]) => (
          <div key={name} style={row}>
            <Code>text-{name} · {px} px</Code>
            <span className={`text-${name} text-ink`}>{name === 'hero' || name === 'display' ? '12.480' : 'Kanal und Rolle'}</span>
            <span className="text-caption text-mute">{use}</span>
          </div>
        ))}
      </div>
      <Section title="Gewicht und Laufweite" text="font-medium (500) für Beschriftungen und Bedienelemente, font-semibold (600) für Überschriften und Knöpfe, font-bold (700) für Hervorhebungen und Spielnamen, font-light (300) nur für große Zahlen. tracking-caps für kleine Großbuchstaben-Beschriftungen, tracking-headline für große Spieltitel in Großbuchstaben, tracking-tight für mittlere Überschriften.">
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <span className="text-caption font-semibold uppercase tracking-caps text-mute">Seltenheit</span>
          <span className="text-heading font-bold uppercase tracking-headline text-ink">Angebote der Woche</span>
          <span className="text-display font-light text-ink">2.450</span>
        </div>
      </Section>
    </div>
  );
}

function Shapes() {
  const shadows = [{ name: '--shadow', text: 'Dialoge, Speicherleiste, schwebende Teile' }, { name: '--card-shadow', text: 'Karten (im hellen Modus)' }, { name: '--ring', text: 'Fokusring um Eingaben' }];
  return (
    <div style={page}>
      <h1>Formen</h1>
      <Section title="Rundungen" text="Fünf Stufen plus Kreis, benannt nach dem, was gerundet wird. Die Werte kommen aus dem Theme: Cyberpunk schneidet dieselben Stufen schärfer und schräg an. Was in etwas anderem liegt, ist nie runder als sein Rahmen.">
        <div style={grid(210)}>
          {RADIUS_STEPS.map(([name, token, use]) => (
            <div key={name} style={{ display: 'grid', gap: 8 }}>
              <span className={`rounded-${name} border border-line-strong bg-surface`} style={{ height: name === 'full' ? 64 : 72, width: name === 'full' ? 64 : '100%' }} />
              <Code>rounded-{name} · {token}</Code>
              <span className="text-caption text-mute">{use}</span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Höhen der Bedienelemente" text="Knöpfe, Eingaben und Auswahlfelder sind 40 px hoch (--control-h), kleine Knöpfe, Filterchips und Icon-Knöpfe 32 px (--control-h-sm). So stehen Feld und Knopf in einer Reihe bündig.">
        <div className="flex flex-wrap items-center gap-2">
          <input className="input" style={{ width: 200 }} placeholder="Eingabe" />
          <button className="btn btn-primary">Speichern</button>
          <button className="btn btn-secondary btn-sm">Klein</button>
        </div>
      </Section>
      <Section title="Schatten und Fokus">
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          {shadows.map(({ name, text }) => (
            <div key={name} style={{ display: 'grid', gap: 10, width: 200 }}>
              <span style={{ height: 96, borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', boxShadow: `var(${name})` }} />
              <code style={{ fontSize: 12 }}>{name}</code>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{text}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Spacing() {
  return (
    <div style={page}>
      <div>
        <h1>Abstände</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 6, maxWidth: 760 }}>
          Ein 4-px-Raster mit zwei feinen Stufen (2 und 6 px) für enge Teile. Jede Stufe hat ihre Aufgabe, damit dieselbe Beziehung überall gleich weit ist. Halbe Stufen wie <code>gap-2.5</code> und feste Pixel wie <code>px-[11px]</code> gibt es nicht; ab 40 px nur noch 48, 64, 80, 96 und 128 für Seitenränder und Platz unter der Speicherleiste.
        </p>
      </div>
      <div>
        {SPACE_STEPS.map(([step, px, use]) => (
          <div key={step} style={row}>
            <Code>gap-{step} · p-{step} · m-{step} · {px} px</Code>
            <span style={{ display: 'block', width: px, height: 16, background: 'var(--accent)', borderRadius: 2 }} />
            <span className="text-caption text-mute">{use}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Motion() {
  const [run, setRun] = useState(0);
  return (
    <div style={page}>
      <div>
        <h1>Bewegung</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 6, maxWidth: 760 }}>
          Vier Dauern und vier Kurven, in CSS (<code>duration-fast</code>, <code>ease-enter</code>, <code>var(--dur-slow)</code>) und in GSAP (<code>MOTION.slow</code>, <code>MOTION.enter</code> aus <code>components/motion.ts</code>), beide gleich lang (geprüft in tests/designScale.test.ts). Wer weniger Bewegung eingestellt hat, sieht keine Einblendungen. Dauerschleifen (Ladekreis, Holo-Rahmen) und die Inszenierungen (Startseite, Münzflug, Feier, Event-Szenen) haben ihr eigenes Tempo.
        </p>
      </div>
      <button className="btn btn-secondary btn-sm" style={{ justifySelf: 'start' }} onClick={() => setRun((n) => n + 1)}>Abspielen</button>
      <div>
        {MOTION_STEPS.map(([name, ms, use]) => (
          <div key={name} style={row}>
            <Code>duration-{name} · MOTION.{name} · {ms}</Code>
            <span style={{ position: 'relative', height: 16, background: 'var(--stripe)', borderRadius: 999 }}>
              <span key={run} className={`motion-demo absolute inset-y-0 left-0 rounded-full bg-accent duration-${name} ease-enter`} style={{ width: 16, transitionProperty: 'left' }} />
            </span>
            <span className="text-caption text-mute">{use}</span>
          </div>
        ))}
        {EASES.map(([name, use]) => (
          <div key={name} style={row}>
            <Code>ease-{name} · MOTION.{name}</Code>
            <span style={{ position: 'relative', height: 16, background: 'var(--stripe)', borderRadius: 999 }}>
              <span key={run} className={`motion-demo absolute inset-y-0 left-0 rounded-full bg-accent duration-long ease-${name}`} style={{ width: 16, transitionProperty: 'left' }} />
            </span>
            <span className="text-caption text-mute">{use}</span>
          </div>
        ))}
      </div>
      <MotionKick run={run} />
    </div>
  );
}
/** Moves every demo dot to the end of its track one frame after a (re)start, so the transition runs. */
function MotionKick({ run }: { run: number }) {
  useLayoutEffect(() => {
    const dots = [...document.querySelectorAll<HTMLElement>('.motion-demo')];
    dots.forEach((dot) => { dot.style.left = '0'; });
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => dots.forEach((dot) => { dot.style.left = 'calc(100% - 16px)'; })));
    return () => cancelAnimationFrame(frame);
  }, [run]);
  return null;
}

function Icons() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (name: string) => {
    void navigator.clipboard?.writeText(`<Icon name="${name}" />`).then(() => setCopied(name), () => setCopied(null));
  };
  return (
    <div style={page}>
      <div>
        <h1>Icons</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 6, maxWidth: 760 }}>
          {Object.keys(ICON_PATHS).length} Linien-Icons aus <code>dashboard/src/icons.tsx</code>, 24er-Raster, Strichstärke 2, in <code>currentColor</code>. Ein Klick kopiert <code>{'<Icon name="…" />'}</code>. Neue Icons im selben Stil dort ergänzen.
        </p>
      </div>
      <div style={grid(120)}>
        {(Object.keys(ICON_PATHS) as IconName[]).map((name) => (
          <button key={name} type="button" onClick={() => copy(name)} title={`<Icon name="${name}" /> kopieren`}
            style={{ display: 'grid', gap: 8, justifyItems: 'center', padding: '16px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-strong)', cursor: 'copy', font: 'inherit' }}>
            <Icon name={name} size={24} />
            <code style={{ fontSize: 12, color: copied === name ? 'var(--accent-text)' : 'var(--text-muted)' }}>{copied === name ? 'kopiert' : name}</code>
          </button>
        ))}
      </div>
    </div>
  );
}

function Schemes() {
  return (
    <div style={page}>
      <div>
        <h1>Themes</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 6, maxWidth: 760 }}>
          Die Themes, die Mitglieder auf „Dashboard-Design“ wählen (<code>THEME_PRESETS</code> in <code>src/shared/theme.ts</code>). Jedes ist ein ganzer Look mit eigenem Modus: Flächen und Kopfbereich kommen aus <code>styles.css</code> (<code>data-theme</code>, <code>data-mode</code>), aus Akzent und Zweitfarbe errechnet <code>themeVariables</code> alle <code>--accent-*</code>-Werte.
        </p>
      </div>
      <div style={grid(220)}>
        {THEME_PRESETS.map((preset) => (
          <div key={preset.id} style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', height: 54, borderRadius: 10, overflow: 'hidden' }}>
              <span style={{ flex: 2, background: preset.primary }} /><span style={{ flex: 1, background: preset.secondary }} />
            </div>
            <b style={{ color: 'var(--text-strong)' }}>{preset.name} · {preset.mode === 'light' ? 'Hell' : 'Dunkel'}</b>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{preset.description}</span>
            <code style={{ fontSize: 12, color: 'var(--text-muted)' }}>{preset.id} · {preset.look} · {preset.primary} · {preset.secondary}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Every scheme in both modes ----------

/** Contrast of an element's text on the first opaque background behind it (itself or an ancestor; light tints are skipped). */
function useRatio<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [ratio, setRatio] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let host: HTMLElement | null = el;
    while (host && (channels(getComputedStyle(host).backgroundColor)[3] ?? 1) < 1) host = host.parentElement;
    if (host) setRatio(contrast(getComputedStyle(el).color, getComputedStyle(host).backgroundColor));
  }, []);
  return [ref, ratio] as const;
}
const Ratio = ({ value }: { value: number | null }) => value === null ? null : (
  <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: value >= 4.5 ? 'var(--text-faint)' : 'var(--neg)', fontWeight: value >= 4.5 ? 400 : 700 }}>
    {value.toFixed(1)}:1
  </span>
);
function Line({ token, label }: { token: string; label: string }) {
  const [ref, ratio] = useRatio<HTMLSpanElement>();
  return <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span ref={ref} style={{ color: `var(${token})` }}>{label}</span><Ratio value={ratio} /></span>;
}
function Button({ kind, label }: { kind: string; label: string }) {
  const [ref, ratio] = useRatio<HTMLButtonElement>();
  return <span style={{ display: 'grid', justifyItems: 'center', gap: 2 }}><button ref={ref} type="button" className={`btn btn-sm ${kind}`}>{label}</button><Ratio value={ratio} /></span>;
}

const COMBO_TEXT: [string, string][] = [
  ['--text-strong', 'Überschrift'], ['--text', 'Fließtext'], ['--text-muted', 'Nebentext'], ['--text-faint', 'Hinweis'],
  ['--accent-text', 'Akzenttext'], ['--accent-text-muted', 'Akzent leise'], ['--pos', 'Erfolg'], ['--neg', 'Fehler'], ['--warning', 'Warnung'],
];

/** One scheme in one mode, with its own tokens: data-mode switches styles.css's block, the inline style the accent. */
function Combo({ theme, name }: { theme: DashboardTheme; name: string }) {
  const light = theme.mode === 'light';
  const cyber = themeLook(theme) === 'cyber';
  const tone = light || cyber ? 'var(--scrim-color)' : 'var(--bg-main)';
  return (
    <div data-mode={theme.mode} data-theme={theme.preset} style={{ ...themeVariables(theme), display: 'grid', background: 'var(--bg-app)', color: 'var(--text)', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-strong)' } as CSSProperties}>
      {/* The header material with its wash, as behind every page title. */}
      <div style={{ position: 'relative', height: 72, display: 'grid', alignContent: 'center', padding: '0 16px' }}>
        {cyber
          ? <span className="cyber-grid" style={{ position: 'absolute', inset: 0 }} />
          : <img src={light ? oak : walnut} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
        <span style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, color-mix(in srgb, ${tone} var(--scrim), transparent) 70%, color-mix(in srgb, ${tone} 18%, transparent))` }} />
        {cyber && <span className="cyber-stripe" style={{ position: 'absolute', inset: 0 }} />}
        <b style={{ position: 'relative', color: 'var(--text-strong)', fontFamily: 'var(--font-display)', fontSize: 16 }}>{name}</b>
        <span style={{ position: 'relative', color: light ? 'var(--text-strong)' : 'var(--text-muted)', fontSize: 12 }}>{cyber ? 'Dunkel · Neongelb und Schraffur' : light ? 'Hell · Eiche' : 'Dunkel · Nussbaum'}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', background: 'var(--bg-main)' }}>
        <div style={{ background: 'var(--bg-sidebar)', padding: '12px 8px', display: 'grid', gap: 6, alignContent: 'start' }}>
          <span style={{ height: 8, borderRadius: 4, background: 'var(--accent)' }} />
          <span style={{ height: 8, borderRadius: 4, background: 'var(--border-strong)' }} />
          <span style={{ height: 8, borderRadius: 4, background: 'var(--border-strong)' }} />
        </div>
        <div style={{ padding: 12, display: 'grid', gap: 10 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--card-shadow)', padding: 12, display: 'grid', gap: 4, fontSize: 13 }}>
            {COMBO_TEXT.map(([token, label]) => <Line key={token} token={token} label={label} />)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <span className="badge badge-brand">Akzent</span><span className="badge badge-on">An</span><span className="badge badge-warn">Achtung</span><span className="badge badge-neg">Fehler</span><span className="badge badge-off">Aus</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'start' }}>
            <Button kind="btn-primary" label="Speichern" /><Button kind="btn-secondary" label="Vorschau" />
            <Button kind="btn-success" label="OK" /><Button kind="btn-danger" label="Löschen" />
          </div>
          <input className="input" defaultValue="Eingabefeld" aria-label="Eingabefeld" />
          <div style={{ display: 'flex', height: 14, borderRadius: 4, overflow: 'hidden' }} title="Diagrammfarben">
            {chartPalette(theme).map((color) => <span key={color} style={{ flex: 1, background: color }} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Combinations() {
  return (
    <div style={page}>
      <div>
        <h1>Farbkombinationen</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 6, maxWidth: 760 }}>
          Alle Themes in ihrem Modus auf einer Seite: Kopfbereich mit Lasur, Flächen, die Textstufen mit ihrem Kontrast auf der Karte, Abzeichen, Knöpfe (Kontrast der Schrift auf dem Knopf), ein Eingabefeld und die Diagrammfarben. Werte unter 4.5:1 sind rot markiert.
        </p>
      </div>
      <div style={grid(320)}>
        {THEME_PRESETS.map((preset) => <Combo key={preset.id} name={preset.name} theme={normalizeTheme({ preset: preset.id })} />)}
      </div>
    </div>
  );
}

export default { title: 'Grundlagen', tags: ['!autodocs'], parameters: { switches: ['scheme', 'mode'] } } satisfies Meta;

export const Farbrollen: StoryObj = { render: () => <Roles /> };
export const Farben: StoryObj = { render: () => <Colours /> };
export const Schrift: StoryObj = { parameters: { switches: ['mode'] }, render: () => <Type /> };
export const Formen: StoryObj = { render: () => <Shapes /> };
export const Abstaende: StoryObj = { name: 'Abstände', parameters: { switches: ['mode'] }, render: () => <Spacing /> };
export const Bewegung: StoryObj = { parameters: { switches: ['mode'] }, render: () => <Motion /> };
export const IconSet: StoryObj = { name: 'Icons', parameters: { switches: ['mode'] }, render: () => <Icons /> };
export const Farbvorlagen: StoryObj = { name: 'Themes', parameters: { switches: ['mode'] }, render: () => <Schemes /> };
export const Farbkombinationen: StoryObj = { parameters: { switches: [] }, render: () => <Combinations /> };
