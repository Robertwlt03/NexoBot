// "Dashboard-Design": the member's own primary and secondary colour (preset or custom), previewed live across the
// whole dashboard while editing and saved on the Discord account (applies on every device).
import { useEffect, useState } from 'react';
import { DEFAULT_THEME, THEME_PRESETS, themeWarnings, type DashboardTheme } from '../../../src/shared/theme';
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
        description="Wähle deine eigenen Farben. Sie gelten nur für dich – auf allen Geräten, auf denen du dich mit Discord anmeldest." />

      <Card title="Vorlagen" description="Abgestimmte Farbpaare, die auf dem dunklen Design immer gut aussehen.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {THEME_PRESETS.map((preset) => (
            <PresetTile key={preset.id} preset={preset} selected={value.preset === preset.id}
              onSelect={() => pick({ preset: preset.id, primary: preset.primary, secondary: preset.secondary })} />
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
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => pick({ preset: 'custom', primary: value.secondary, secondary: value.primary })}>
                <Glyph name="shuffle" size={14} /> Tauschen
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => pick({ ...DEFAULT_THEME })} disabled={value.preset === DEFAULT_THEME.preset}>
                Auf Nexo-Standard zurücksetzen
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
