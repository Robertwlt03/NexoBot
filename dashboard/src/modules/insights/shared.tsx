// Formatting and small building blocks shared by the Statistiken tabs.
import type { ReactNode } from 'react';
import type { InsightRange } from '../../../../src/web/dto/insights';
import { Empty, Notice, Spinner } from '../../components/ui';

export type RangeId = `${InsightRange}`;
export const RANGES: { id: RangeId; label: string }[] = [
  { id: '7', label: '7 Tage' },
  { id: '30', label: '30 Tage' },
  { id: '90', label: '90 Tage' },
];

export type Section = 'overview' | 'activity' | 'members' | 'moderation';
export const SECTIONS: { id: Section; label: string }[] = [
  { id: 'overview', label: 'Überblick' },
  { id: 'activity', label: 'Aktivität' },
  { id: 'members', label: 'Mitglieder' },
  { id: 'moderation', label: 'Moderation' },
];

export const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';
export const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export const number = new Intl.NumberFormat('de-DE');
export const hours = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
export const percent = (part: number, whole: number) => `${whole ? Math.round((part / whole) * 100) : 0} %`;
export const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${number.format(Math.abs(n))}`;

const utc = (day: string) => new Date(`${day}T00:00:00Z`);
export const utcDate = (day: string) => utc(day).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
export const fullDate = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

/** Short x labels (18.10.) and long tooltip/table labels (Sa., 18.10.2026) for a list of UTC days. */
export function dayLabels(days: { day: string }[]) {
  return {
    labels: days.map((d) => `${d.day.slice(8, 10)}.${d.day.slice(5, 7)}.`),
    longLabels: days.map((d) => utc(d.day).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })),
  };
}

const relativeFormat = new Intl.RelativeTimeFormat('de-DE', { numeric: 'auto' });
/** "vor 3 Stunden", "vor 2 Jahren". */
export function ago(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31_536_000], ['month', 2_592_000], ['day', 86_400], ['hour', 3_600], ['minute', 60]];
  const [unit, size] = units.find(([, s]) => Math.abs(seconds) >= s) ?? ['minute', 60];
  return relativeFormat.format(Math.round(seconds / size), unit);
}

/** Label / value rows (module tiles, member profile). */
export function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="stack m-0 gap-2">
      {items.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-3">
          <dt className="muted">{label}</dt>
          <dd className="m-0 min-w-0 truncate text-right font-semibold tabular-nums text-[#f2f3f5]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Loading / error frame: the first load shows a spinner, refetches keep the previous render at reduced opacity. */
export function Loaded<T>({ state, children }: { state: { data: T | null; error: string | null; loading: boolean; reload?: () => void }; children: (data: T) => ReactNode }) {
  if (!state.data) return state.error ? <Notice tone="danger" onRetry={state.reload}>{state.error}</Notice> : <Spinner />;
  return (
    <div className={`transition-opacity duration-200 ${state.loading ? 'opacity-50' : ''}`} aria-busy={state.loading}>
      {state.error && <div className="mb-4"><Notice tone="danger">{state.error}</Notice></div>}
      {children(state.data)}
    </div>
  );
}

export function TrackingOff() {
  return (
    <Empty title="Aufzeichnung pro Mitglied ist aus">
      Schalte unten „Aufzeichnung pro Mitglied“ ein, um Zahlen je Mitglied zu sehen. Nexo speichert dabei nur Zahlen, keine Inhalte.
    </Empty>
  );
}

/** Grid for chart cards (cards stack without their own margin inside). */
export const GRID = 'grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:mt-0';
/** Vertical section: 16px between blocks, no extra card/stat margins. */
export const STACK = 'stack [&>*]:m-0';
