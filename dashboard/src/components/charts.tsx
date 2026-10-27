// Hand-rolled SVG charts for the statistics page: line, grouped bars and stacked bars over days, plus sparkline,
// weekday × hour heatmap and horizontal bars. One y-axis, categorical colours in fixed order (validated for the #15151b card surface), recessive grid,
// crosshair/per-band tooltip on hover and keyboard focus, and an "Als Tabelle" view for every chart.
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Card, Empty, TableWrap } from './ui';
import { useChartTheme } from '../theme';

gsap.registerPlugin(useGSAP);

/** Fixed order, never cycled: a fifth series must be folded into "Andere" by the caller. */
// Lavender (the accent family) first; validated: validate_palette.js --mode dark --surface #15151b, all checks pass.
export const SERIES_COLORS = ['#8676f5', '#2f9fbe', '#bb8a2c', '#cf5f7c'] as const;

/**
 * Sequential one-hue ramp (lavender, dark → light = less → more) for the dark card surface; validated with
 * validate_palette.js --ordinal --mode dark --surface #15151b (monotone L, steps ≥ 0.06, darkest step 2.11:1).
 */
export const HEAT_COLORS = ['#4a3f96', '#5d50bd', '#7565df', '#937ff5', '#b9adff'] as const;
const EMPTY_CELL = 'rgb(var(--ov) / .06)';

export interface ChartSeries { name: string; values: (number | null)[] }

const HEIGHT = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 44 };
const GAP = 2;
const RADIUS = 4;

const number = new Intl.NumberFormat('de-DE');
const compact = new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 });

/** 1, 2 or 5 times a power of ten, at least `raw`. */
function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? 10 * power;
  return Math.max(1, step);
}

/** Bar with 4px rounded data end, anchored square to the baseline. */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function useWidth(min = 240) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(min, Math.floor(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, [min]);
  return { ref, width };
}

/** "Als Tabelle" / "Als Diagramm" switch shown in every chart card. */
function TableToggle({ table, onToggle }: { table: boolean; onToggle: () => void }) {
  return <button type="button" className="btn btn-ghost btn-sm" aria-pressed={table} onClick={onToggle}>{table ? 'Als Diagramm' : 'Als Tabelle'}</button>;
}

/** Shared tooltip box (values lead, labels follow). */
function Tooltip({ left, top = 0, children }: { left: number; top?: number; children: ReactNode }) {
  return (
    <div role="status" className="pointer-events-none absolute z-10 min-w-[150px] -translate-x-1/2 rounded-lg border border-line-strong bg-field/95 px-3 py-2 text-[13px] shadow-lg"
      style={{ left, top }}>
      {children}
    </div>
  );
}

export function Chart({ title, description, kind, labels, longLabels, series, format = (n) => number.format(n) }: {
  title: string;
  description?: string;
  /** line: one point per day · bars: grouped when there are several series · stacked: segments per day. */
  kind: 'line' | 'bars' | 'stacked';
  /** Short x labels (e.g. 18.10.). */
  labels: string[];
  /** Full labels for tooltip and table (e.g. Sa., 18.10.2026). */
  longLabels: string[];
  series: ChartSeries[];
  format?: (n: number) => string;
}) {
  const [table, setTable] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const { ref, width } = useWidth();
  const svg = useRef<SVGSVGElement>(null);
  const colored = series.slice(0, SERIES_COLORS.length);
  // Colours follow the member's theme: one series in the primary colour, several in the themed categorical palette.
  const themed = useChartTheme();
  const palette: readonly string[] = colored.length === 1 ? [themed.primary] : themed.palette;

  const n = labels.length;
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = plotW / Math.max(1, n);
  const xCenter = (i: number) => PAD.left + band * (i + 0.5);

  // y-domain: bars start at zero; a line may float so small changes stay visible.
  const values = colored.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const stackedMax = Math.max(0, ...labels.map((_, i) => colored.reduce((sum, s) => sum + (s.values[i] ?? 0), 0)));
  let lo = 0;
  let hi = kind === 'stacked' ? stackedMax : Math.max(0, ...values);
  if (kind === 'line' && values.length) lo = Math.min(...values);
  if (hi === lo) hi = lo + 4;
  const step = niceStep((hi - lo) / 4);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const y = (v: number) => PAD.top + plotH - ((v - lo) / (hi - lo)) * plotH;
  const ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step);
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 70))));

  useGSAP(() => {
    if (table || !svg.current) return;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      svg.current!.querySelectorAll<SVGPathElement>('.js-line').forEach((path) => {
        const length = path.getTotalLength();
        gsap.fromTo(path, { strokeDasharray: length, strokeDashoffset: length }, { strokeDashoffset: 0, duration: 0.8, ease: 'power2.out', clearProps: 'strokeDasharray,strokeDashoffset' });
      });
      gsap.from(svg.current!.querySelectorAll('.js-bars'), { scaleY: 0, transformOrigin: '50% 100%', duration: 0.6, ease: 'power3.out', clearProps: 'transform' });
    });
    return () => mm.revert();
  }, { dependencies: [table, labels.join(), series.map((s) => s.values.join()).join('|')], revertOnUpdate: true });

  const pick = (event: PointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const index = Math.floor(((event.clientX - rect.left) / rect.width) * n);
    setActive(Math.min(n - 1, Math.max(0, index)));
  };
  const onKey = (event: KeyboardEvent<SVGSVGElement>) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, Home: -n, End: n };
    if (!(event.key in moves)) return;
    event.preventDefault();
    setActive((current) => Math.min(n - 1, Math.max(0, (current ?? n - 1) + moves[event.key])));
  };

  const groupW = Math.max(1, band - GAP);
  const barW = kind === 'bars' ? Math.max(1, (groupW - GAP * (colored.length - 1)) / colored.length) : groupW;

  return (
    <Card title={title} description={description}
      right={<TableToggle table={table} onToggle={() => setTable(!table)} />}>
      {colored.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-mute">
          {colored.map((s, i) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <svg width="14" height="10" aria-hidden="true">
                {kind === 'line' ? <line x1="0" x2="14" y1="5" y2="5" stroke={palette[i]} strokeWidth="2" /> : <rect width="10" height="10" rx="2" fill={palette[i]} />}
              </svg>
              {s.name}
            </li>
          ))}
        </ul>
      )}

      {table ? (
        <div className="max-h-80 overflow-y-auto">
          <TableWrap>
            <thead><tr><th>Datum</th>{colored.map((s) => <th key={s.name} className="text-right">{s.name}</th>)}</tr></thead>
            <tbody>
              {longLabels.map((label, i) => (
                <tr key={label}><td>{label}</td>{colored.map((s) => <td key={s.name} className="text-right tabular-nums">{s.values[i] === null ? '–' : format(s.values[i] ?? 0)}</td>)}</tr>
              ))}
            </tbody>
          </TableWrap>
        </div>
      ) : (
        <div ref={ref} className="relative">
          <svg ref={svg} width={width} height={HEIGHT} role="img" tabIndex={0} className="block outline-none focus-visible:outline-2 focus-visible:outline-accent rounded-md"
            aria-label={`${title}: ${n} Tage. Pfeiltasten zeigen die Werte einzelner Tage.`}
            onKeyDown={onKey} onFocus={() => setActive((current) => current ?? n - 1)} onBlur={() => setActive(null)}>
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} style={{ stroke: 'rgb(var(--ov) / .07)' }} />
                <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--text-faint)">{compact.format(tick)}</text>
              </g>
            ))}
            {labels.map((label, i) => i % labelEvery === (n - 1) % labelEvery && (
              <text key={i} x={xCenter(i)} y={HEIGHT - 8} textAnchor="middle" fontSize="11" fill="var(--text-faint)">{label}</text>
            ))}

            {kind === 'line' && active !== null && (
              <line x1={xCenter(active)} x2={xCenter(active)} y1={PAD.top} y2={PAD.top + plotH} style={{ stroke: 'rgb(var(--ov) / .3)' }} />
            )}

            {kind === 'line' && colored.map((s, si) => {
              const d = s.values.map((v, i) => (v === null ? null : `${xCenter(i)},${y(v)}`))
                .reduce<string>((path, point, i, all) => point === null ? path : `${path}${i === 0 || all[i - 1] === null ? 'M' : 'L'}${point}`, '');
              return (
                <g key={s.name}>
                  <path className="js-line" d={d} fill="none" stroke={palette[si]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  {active !== null && s.values[active] !== null && (
                    <circle cx={xCenter(active)} cy={y(s.values[active] ?? 0)} r="4" fill={palette[si]} stroke="var(--bg-card)" strokeWidth="2" />
                  )}
                </g>
              );
            })}

            {kind !== 'line' && (
              <g className="js-bars">
                {labels.map((_, i) => {
                  const left = PAD.left + band * i + GAP / 2;
                  let base = 0;
                  const top = colored.reduce((last, s, si) => ((s.values[i] ?? 0) > 0 ? si : last), -1);
                  return (
                    <g key={i} className={active !== null && active !== i ? 'opacity-55' : undefined}>
                      {colored.map((s, si) => {
                        const v = s.values[i] ?? 0;
                        if (v <= 0) return null;
                        if (kind === 'bars') {
                          const yTop = y(v);
                          return <path key={si} d={barPath(left + si * (barW + GAP), yTop, barW, y(0) - yTop)} fill={palette[si]} />;
                        }
                        const yTop = y(base + v);
                        const yBottom = y(base) - (base > 0 ? GAP : 0);
                        base += v;
                        if (yBottom - yTop <= 0) return null;
                        return si === top
                          ? <path key={si} d={barPath(left, yTop, barW, yBottom - yTop)} fill={palette[si]} />
                          : <rect key={si} x={left} y={yTop} width={barW} height={yBottom - yTop} fill={palette[si]} />;
                      })}
                    </g>
                  );
                })}
              </g>
            )}

            <line x1={PAD.left} x2={width - PAD.right} y1={y(lo)} y2={y(lo)} style={{ stroke: 'rgb(var(--ov) / .18)' }} />
            {/* Hit layer: the whole plot height of a day, wider than any mark. */}
            <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} fill="transparent"
              onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setActive(null)} />
          </svg>

          {active !== null && (
            <Tooltip left={Math.min(width - 80, Math.max(80, xCenter(active)))}>
              <div className="mb-1 text-mute">{longLabels[active]}</div>
              {colored.map((s, si) => (
                <div key={s.name} className="flex items-center gap-2">
                  <svg width="12" height="4" aria-hidden="true"><line x1="0" x2="12" y1="2" y2="2" stroke={palette[si]} strokeWidth="2" strokeLinecap="round" /></svg>
                  <b className="tabular-nums text-ink">{s.values[active] === null ? '–' : format(s.values[active] ?? 0)}</b>
                  <span className="text-mute">{s.name}</span>
                </div>
              ))}
            </Tooltip>
          )}
        </div>
      )}
    </Card>
  );
}

// ---------- Sparkline ----------

/** Trend line for a stat tile: de-emphasised line, the latest value as an accent dot. Decorative (the charts carry the values). */
export function Sparkline({ values, height = 30 }: { values: (number | null)[]; height?: number }) {
  const themed = useChartTheme();
  const { ref, width } = useWidth(40);
  const H = height;
  const gradientId = useId();
  const points = values.map((v, i) => (v === null ? null : [i, v] as const)).filter((p) => p !== null);
  if (points.length < 2) return <div ref={ref} className="my-1.5" style={{ height: H }} aria-hidden="true" />;
  const nums = points.map(([, v]) => v);
  const lo = Math.min(...nums);
  const hi = Math.max(...nums) === lo ? lo + 1 : Math.max(...nums);
  const x = (i: number) => 5 + (i / Math.max(1, values.length - 1)) * (width - 10);
  const y = (v: number) => 5 + (1 - (v - lo) / (hi - lo)) * (H - 10);
  const d = points.map(([i, v], k) => `${k === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join('');
  const [lastI, lastV] = points[points.length - 1];
  return (
    // The svg is taken out of the flow so it never widens its tile (the width is measured from the tile).
    <div ref={ref} className="relative my-1.5 overflow-hidden" style={{ height: H }} aria-hidden="true">
      <svg width={width} height={H} className="absolute inset-0">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={themed.primary} stopOpacity=".22" />
            <stop offset="1" stopColor={themed.primary} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${d}L${x(lastI)},${H}L${x(points[0][0])},${H}Z`} fill={`url(#${gradientId})`} />
        <path d={d} fill="none" stroke={themed.primary} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${themed.primary}66)` }} />
        <circle cx={x(lastI)} cy={y(lastV)} r="4" fill={themed.primary} stroke="var(--bg-card)" strokeWidth="2" />
      </svg>
    </div>
  );
}

// ---------- Heatmap ----------

const HEAT_LABEL_W = 30;
const HEAT_AXIS_H = 20;
const HEAT_GAP = 2;

/** Step of HEAT_COLORS for `value` (null = zero, drawn as an empty cell). */
function heatStep(value: number, max: number): number | null {
  if (value <= 0 || max <= 0) return null;
  return Math.min(HEAT_COLORS.length - 1, Math.ceil((value / max) * HEAT_COLORS.length) - 1);
}

/**
 * Grid of rows × columns (e.g. weekday × hour) on the sequential ramp. Each cell has a tooltip on hover and
 * keyboard focus (arrow keys); scrolls horizontally inside its card on narrow screens.
 */
export function Heatmap({ title, description, rows, cols, values, cellLabel, unit, format = (n) => number.format(n) }: {
  title: string;
  description?: string;
  /** Row labels (Mo … So). */
  rows: string[];
  /** Column labels (0 … 23); every third is drawn on the axis. */
  cols: string[];
  /** values[row][col]. */
  values: number[][];
  /** Tooltip / table label of a cell, e.g. "Di 20–21 Uhr". */
  cellLabel: (row: number, col: number) => string;
  /** Unit after the value, e.g. "Nachrichten". */
  unit: string;
  format?: (n: number) => string;
}) {
  const themed = useChartTheme();
  const [table, setTable] = useState(false);
  const [active, setActive] = useState<[number, number] | null>(null);
  const { ref, width } = useWidth(200);
  const svg = useRef<SVGSVGElement>(null);
  const max = Math.max(0, ...values.flat());
  const cellW = Math.max(16, Math.floor((width - HEAT_LABEL_W) / cols.length));
  const cellH = Math.min(26, Math.max(18, Math.round(cellW * 0.75)));
  const svgW = HEAT_LABEL_W + cellW * cols.length;
  const svgH = rows.length * cellH + HEAT_AXIS_H;
  const at = (r: number, c: number) => values[r]?.[c] ?? 0;

  useGSAP(() => {
    if (table || !svg.current) return;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from(svg.current!.querySelectorAll('.js-cell'), { opacity: 0, duration: 0.35, ease: 'power2.out', stagger: { amount: 0.4, grid: [rows.length, cols.length], from: 'start' } });
    });
    return () => mm.revert();
  }, { dependencies: [table, values.flat().join()], revertOnUpdate: true });

  const onKey = (event: KeyboardEvent<SVGSVGElement>) => {
    const moves: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setActive((current) => {
      const [r, c] = current ?? [0, 0];
      return [Math.min(rows.length - 1, Math.max(0, r + move[0])), Math.min(cols.length - 1, Math.max(0, c + move[1]))];
    });
  };

  return (
    <Card title={title} description={description} right={<TableToggle table={table} onToggle={() => setTable(!table)} />}>
      {table ? (
        <TableWrap>
          <thead><tr><th />{cols.map((c) => <th key={c} className="text-right">{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={row}><td>{row}</td>{cols.map((c, ci) => <td key={c} className="text-right tabular-nums">{format(at(r, ci))}</td>)}</tr>
            ))}
          </tbody>
        </TableWrap>
      ) : (
        <>
          <div ref={ref} className="relative overflow-x-auto pb-1">
            <svg ref={svg} width={svgW} height={svgH} role="img" tabIndex={0} className="block rounded-md outline-none focus-visible:outline-2 focus-visible:outline-accent"
              aria-label={`${title}. Pfeiltasten zeigen die Werte einzelner Felder.`}
              onKeyDown={onKey} onFocus={() => setActive((current) => current ?? [0, 0])} onBlur={() => setActive(null)}
              onPointerLeave={() => setActive(null)}>
              {rows.map((row, r) => (
                <text key={row} x={HEAT_LABEL_W - 8} y={r * cellH + cellH / 2} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--text-faint)">{row}</text>
              ))}
              {cols.map((c, ci) => ci % 3 === 0 && (
                <text key={c} x={HEAT_LABEL_W + ci * cellW + cellW / 2} y={svgH - 6} textAnchor="middle" fontSize="11" fill="var(--text-faint)">{c}</text>
              ))}
              {rows.map((row, r) => cols.map((c, ci) => {
                const step = heatStep(at(r, ci), max);
                const isActive = active?.[0] === r && active[1] === ci;
                return (
                  <rect key={`${row}-${c}`} className="js-cell" x={HEAT_LABEL_W + ci * cellW + HEAT_GAP / 2} y={r * cellH + HEAT_GAP / 2}
                    width={cellW - HEAT_GAP} height={cellH - HEAT_GAP} rx="3"
                    fill={step === null ? EMPTY_CELL : themed.heat[step]}
                    stroke={isActive ? 'var(--text-strong)' : 'none'} strokeWidth="1.5"
                    onPointerEnter={() => setActive([r, ci])} onPointerDown={() => setActive([r, ci])} />
                );
              }))}
            </svg>
            {active !== null && (
              <Tooltip left={Math.min(svgW - 80, Math.max(80, HEAT_LABEL_W + active[1] * cellW + cellW / 2))} top={(active[0] + 1) * cellH + 4}>
                <b className="tabular-nums text-ink">{format(at(active[0], active[1]))}</b> <span className="text-mute">{unit}</span>
                <div className="text-mute">{cellLabel(active[0], active[1])}</div>
              </Tooltip>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[13px] text-mute" aria-hidden="true">
            <span className="mr-1">0</span>
            {[EMPTY_CELL, ...themed.heat].map((color) => <span key={color} className="h-3 w-5 rounded-[3px]" style={{ background: color }} />)}
            <span className="ml-1 tabular-nums">{format(max)} {unit}</span>
          </div>
        </>
      )}
    </Card>
  );
}

// ---------- Horizontal bars ----------

export interface BarItem {
  key: string;
  label: string;
  value: number;
  /** Secondary text after the value (e.g. "78 %"). */
  detail?: string;
  /** Makes the label a button (e.g. select this member). */
  onSelect?: () => void;
}

/**
 * Ranked horizontal bars with the value at the tip. One series, so one hue — unless `ordinal` (funnel stages,
 * age buckets): then the bars step along the sequential ramp so the order reads in the colour.
 */
export function HorizontalBars({ title, description, items, unit, ordinal, format = (n) => number.format(n), emptyTitle = 'Noch keine Daten', emptyText }: {
  title: string;
  description?: string;
  items: BarItem[];
  /** Table column header, e.g. "Nachrichten". */
  unit: string;
  ordinal?: boolean;
  format?: (n: number) => string;
  emptyTitle?: string;
  emptyText?: ReactNode;
}) {
  const themed = useChartTheme();
  const [table, setTable] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  const max = Math.max(1, ...items.map((item) => item.value));
  const color = (i: number) => ordinal && items.length > 1
    ? themed.heat[themed.heat.length - 1 - Math.round((i / (items.length - 1)) * (themed.heat.length - 1))]
    : themed.primary;

  useGSAP(() => {
    if (table || !list.current) return;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from(list.current!.querySelectorAll('.js-hbar'), { scaleX: 0, transformOrigin: '0% 50%', duration: 0.6, ease: 'power3.out', stagger: 0.03, clearProps: 'transform' });
    });
    return () => mm.revert();
  }, { dependencies: [table, items.map((item) => `${item.key}:${item.value}`).join()], revertOnUpdate: true });

  return (
    <Card title={title} description={description} right={items.length > 0 && <TableToggle table={table} onToggle={() => setTable(!table)} />}>
      {items.length === 0 ? (
        <Empty title={emptyTitle}>{emptyText}</Empty>
      ) : table ? (
        <TableWrap>
          <thead><tr><th>Name</th><th className="text-right">{unit}</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.key}><td>{item.label}</td><td className="text-right tabular-nums">{format(item.value)}{item.detail && ` · ${item.detail}`}</td></tr>
            ))}
          </tbody>
        </TableWrap>
      ) : (
        <ol ref={list} className="m-0 flex list-none flex-col gap-3 p-0">
          {items.map((item, i) => (
            <li key={item.key}>
              <div className="flex items-baseline justify-between gap-3 text-[14px]">
                {item.onSelect ? (
                  <button type="button" className="min-w-0 cursor-pointer break-words border-0 bg-transparent p-0 text-left text-body [font:inherit] hover:underline"
                    onClick={item.onSelect}>{item.label}</button>
                ) : <span className="min-w-0 break-words text-body">{item.label}</span>}
                <span className="shrink-0">
                  <b className="tabular-nums text-ink">{format(item.value)}</b>
                  {item.detail && <span className="text-mute"> · {item.detail}</span>}
                </span>
              </div>
              <div className="mt-1.5 h-2.5">
                <div className="js-hbar h-full rounded-r-[4px]" style={{ width: `${Math.max(1, (item.value / max) * 100)}%`, background: color(i) }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
