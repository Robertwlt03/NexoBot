// The page icon and a vine burnt into the header wood (see Backdrop.tsx), the leaves touched with moss.
// Pyrography look in three passes: a soft scorch around every line, a faint light edge where light catches the cut,
// and the dark groove itself. The colours come from styles.css (--burn-*): near black on the walnut, a brown burn on
// the golden oak that the grain shows through (multiplied into the wood, like a real burn). The moss sits on its own
// layer between them and is never multiplied, so the leaves stay green on the light oak as well.
import { Children, cloneElement, isValidElement, useId } from 'react';
import type { CSSProperties, ReactNode } from 'react';

const LINE = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

type P = readonly [number, number];
type Segment = readonly [P, P, P, P];
/** The vine: cubic Bézier segments from the top-right corner down to the left. */
const SEGMENTS: readonly Segment[] = [
  [[600, 10], [556, 14], [520, 40], [474, 44]],
  [[474, 44], [424, 48], [404, 30], [356, 44]],
  [[356, 44], [306, 58], [300, 110], [258, 128]],
  [[258, 128], [222, 143], [196, 128], [172, 140]],
];
const VINE = `M${SEGMENTS[0][0].join(' ')} ${SEGMENTS.map(([, c1, c2, end]) => `C ${c1.join(' ')} ${c2.join(' ')} ${end.join(' ')}`).join(' ')}`;

/** Point and direction (radians) of the vine at parameter t of segment i. */
function along(i: number, t: number): { x: number; y: number; angle: number } {
  const [p0, p1, p2, p3] = SEGMENTS[i];
  const u = 1 - t;
  const coord = (k: 0 | 1) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k];
  const slope = (k: 0 | 1) => 3 * u * u * (p1[k] - p0[k]) + 6 * u * t * (p2[k] - p1[k]) + 3 * t * t * (p3[k] - p2[k]);
  return { x: coord(0), y: coord(1), angle: Math.atan2(slope(1), slope(0)) };
}

/** Leaf in a unit box: base at (0,0) on the vine, tip at (0,-1); the midrib stays inside the blade. */
const LEAF = 'M0 0 C -0.44 -0.22 -0.46 -0.74 0 -1 C 0.46 -0.74 0.44 -0.22 0 0 Z';
const MIDRIB = 'M0 -0.1 L0 -0.8';
/** Where leaves grow: segment, position on it, side (1 / -1) and length. They alternate sides like a real vine. */
const LEAF_SPOTS: readonly [segment: number, t: number, side: 1 | -1, size: number][] = [
  [0, 0.22, 1, 26], [0, 0.62, -1, 22], [1, 0.12, 1, 24], [1, 0.55, -1, 20], [1, 0.92, 1, 22],
  [2, 0.3, -1, 24], [2, 0.7, 1, 22], [3, 0.25, -1, 20], [3, 0.72, 1, 17],
];
/** Leaves stand off the vine at this angle (radians). */
const LEAF_SPREAD = 0.95;
const LEAVES = LEAF_SPOTS.map(([i, t, side, size]) => {
  const { x, y, angle } = along(i, t);
  // The leaf's own "up" (-y) points along angle + side × spread; SVG rotate() turns +x, so add 90°.
  const deg = ((angle + side * LEAF_SPREAD) * 180) / Math.PI + 90;
  return { key: `${i}-${t}`, transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(1)}) scale(${size})`, size };
});

/**
 * The moss was painted in by hand after the burning: carefully, but not quite exact. Per leaf (same order as
 * LEAF_SPOTS), in the leaf's unit box: offset and size of the paint against the burnt outline (larger = a hair over
 * the line, smaller = a thin bare edge), how far up from the base the brush reached (1 = the whole leaf), how thick
 * the coat is, and an optional tiny dab beside it. Most leaves are neat; the slips are small enough to find only
 * on a second look.
 */
const PAINT: readonly { dx: number; dy: number; scale: number; reach: number; coat: number; dab?: readonly [number, number, number] }[] = [
  { dx: 0, dy: 0, scale: 1, reach: 1, coat: 1 },
  { dx: 0.08, dy: -0.03, scale: 1.09, reach: 1, coat: 0.92, dab: [0.47, -0.54, 0.07] },
  { dx: 0, dy: 0, scale: 0.98, reach: 0.78, coat: 1 },
  { dx: -0.02, dy: 0.01, scale: 1, reach: 1, coat: 0.82 },
  { dx: 0, dy: 0, scale: 1, reach: 1, coat: 1 },
  { dx: 0.03, dy: 0.05, scale: 0.88, reach: 1, coat: 1.05 },
  { dx: -0.08, dy: -0.01, scale: 1.09, reach: 1, coat: 0.97, dab: [-0.55, -0.2, 0.06] },
  { dx: 0, dy: 0, scale: 1, reach: 0.72, coat: 0.92 },
  { dx: 0.02, dy: 0, scale: 1.03, reach: 1, coat: 1 },
];
/** Where the brush stopped: everything from the base up to `reach`, ending in a ragged edge. */
const reachClip = (reach: number) => {
  const top = -reach;
  return `M-0.7 0.3 L-0.7 ${top + 0.05} L-0.35 ${top - 0.04} L-0.1 ${top + 0.06} L0.15 ${top - 0.05} L0.4 ${top + 0.03} L0.7 ${top - 0.02} L0.7 0.3 Z`;
};

/** Curls branching off between the leaves, on the side with room. */
const CURL_SPOTS: readonly [segment: number, t: number, side: 1 | -1][] = [[0, 0.42, 1], [2, 0.5, -1], [3, 0.5, 1]];
const CURLS = CURL_SPOTS.map(([i, t, side]) => {
  const { x, y, angle } = along(i, t);
  const out = angle + side * 1.15;
  // A short stalk, then a tightening spiral.
  const points: string[] = [];
  let px = x;
  let py = y;
  let heading = out;
  for (let step = 0; step < 34; step += 1) {
    const len = 2.6 * (1 - step / 44);
    heading += side * (0.05 + step * 0.012);
    px += Math.cos(heading) * len;
    py += Math.sin(heading) * len;
    points.push(`${px.toFixed(1)} ${py.toFixed(1)}`);
  }
  return `M${x.toFixed(1)} ${y.toFixed(1)} L${points.join(' L')}`;
});

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
export function scaleStrokes(node: ReactNode, factor: number): ReactNode {
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
    <g {...LINE} style={{ stroke }}>
      <path d={VINE} strokeWidth={VINE_LINE * grow} />
      {CURLS.map((d) => <path key={d} d={d} strokeWidth={VINE_LINE * 0.6 * grow} />)}
      {LEAVES.map((leaf) => (
        <g key={leaf.key} transform={leaf.transform} strokeWidth={(VINE_LINE * 0.75 * grow) / leaf.size}>
          <path d={LEAF} />
          <path d={MIDRIB} strokeWidth={(VINE_LINE * 0.45 * grow) / leaf.size} />
        </g>
      ))}
      {iconArt && (
        <g className="engraving-icon" transform={`translate(${ICON_AT.x} ${ICON_AT.y}) scale(${ICON_AT.scale})`} strokeWidth={(ICON_LINE * grow) / ICON_AT.scale}>
          {grow === 1 ? iconArt : scaleStrokes(iconArt, grow)}
        </g>
      )}
    </g>
  );
  const layer = (blend: string, children: ReactNode) => (
    <svg viewBox="0 0 600 320" preserveAspectRatio="xMaxYMin meet" aria-hidden="true"
      className="absolute right-0 top-0 h-full" style={{ width, mixBlendMode: blend as CSSProperties['mixBlendMode'] }}>
      {children}
    </svg>
  );
  return (
    <>
      {layer('var(--burn-blend)', <>
        <defs>
          <filter id={`${id}-scorch`} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.6" /></filter>
        </defs>
        <g filter={`url(#${id}-scorch)`} style={{ opacity: 'var(--burn-scorch-opacity)' }}>{lines('var(--burn-scorch)', 2.4)}</g>
      </>)}
      {/* Moss painted into the leaves by hand: above the scorch, under the cut lines. The filter gives the brush edge
          and the coat a faint unevenness. */}
      {layer('normal', <>
        <defs>
          <filter id={`${id}-paint`} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="2" seed="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.7" xChannelSelector="R" yChannelSelector="G" result="ragged" />
            <feTurbulence type="fractalNoise" baseFrequency="0.09 0.55" numOctaves="2" seed="11" result="streaks" />
            <feColorMatrix in="streaks" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.85 0 0 0 1.35" result="coat" />
            <feComposite in="ragged" in2="coat" operator="in" />
          </filter>
          {PAINT.map((paint, i) => paint.reach < 1 && <clipPath key={i} id={`${id}-reach-${i}`}><path d={reachClip(paint.reach)} /></clipPath>)}
        </defs>
        <g filter={`url(#${id}-paint)`} style={{ fill: 'var(--burn-moss)' }}>
          {LEAVES.map((leaf, i) => {
            const paint = PAINT[i];
            return (
              <g key={`m${leaf.key}`} transform={leaf.transform} style={{ fillOpacity: `calc(var(--burn-moss-opacity) * ${paint.coat})` }}>
                <path d={LEAF} transform={`translate(${paint.dx} ${paint.dy}) scale(${paint.scale})`} clipPath={paint.reach < 1 ? `url(#${id}-reach-${i})` : undefined} />
                {paint.dab && <ellipse cx={paint.dab[0]} cy={paint.dab[1]} rx={paint.dab[2]} ry={paint.dab[2] * 0.7} />}
              </g>
            );
          })}
        </g>
      </>)}
      {layer('var(--burn-blend)', <>
        <g transform="translate(0.7 0.9)">{lines('var(--burn-edge)', 1)}</g>
        {lines('var(--burn-groove)', 1)}
      </>)}
    </>
  );
}
