// The foundations the components are built from: colour tokens, type, shapes, icons and the colour schemes. Values are
// read live from the page (styles.css plus the toolbar's scheme and mode), so this page never goes stale.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { THEME_PRESETS } from '../../src/shared/theme';
import { ICON_PATHS, Icon, type IconName } from '../src/icons';

const GROUPS: { title: string; text: string; tokens: string[] }[] = [
  { title: 'Flächen', text: 'Von hinten nach vorn: App-Hintergrund, Seitenleiste, Seite, Karte. Eingabefelder haben ihre eigene Fläche.', tokens: ['--bg-app', '--bg-sidebar', '--bg-main', '--bg-card', '--bg-card-hover', '--bg-input', '--bg-hover', '--bg-active'] },
  { title: 'Linien', text: 'Trennlinien und Rahmen; Eingabefelder brauchen den kräftigeren Rand (3:1 nach WCAG).', tokens: ['--border', '--border-strong', '--border-input'] },
  { title: 'Text', text: 'Vier Stufen; alle halten auf der Seite mindestens 4.5:1 (geprüft in tests/contrast.test.ts).', tokens: ['--text-strong', '--text', '--text-muted', '--text-faint'] },
  { title: 'Akzent', text: 'Kommt aus der Farbvorlage des Mitglieds (src/shared/theme.ts) und ändert sich mit der Auswahl oben.', tokens: ['--accent', '--accent-strong', '--accent-hover', '--accent-ink', '--accent-text', '--accent-soft', '--accent-line', '--accent-2', '--chart-primary'] },
  { title: 'Zustände', text: 'Erfolg, Fehler und Warnung; --success und --danger für Knopfflächen, die anderen für Text und Icons.', tokens: ['--pos', '--neg', '--warning', '--success', '--danger', '--blurple'] },
];
const TEXT_TOKENS = new Set(['--text-strong', '--text', '--text-muted', '--text-faint', '--accent-text', '--pos', '--neg', '--warning']);

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
          Alle Farben als CSS-Variablen aus <code>dashboard/src/styles.css</code>, mit dem Wert im gewählten Modus und der gewählten Farbvorlage. Im Code nie feste Farben verwenden, sondern <code>var(--name)</code> oder die Tailwind-Klassen (<code>bg-surface</code>, <code>text-mute</code> …).
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

function Type() {
  const rows = [
    { tag: 'h1', css: 'h1 · Unbounded 28 px', sample: 'Willkommen', style: { fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--text-strong)', fontWeight: 600 } },
    { tag: 'h2', css: 'h2 · Unbounded 18 px', sample: 'Begrüßungsnachricht', style: { fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text-strong)', fontWeight: 600 } },
    { tag: 'h3', css: 'h3 · Unbounded 15 px (Kartentitel)', sample: 'Kanal und Rolle', style: { fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--text-strong)', fontWeight: 600 } },
    { tag: 'p', css: 'Fließtext · Inter 14.5 px', sample: 'Nexo begrüßt neue Mitglieder mit einer Nachricht in deinem Kanal.', style: { fontSize: 14.5 } },
    { tag: 'small', css: 'Hinweis · Inter 12–13 px, --text-muted', sample: 'Höchstens 120 Zeichen.', style: { fontSize: 13, color: 'var(--text-muted)' } },
  ];
  return (
    <div style={page}>
      <div>
        <h1>Schrift</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 6, maxWidth: 760 }}>
          Zwei Schriften: <b>Unbounded</b> (<code>--font-display</code>) für Überschriften, <b>Inter</b> (<code>--font</code>) für alles andere. <code>h1</code> bis <code>h3</code> bekommen die Überschrift-Schrift automatisch.
        </p>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {rows.map((row) => (
          <div key={row.tag} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '6px 16px', alignItems: 'baseline', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <code style={{ color: 'var(--text-muted)', fontSize: 12 }}>{row.css}</code>
            <span style={row.style}>{row.sample}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Shapes() {
  const radii = ['--radius-sm', '--radius', '--radius-lg'];
  const shadows = [{ name: '--shadow', text: 'Dialoge, Speicherleiste, schwebende Teile' }, { name: '--card-shadow', text: 'Karten (im hellen Modus)' }, { name: '--ring', text: 'Fokusring um Eingaben' }];
  return (
    <div style={page}>
      <h1>Formen</h1>
      <Section title="Rundungen" text="Eingaben und Knöpfe --radius-sm, Kacheln --radius, Karten und Dialoge --radius-lg.">
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          {radii.map((name) => (
            <div key={name} style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
              <span style={{ width: 96, height: 96, borderRadius: `var(${name})`, background: 'var(--bg-card)', border: '1px solid var(--border-strong)' }} />
              <code style={{ fontSize: 12 }}>{name}</code>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Schatten und Fokus">
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          {shadows.map(({ name, text }) => (
            <div key={name} style={{ display: 'grid', gap: 10, width: 200 }}>
              <span style={{ height: 96, borderRadius: 'var(--radius)', background: 'var(--bg-card)', boxShadow: `var(${name})` }} />
              <code style={{ fontSize: 12 }}>{name}</code>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{text}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
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
        <h1>Farbvorlagen</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 6, maxWidth: 760 }}>
          Die zwölf Vorlagen, die Mitglieder auf „Dashboard-Design“ wählen (<code>THEME_PRESETS</code> in <code>src/shared/theme.ts</code>). Jede setzt Akzent und Zweitfarbe; daraus errechnet <code>themeVariables</code> alle <code>--accent-*</code>-Werte, im hellen Modus so abgedunkelt, dass Text lesbar bleibt.
        </p>
      </div>
      <div style={grid(220)}>
        {THEME_PRESETS.map((preset) => (
          <div key={preset.id} style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 'var(--radius)', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', height: 54, borderRadius: 10, overflow: 'hidden' }}>
              <span style={{ flex: 2, background: preset.primary }} /><span style={{ flex: 1, background: preset.secondary }} />
            </div>
            <b style={{ color: 'var(--text-strong)' }}>{preset.name}</b>
            <code style={{ fontSize: 12, color: 'var(--text-muted)' }}>{preset.id} · {preset.primary} · {preset.secondary}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

export default { title: 'Grundlagen', tags: ['!autodocs'], parameters: { switches: ['scheme', 'mode'] } } satisfies Meta;

export const Farben: StoryObj = { render: () => <Colours /> };
export const Schrift: StoryObj = { parameters: { switches: ['mode'] }, render: () => <Type /> };
export const Formen: StoryObj = { parameters: { switches: ['mode'] }, render: () => <Shapes /> };
export const IconSet: StoryObj = { name: 'Icons', parameters: { switches: ['mode'] }, render: () => <Icons /> };
export const Farbvorlagen: StoryObj = { parameters: { switches: ['mode'] }, render: () => <Schemes /> };
