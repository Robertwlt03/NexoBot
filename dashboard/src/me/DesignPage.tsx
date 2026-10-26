// "Dashboard-Design": the member's own primary and secondary colour (preset or custom), previewed live across the
// whole dashboard while editing and saved on the Discord account (applies on every device).
import { useEffect, useState } from 'react';
import { DEFAULT_THEME, THEME_PRESETS, themeWarnings, type DashboardTheme, type ThemeMode } from '../../../src/shared/theme';
import { Badge, Card, ColorInput, Field, Notice, PageHeader, SaveBar, Switch, Tabs } from '../components/ui';
import { Sparkline } from '../components/charts';
import { useTheme } from '../theme';
import { Glyph } from './visuals';
import { useDraft } from './api';

const SAMPLE = [12, 18, 15, 24, 21, 30, 27, 36, 33, 41];

function PresetTile({ preset, selected, onSelect }: { preset: (typeof THEME_PRESETS)[number]; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected}
      className={`group relative flex cursor-pointer flex-col gap-3 rounded-2xl border bg-surface p-3 text-left transition hover:border-white/20 ${selected ? 'border-accent ring-1 ring-accent' : 'border-white/[.06]'}`}>
      <span className="h-14 w-full rounded-xl" style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})` }} />
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: preset.primary }} />
        <span className="h-3 w-3 rounded-full" style={{ background: preset.secondary }} />
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">{preset.name}</span>
        {selected && <span className="text-accent"><Glyph name="check" size={16} /></span>}
      </span>
    </button>
  );
}

const MODES: { id: ThemeMode; label: string; hint: string; canvas: string; card: string; line: string; ink: string; wood: string }[] = [
  { id: 'dark', label: 'Dunkel', hint: 'Tiefes Walnussholz, ruhig am Abend', canvas: '#16110c', card: '#231a13', line: '#3d3127', ink: '#f3ebe0', wood: 'linear-gradient(135deg, #6b3f22, #3a2112)' },
  { id: 'light', label: 'Hell', hint: 'Helle Douglasie, warm und angenehm am Tag', canvas: '#e9d6ba', card: '#f2e4cf', line: '#d6bb94', ink: '#22150b', wood: 'linear-gradient(135deg, #dcb07a, #b98552)' },
];

function ModeTile({ mode, selected, onSelect }: { mode: (typeof MODES)[number]; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected}
      className={`flex cursor-pointer items-center gap-4 rounded-2xl border bg-surface p-3 text-left transition hover:border-white/20 ${selected ? 'border-accent ring-1 ring-accent' : 'border-white/[.06]'}`}>
      {/* Mini page in the mode's own colours. */}
      <span className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl" style={{ background: mode.canvas, border: `1px solid ${mode.line}` }}>
        <span className="absolute inset-x-0 top-0 h-6" style={{ background: `linear-gradient(90deg, ${mode.canvas}, transparent), ${mode.wood}` }} />
        <span className="absolute bottom-2 left-2 right-2 h-6 rounded-md" style={{ background: mode.card, border: `1px solid ${mode.line}` }} />
        <span className="absolute left-2 top-2 h-1.5 w-8 rounded-full" style={{ background: mode.ink }} />
        <span className="absolute bottom-4 left-4 h-1.5 w-6 rounded-full bg-accent" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-medium text-ink">{mode.label}</span>
        <span className="block text-[12.5px] text-mute">{mode.hint}</span>
      </span>
      {selected && <span className="text-accent"><Glyph name="check" size={18} /></span>}
    </button>
  );
}

export default function DesignPage() {
  const { saved, preview, save } = useTheme();
  const form = useDraft<DashboardTheme>(saved, save);
  const value = form.draft ?? saved;
  const [tab, setTab] = useState<'a' | 'b'>('a');
  const [on, setOn] = useState(true);

  // Show the draft across the whole dashboard while editing; back to the saved colours when leaving the page.
  useEffect(() => { preview(form.dirty ? value : null); }, [form.dirty, value, preview]);
  useEffect(() => () => preview(null), [preview]);

  const pick = (next: DashboardTheme) => form.setDraft(next);
  const warnings = themeWarnings(value);

  return (
    <>
      <PageHeader kicker="Mein Profil" title="Dashboard-Design"
        description="Hell oder dunkel und deine eigenen Farben. Gilt nur für dich – auf allen Geräten, auf denen du dich mit Discord anmeldest." />

      <Card title="Erscheinungsbild" description="Dunkles Walnussholz für den Abend oder helle Douglasie für den Tag – beides mit Moosgrün.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MODES.map((mode) => (
            <ModeTile key={mode.id} mode={mode} selected={value.mode === mode.id} onSelect={() => pick({ ...value, mode: mode.id })} />
          ))}
        </div>
      </Card>

      <Card title="Vorlagen" description="Abgestimmte Farbpaare, die in beiden Erscheinungsbildern gut aussehen.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {THEME_PRESETS.map((preset) => (
            <PresetTile key={preset.id} preset={preset} selected={value.preset === preset.id}
              onSelect={() => pick({ ...value, preset: preset.id, primary: preset.primary, secondary: preset.secondary })} />
          ))}
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Eigene Farben" description="Primär für Buttons, Auswahl und Hervorhebungen; Sekundär für Verläufe und Glanz.">
          <div className="stack">
            <div className="grid-2">
              <Field label="Primärfarbe"><ColorInput value={value.primary} onChange={(primary) => pick({ ...value, preset: 'custom', primary })} /></Field>
              <Field label="Sekundärfarbe"><ColorInput value={value.secondary} onChange={(secondary) => pick({ ...value, preset: 'custom', secondary })} /></Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => pick({ ...value, preset: 'custom', primary: value.secondary, secondary: value.primary })}>
                <Glyph name="shuffle" size={14} /> Tauschen
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => pick({ ...DEFAULT_THEME, mode: value.mode })} disabled={value.preset === DEFAULT_THEME.preset}>
                Auf Standard zurücksetzen
              </button>
            </div>
            {warnings.length > 0 && <Notice tone="warn">{warnings.join(' ')}</Notice>}
            <p className="faint">Diagramme mit mehreren Linien behalten eine feste, gut unterscheidbare Farbpalette; Diagramme mit einer Linie und Heatmaps folgen deiner Primärfarbe.</p>
          </div>
        </Card>

        <div className="card card-hero">
          <p className="page-kicker">Vorschau</p>
          <div className="mt-2 flex items-end gap-3">
            <span className="text-[44px] font-extralight leading-none tracking-[-0.04em] text-ink tabular-nums">2.480</span>
            <span className="pb-1 text-[13px] text-[var(--accent-text-muted)]">so sehen Hervorhebungen aus</span>
          </div>
          <div className="mt-4"><Sparkline values={SAMPLE} height={44} /></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-accent to-accent-2" />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary">Hauptaktion</button>
            <button type="button" className="btn btn-secondary">Nebenaktion</button>
            <Switch checked={on} onChange={setOn} label="Beispiel-Schalter" />
            <Badge>Neu</Badge>
          </div>
          <div className="mt-4">
            <Tabs value={tab} onChange={setTab} items={[{ id: 'a', label: 'Ausgewählt', count: 3 }, { id: 'b', label: 'Weitere' }]} />
          </div>
        </div>
      </div>

      <SaveBar dirty={form.dirty} saving={form.saving} onSave={form.save} onReset={form.reset} />
    </>
  );
}
