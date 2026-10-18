// Hand-rolled SVG charts for the statistics page: line, grouped bars and stacked bars over days.
// One y-axis, categorical colours in fixed order (validated for the #1a1b1f card surface), recessive grid,
// crosshair/per-band tooltip on hover and keyboard focus, and an "Als Tabelle" view for every chart.
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Card, TableWrap } from './ui';

gsap.registerPlugin(useGSAP);

/** Fixed order, never cycled: a fifth series must be folded into "Andere" by the caller. */
export const SERIES_COLORS = ['#0ea5c4', '#8b5cf6', '#d97706', '#ec4899'] as const;

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

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.floor(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
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
      right={<button type="button" className="btn btn-ghost btn-sm" aria-pressed={table} onClick={() => setTable(!table)}>{table ? 'Als Diagramm' : 'Als Tabelle'}</button>}>
      {colored.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-dc-muted">
          {colored.map((s, i) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <svg width="14" height="10" aria-hidden="true">
                {kind === 'line' ? <line x1="0" x2="14" y1="5" y2="5" stroke={SERIES_COLORS[i]} strokeWidth="2" /> : <rect width="10" height="10" rx="2" fill={SERIES_COLORS[i]} />}
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
          <svg ref={svg} width={width} height={HEIGHT} role="img" tabIndex={0} className="block outline-none focus-visible:outline-2 focus-visible:outline-nexo-cyan rounded-md"
            aria-label={`${title}: ${n} Tage. Pfeiltasten zeigen die Werte einzelner Tage.`}
            onKeyDown={onKey} onFocus={() => setActive((current) => current ?? n - 1)} onBlur={() => setActive(null)}>
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="rgba(255,255,255,.06)" />
                <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--text-faint)">{compact.format(tick)}</text>
              </g>
            ))}
            {labels.map((label, i) => i % labelEvery === (n - 1) % labelEvery && (
              <text key={i} x={xCenter(i)} y={HEIGHT - 8} textAnchor="middle" fontSize="11" fill="var(--text-faint)">{label}</text>
            ))}

            {kind === 'line' && active !== null && (
              <line x1={xCenter(active)} x2={xCenter(active)} y1={PAD.top} y2={PAD.top + plotH} stroke="rgba(255,255,255,.28)" />
            )}

            {kind === 'line' && colored.map((s, si) => {
              const d = s.values.map((v, i) => (v === null ? null : `${xCenter(i)},${y(v)}`))
                .reduce<string>((path, point, i, all) => point === null ? path : `${path}${i === 0 || all[i - 1] === null ? 'M' : 'L'}${point}`, '');
              return (
                <g key={s.name}>
                  <path className="js-line" d={d} fill="none" stroke={SERIES_COLORS[si]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  {active !== null && s.values[active] !== null && (
                    <circle cx={xCenter(active)} cy={y(s.values[active] ?? 0)} r="4" fill={SERIES_COLORS[si]} stroke="var(--bg-card)" strokeWidth="2" />
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
                          return <path key={si} d={barPath(left + si * (barW + GAP), yTop, barW, y(0) - yTop)} fill={SERIES_COLORS[si]} />;
                        }
                        const yTop = y(base + v);
                        const yBottom = y(base) - (base > 0 ? GAP : 0);
                        base += v;
                        if (yBottom - yTop <= 0) return null;
                        return si === top
                          ? <path key={si} d={barPath(left, yTop, barW, yBottom - yTop)} fill={SERIES_COLORS[si]} />
                          : <rect key={si} x={left} y={yTop} width={barW} height={yBottom - yTop} fill={SERIES_COLORS[si]} />;
                      })}
                    </g>
                  );
                })}
              </g>
            )}

            <line x1={PAD.left} x2={width - PAD.right} y1={y(lo)} y2={y(lo)} stroke="rgba(255,255,255,.16)" />
            {/* Hit layer: the whole plot height of a day, wider than any mark. */}
            <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} fill="transparent"
              onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setActive(null)} />
          </svg>

          {active !== null && (
            <div role="status" className="pointer-events-none absolute top-0 z-10 min-w-[150px] -translate-x-1/2 rounded-lg border border-white/10 bg-[#0e0f11]/95 px-3 py-2 text-[13px] shadow-lg"
              style={{ left: Math.min(width - 80, Math.max(80, xCenter(active))) }}>
              <div className="mb-1 text-dc-muted">{longLabels[active]}</div>
              {colored.map((s, si) => (
                <div key={s.name} className="flex items-center gap-2">
                  <svg width="12" height="4" aria-hidden="true"><line x1="0" x2="12" y1="2" y2="2" stroke={SERIES_COLORS[si]} strokeWidth="2" strokeLinecap="round" /></svg>
                  <b className="tabular-nums text-[#f2f3f5]">{s.values[active] === null ? '–' : format(s.values[active] ?? 0)}</b>
                  <span className="text-dc-muted">{s.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
