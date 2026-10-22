// A Bernis coin (platinum, gold, silver or bronze): an octagonal token with the amber drop cut in, the same
// geometry the cards draw (src/shared/coins.ts).
import { useId } from 'react';
import { AMBER_DROP, amberSvgPath } from '../../../src/shared/amber';
import { COIN, COIN_COLORS, octagon, type CoinTier } from '../../../src/shared/coins';

const points = (r: number) => octagon(12, 12, r).map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
const RIM = points(COIN.rim);
const BEVEL = points(COIN.bevel);
const FIELD = points(COIN.field);
const DROP = amberSvgPath(AMBER_DROP);

/** Without `size` the coin is sized by CSS (e.g. h-[1em] w-[1em] to follow the text). */
export function CoinIcon({ tier, size, className = '', title }: { tier: CoinTier; size?: number; className?: string; title?: string }) {
  const id = useId();
  const c = COIN_COLORS[tier];
  const { drop, depth } = COIN;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${COIN.box} ${COIN.box}`} className={`inline-block shrink-0 ${className}`}
      role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id={`${id}-bevel`} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={c.light} /><stop offset="0.5" stopColor={c.mid} /><stop offset="1" stopColor={c.deep} />
        </linearGradient>
        <radialGradient id={`${id}-field`} cx="9" cy="8.5" r={COIN.field * 1.3} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={c.mid} /><stop offset="1" stopColor={c.deep} />
        </radialGradient>
      </defs>
      <polygon points={RIM} fill={c.rim} />
      <polygon points={BEVEL} fill={`url(#${id}-bevel)`} />
      <polygon points={FIELD} fill={`url(#${id}-field)`} />
      {/* The drop cut in: its lit lower-right edge, then the hole in the rim colour. */}
      <path d={DROP} transform={`translate(${drop.x + depth.x} ${drop.y + depth.y}) scale(${drop.k})`} fill={c.shine} fillOpacity={0.7} />
      <path d={DROP} transform={`translate(${drop.x} ${drop.y}) scale(${drop.k})`} fill={c.rim} />
    </svg>
  );
}
