/// <reference types="vite/client" />
// Page header backdrop: the same walnut board on every page (assets/wood/CREDITS.md), with the page's own icon and a
// vine burnt into the wood on the right, the leaves touched with moss. Over the text column the wood is washed toward
// the page colour (--scrim, measured for 4.5:1 text), right of it the wood shows; it fades out downwards.
import type { ReactNode } from 'react';
import walnut from '../assets/wood/walnut.webp';

const MOSS = '#8aa866';

// Engraving = a dark groove plus a faint light edge just below it (where light catches the cut).
const GROOVE = { stroke: 'rgba(20, 11, 5, 0.82)', fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const EDGE = { stroke: 'rgba(255, 224, 186, 0.2)', fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Leaf with its tip at (0,-1) and stem at (0,1), scaled and rotated into place. */
const LEAF = 'M0 1 C -0.62 0.45 -0.6 -0.45 0 -1 C 0.6 -0.45 0.62 0.45 0 1 Z M0 0.85 L0 -0.7';
const VINE = 'M600 10 C 556 14 520 40 474 44 C 424 48 404 30 356 44 C 306 58 300 110 258 128 C 222 143 196 128 172 140';
const LEAVES: [x: number, y: number, size: number, angle: number][] = [
  [562, 20, 15, -60], [514, 36, 12, 40], [474, 50, 14, -130], [424, 40, 11, 30], [380, 30, 13, -40],
  [328, 60, 12, 70], [300, 96, 14, -20], [252, 136, 11, 110], [200, 140, 10, -70],
];
const TENDRILS = ['M514 36 c -10 -14 4 -26 12 -16 c 6 8 -4 14 -8 8', 'M328 60 c 14 -6 22 8 12 14 c -8 5 -12 -4 -6 -7', 'M252 136 c -4 14 -20 12 -18 2 c 2 -8 10 -6 9 0'];

function Engraving({ art, width }: { art?: ReactNode; width: string }) {
  const carve = (style: typeof GROOVE | typeof EDGE, width: number, offset: number) => (
    <g {...style} transform={`translate(${offset} ${offset})`}>
      <path d={VINE} strokeWidth={width} />
      {TENDRILS.map((d) => <path key={d} d={d} strokeWidth={width * 0.7} />)}
      {LEAVES.map(([x, y, size, angle]) => (
        <path key={`${x}-${y}`} d={LEAF} transform={`translate(${x} ${y}) rotate(${angle}) scale(${size})`} strokeWidth={width / size} />
      ))}
      {art && <g transform="translate(446 70) scale(5.8)" strokeWidth={width / 5.8}>{art}</g>}
    </g>
  );
  return (
    <svg viewBox="0 0 600 320" preserveAspectRatio="xMaxYMin meet" aria-hidden="true"
      className="absolute right-0 top-0 h-full opacity-90" style={{ width }}>
      {/* Moss in the leaves, under the cut lines. */}
      {LEAVES.map(([x, y, size, angle]) => (
        <path key={`m${x}-${y}`} d={LEAF} transform={`translate(${x} ${y}) rotate(${angle}) scale(${size})`} fill={MOSS} fillOpacity={0.55} />
      ))}
      {carve(EDGE, 2.4, 1.2)}
      {carve(GROOVE, 2.4, 0)}
    </svg>
  );
}

/** Absolute layer at the top of a scroll area, visible right away. `art` = the page's nav icon (24px grid paths). */
export function PageBackdrop({ art, column = 1040 }: { art?: ReactNode; column?: number }) {
  const textEnd = `calc(max(40px, 50% - ${column / 2}px) + 780px)`;
  const wash = `linear-gradient(90deg, color-mix(in srgb, var(--bg-main) var(--scrim), transparent) ${textEnd}, color-mix(in srgb, var(--bg-main) 18%, transparent) calc(${textEnd} + 320px))`;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[320px] overflow-hidden"
      style={{ maskImage: 'linear-gradient(to bottom, #000 45%, transparent)' }}>
      <img src={walnut} alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0" style={{ background: wash }} />
      {/* Right of the text column; on narrow screens a small version in the corner. */}
      <Engraving art={art} width={`min(600px, max(220px, calc(100% - ${textEnd} + 140px)))`} />
    </div>
  );
}
