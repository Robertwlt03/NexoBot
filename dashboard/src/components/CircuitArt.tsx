// Header art of the Cyberpunk theme, the counterpart of Engraving.tsx on the wood: circuit traces running in from the
// top-right corner and the page's own icon drawn as a neon sign at the same spot as the burnt icon. Edgerunners colours:
// yellow traces, the icon in cyan, a touch of pink on the pads; a soft blur under every line gives the glow.
import { Children, cloneElement, isValidElement, useId } from 'react';
import type { ReactNode } from 'react';

const YELLOW = '#fcee0a';
const CYAN = '#00f0ff';
const PINK = '#c362c0';

/** Traces on the 600×320 board: two short runs with a 45° bend, each ending in a pad; they keep clear of the icon. */
const TRACES: readonly { d: string; pad: readonly [number, number]; pink?: boolean }[] = [
  { d: 'M600 30H548L524 54H486', pad: [486, 54] },
  { d: 'M600 236H574L556 254V284', pad: [556, 284], pink: true },
];

/** Where the 24px icon sits and how big it is drawn (viewBox units), as on the wood. */
const ICON_AT = { x: 446, y: 70, scale: 5.8 } as const;
const ICON_LINE = 2.6;

/** Details with their own strokeWidth on the 24px grid keep their ratio to the rest of the icon. */
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

export function CircuitArt({ art, width }: { art?: ReactNode; width: string }) {
  const id = useId();
  const iconArt = art ? scaleStrokes(art, ICON_LINE / ICON_AT.scale / 2) : null;
  const lines = (glow: boolean) => (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round" filter={glow ? `url(#${id}-glow)` : undefined} opacity={glow ? 0.6 : 1}>
      {TRACES.map((trace) => (
        <g key={trace.d}>
          <path d={trace.d} stroke={YELLOW} strokeOpacity={glow ? 0.7 : 0.55} strokeWidth={glow ? 3 : 1.6} />
          <circle cx={trace.pad[0]} cy={trace.pad[1]} r={glow ? 6 : 4} fill={glow ? 'none' : '#0b0c0f'} stroke={trace.pink ? PINK : YELLOW} strokeWidth={1.8} />
        </g>
      ))}
      {iconArt && (
        <g className="engraving-icon" transform={`translate(${ICON_AT.x} ${ICON_AT.y}) scale(${ICON_AT.scale})`} stroke={CYAN}
          strokeWidth={(glow ? ICON_LINE * 2.2 : ICON_LINE) / ICON_AT.scale} strokeOpacity={glow ? 0.8 : 1}>
          {iconArt}
        </g>
      )}
    </g>
  );
  return (
    <svg viewBox="0 0 600 320" preserveAspectRatio="xMaxYMin meet" aria-hidden="true" className="absolute right-0 top-0 h-full" style={{ width }}>
      <defs>
        <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      {lines(true)}
      {lines(false)}
    </svg>
  );
}
