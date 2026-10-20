// The page icon and a vine burnt into the walnut header (see Backdrop.tsx), the leaves touched with moss.
// Pyrography look in three passes: a soft scorch around every line, a faint light edge where light catches the cut,
// and the dark groove itself.
import { Children, cloneElement, isValidElement, useId } from 'react';
import type { ReactNode } from 'react';

const MOSS = '#8aa866';
const LINE = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Leaf with its tip at (0,-1) and stem at (0,1), scaled and rotated into place. */
const LEAF = 'M0 1 C -0.62 0.45 -0.6 -0.45 0 -1 C 0.6 -0.45 0.62 0.45 0 1 Z M0 0.85 L0 -0.7';
const VINE = 'M600 10 C 556 14 520 40 474 44 C 424 48 404 30 356 44 C 306 58 300 110 258 128 C 222 143 196 128 172 140';
const LEAVES: [x: number, y: number, size: number, angle: number][] = [
  [562, 20, 15, -60], [514, 36, 12, 40], [474, 50, 14, -130], [424, 40, 11, 30], [380, 30, 13, -40],
  [328, 60, 12, 70], [300, 96, 14, -20], [252, 136, 11, 110], [200, 140, 10, -70],
];
const TENDRILS = ['M514 36 c -10 -14 4 -26 12 -16 c 6 8 -4 14 -8 8', 'M328 60 c 14 -6 22 8 12 14 c -8 5 -12 -4 -6 -7', 'M252 136 c -4 14 -20 12 -18 2 c 2 -8 10 -6 9 0'];

/** Where the 24px icon sits and how big it is drawn (viewBox units). */
const ICON_AT = { x: 446, y: 70, scale: 5.8 } as const;
/** Line width of the icon's cuts in viewBox units (the nav icons are drawn at strokeWidth 2 on their 24px grid). */
const ICON_LINE = 3.4;
const VINE_LINE = 3;

/** Dots (the only icon parts with their own strokeWidth) are cut a bit wider than their line ratio, or they vanish. */
const DOT_BOOST = 1.6;

/**
 * Icons give a few details (dots) their own strokeWidth on the 24px grid; scale those like the rest of the icon, so
 * a dot stays a dot instead of turning into a blob.
 */
function scaleStrokes(node: ReactNode, factor: number): ReactNode {
  return Children.map(node, (child) => {
    if (!isValidElement<{ strokeWidth?: number | string; children?: ReactNode }>(child)) return child;
    const { strokeWidth, children } = child.props;
    return cloneElement(child, {
      ...(strokeWidth !== undefined ? { strokeWidth: Number(strokeWidth) * factor } : {}),
      ...(children ? { children: scaleStrokes(children, factor) } : {}),
    });
  });
}

export function Engraving({ art, width }: { art?: ReactNode; width: string }) {
  const id = useId();
  // Default icon line = 2 on the grid → ICON_LINE on the board; details keep their ratio to that.
  const iconArt = art ? scaleStrokes(art, (ICON_LINE / ICON_AT.scale / 2) * DOT_BOOST) : null;
  const lines = (stroke: string, grow: number) => (
    <g {...LINE} stroke={stroke}>
      <path d={VINE} strokeWidth={VINE_LINE * grow} />
      {TENDRILS.map((d) => <path key={d} d={d} strokeWidth={VINE_LINE * 0.7 * grow} />)}
      {LEAVES.map(([x, y, size, angle]) => (
        <path key={`${x}-${y}`} d={LEAF} transform={`translate(${x} ${y}) rotate(${angle}) scale(${size})`} strokeWidth={(VINE_LINE * 0.8 * grow) / size} />
      ))}
      {iconArt && (
        <g transform={`translate(${ICON_AT.x} ${ICON_AT.y}) scale(${ICON_AT.scale})`} strokeWidth={(ICON_LINE * grow) / ICON_AT.scale}>
          {grow === 1 ? iconArt : scaleStrokes(iconArt, grow)}
        </g>
      )}
    </g>
  );
  return (
    <svg viewBox="0 0 600 320" preserveAspectRatio="xMaxYMin meet" aria-hidden="true"
      className="absolute right-0 top-0 h-full" style={{ width }}>
      <defs>
        <filter id={`${id}-scorch`} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.6" /></filter>
      </defs>
      <g filter={`url(#${id}-scorch)`} opacity={0.55}>{lines('#1a0d05', 2.4)}</g>
      {/* Moss in the leaves: above the scorch, under the cut lines. */}
      {LEAVES.map(([x, y, size, angle]) => (
        <path key={`m${x}-${y}`} d={LEAF} transform={`translate(${x} ${y}) rotate(${angle}) scale(${size})`} fill={MOSS} fillOpacity={0.7} />
      ))}
      <g transform="translate(1.1 1.3)">{lines('rgba(255, 222, 180, 0.22)', 1)}</g>
      {lines('rgba(16, 8, 3, 0.9)', 1)}
    </svg>
  );
}
