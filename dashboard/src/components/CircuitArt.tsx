// Header art of the Cyberpunk theme, the counterpart of Engraving.tsx on the wood: the page's own icon as a cyan neon
// sign, locked in by four yellow target corners like a HUD, with a small tag below (NC/ + the page name, flush right so long names grow to the left). A soft blur
// under the icon gives the glow.
import { Children, cloneElement, isValidElement, useId } from 'react';
import type { ReactNode } from 'react';

const YELLOW = '#fcee0a';
const CYAN = '#00f0ff';

/** Where the 24px icon sits on the 600×320 board and how big it is drawn (viewBox units), as on the wood. */
const ICON_AT = { x: 430, y: 70, scale: 5.8 } as const;
/** The target corners: 18 units outside the icon, 28 long. */
const BOX = { x: 412, y: 52, size: 24 * ICON_AT.scale + 36, arm: 28 } as const;
const CORNERS = (() => {
  const { x, y, size, arm } = BOX;
  const r = x + size;
  const b = y + size;
  return `M${x} ${y + arm}V${y}H${x + arm}M${r - arm} ${y}H${r}V${y + arm}M${r} ${b - arm}V${b}H${r - arm}M${x + arm} ${b}H${x}V${b - arm}`;
})();
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

export function CircuitArt({ art, label, width }: { art?: ReactNode; label?: string; width: string }) {
  const id = useId();
  const iconArt = art ? scaleStrokes(art, ICON_LINE / ICON_AT.scale / 2) : null;
  const lines = (glow: boolean) => (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round" filter={glow ? `url(#${id}-glow)` : undefined} opacity={glow ? 0.6 : 1}>
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
      {iconArt && <path d={CORNERS} fill="none" stroke={YELLOW} strokeWidth="3" />}
      {iconArt && label && (
        <text x={BOX.x + BOX.size} y={BOX.y + BOX.size + 30} textAnchor="end" fill={YELLOW} fontSize="18" letterSpacing="2" style={{ fontFamily: 'var(--font-display)' }}>
          NC/{label.toUpperCase().replace(/\s+/g, '_')}
        </text>
      )}
      {lines(true)}
      {lines(false)}
    </svg>
  );
}
