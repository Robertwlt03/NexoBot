// "Dashboard-Design": the member's theme - a complete look with its own surfaces, header art and colours - previewed
// live across the whole dashboard while choosing and saved on the Discord account (applies on every device).
import { useEffect, useState } from 'react';
import { THEME_PRESETS, type DashboardTheme, type ThemePreset } from '../../../src/shared/theme';
import walnut from '../assets/wood/walnut.webp';
import oak from '../assets/wood/oak.webp';
import { Badge, Card, Meter, PageHeader, SaveBar, Switch, Tabs } from '../components/ui';
import { Sparkline } from '../components/charts';
import { useTheme } from '../theme';
import { Glyph } from './visuals';
import { useDraft } from './api';

const SAMPLE = [12, 18, 15, 24, 21, 30, 27, 36, 33, 41];

/** The header material of each theme for the small preview. */
const HEADER: Record<string, string> = {
  walnuss: `url(${walnut}) center / cover`,
  eiche: `url(${oak}) center / cover`,
  cyberpunk: 'linear-gradient(rgb(252 238 10 / .5), rgb(252 238 10 / .5)) left 0 top 0 / 100% 1px no-repeat, radial-gradient(60% 120% at 100% 0%, rgb(0 240 255 / .22), transparent 60%), #0b0c0f',
};

/** A theme as a small page: its header material, a card on its canvas and its accent. */
function ThemeTile({ preset, selected, onSelect }: { preset: ThemePreset; selected: boolean; onSelect: () => void }) {
  const ink = preset.mode === 'light' ? '#1f1209' : '#eef0f5';
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected}
      className={`group flex cursor-pointer flex-col gap-3 rounded-box border bg-surface p-3 text-left transition hover:border-field-line ${selected ? 'border-accent ring-1 ring-accent' : 'border-control'}`}>
      <span className={`theme-sample relative block aspect-[16/9] w-full overflow-hidden rounded-control ${preset.look === 'cyber' ? 'theme-sample-cyber' : ''}`} style={{ background: preset.canvas }}>
        <span className="absolute inset-x-0 top-0 h-[46%]" style={{ background: HEADER[preset.id] }} />
        <span className="absolute inset-x-0 top-[30%] h-[16%]" style={{ background: `linear-gradient(to bottom, transparent, ${preset.canvas})` }} />
        <span className="absolute left-[8%] top-[12%] h-[7%] w-[34%] rounded-full" style={{ background: ink }} />
        <span className="absolute inset-x-[8%] bottom-[10%] top-[52%] rounded-panel" style={{ background: preset.surface, boxShadow: `0 0 0 1px ${preset.mode === 'light' ? 'rgba(98,56,22,.25)' : 'rgba(255,255,255,.08)'}` }}>
          <span className="absolute left-[7%] top-[22%] h-[14%] w-[40%] rounded-full" style={{ background: ink, opacity: 0.7 }} />
          <span className="absolute bottom-[20%] left-[7%] h-[24%] w-[30%] rounded-tag" style={{ background: preset.primary }} />
          <span className="absolute bottom-[20%] left-[42%] h-[24%] w-[18%] rounded-tag" style={{ background: preset.secondary, opacity: 0.85 }} />
        </span>
      </span>
      <span className="flex items-start gap-2">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-title font-semibold text-ink">
            {preset.name}
            <span className="rounded-pill border border-control px-2 py-px text-micro font-medium text-mute">{preset.mode === 'light' ? 'Hell' : 'Dunkel'}</span>
          </span>
          <span className="mt-1 block text-small leading-snug text-mute">{preset.description}</span>
        </span>
        {selected && <span className="text-accent-text"><Glyph name="check" size={18} /></span>}
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

  const pick = (preset: ThemePreset) => form.setDraft({ preset: preset.id, primary: preset.primary, secondary: preset.secondary, mode: preset.mode });

  return (
    <>
      <PageHeader kicker="Mein Profil" title="Dashboard-Design"
        description="Wähle ein Theme: jedes bringt seine eigene Welt mit, vom Holz im Kopfbereich bis zu den Farben. Gilt nur für dich, auf allen Geräten, auf denen du dich mit Discord anmeldest." />

      <Card title="Themes" description="Ein Klick zeigt das Theme sofort im ganzen Dashboard. Gespeichert wird es erst mit „Änderungen speichern“.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {THEME_PRESETS.map((preset) => (
            <ThemeTile key={preset.id} preset={preset} selected={value.preset === preset.id} onSelect={() => pick(preset)} />
          ))}
        </div>
      </Card>

      <div className="mt-4">
        <div className="card card-hero">
          <p className="page-kicker"><span>Vorschau</span></p>
          <div className="mt-2 flex items-end gap-3">
            <span className="text-hero font-light leading-none text-ink tabular-nums">2.480</span>
            <span className="pb-1 text-small text-accent-mute">so sehen Hervorhebungen aus</span>
          </div>
          <div className="mt-4"><Sparkline values={SAMPLE} height={44} /></div>
          <Meter className="mt-2" value={2} max={3} label="Beispiel-Fortschritt" />
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary">Hauptaktion</button>
            <button type="button" className="btn btn-secondary">Nebenaktion</button>
            <Switch checked={on} onChange={setOn} label="Beispiel-Schalter" />
            <Badge tone="accent">Neu</Badge>
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
