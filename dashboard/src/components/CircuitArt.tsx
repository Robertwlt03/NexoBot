// Header art of the Cyberpunk theme, the counterpart of Engraving.tsx on the wood: the page's own icon as a cyan neon
// sign, locked in by four muted target corners like a HUD, with a small tag above (NC/ + the page name, flush right so
// long names grow to the left). Fixed size in CSS pixels (styles.css .cyber-hud), so it stays legible on small screens
// instead of shrinking with the header; Backdrop.tsx lines it up with the right edge of the content column. A soft blur
// under the icon gives the glow.
import { Children, cloneElement, isValidElement, useId } from 'react';
import type { ReactNode } from 'react';

const CYAN = '#00f0ff';

/** The 120×120 board: target corners around it, the 24px icon in the middle with 20 units of room. */
const SIZE = 120;
const ARM = 20;
const ICON_SCALE = (SIZE - 40) / 24;
const CORNERS = `M1 ${ARM}V1H${ARM}M${SIZE - ARM} 1H${SIZE - 1}V${ARM}M${SIZE - 1} ${SIZE - ARM}V${SIZE - 1}H${SIZE - ARM}M${ARM} ${SIZE - 1}H1V${SIZE - ARM}`;
/** Icon line width on the 24px grid. */
const ICON_LINE = 1.4;

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

export function CircuitArt({ art, label }: { art?: ReactNode; label?: string }) {
  const id = useId();
  if (!art) return null;
  const iconArt = scaleStrokes(art, ICON_LINE / 2);
  const icon = (glow: boolean) => (
    <g className="engraving-icon" transform={`translate(20 20) scale(${ICON_SCALE})`} fill="none" stroke={CYAN} strokeLinecap="round" strokeLinejoin="round"
      strokeWidth={glow ? ICON_LINE * 2.2 : ICON_LINE} strokeOpacity={glow ? 0.5 : 1} filter={glow ? `url(#${id}-glow)` : undefined}>
      {iconArt}
    </g>
  );
  return (
    <div className="cyber-hud">
      {label && <span className="cyber-hud-tag">NC/{label.toUpperCase().replace(/\s+/g, '_')}</span>}
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <defs>
          <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.2" /></filter>
        </defs>
        <path d={CORNERS} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {icon(true)}
        {icon(false)}
      </svg>
    </div>
  );
}
