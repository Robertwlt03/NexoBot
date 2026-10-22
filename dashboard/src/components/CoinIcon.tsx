// A Bernis coin (gold, silver or bronze) with the amber drop engraved: the same geometry the cards draw
// (src/shared/coins.ts).
import { useId } from 'react';
import { amberSvgPath, AMBER_DROP, AMBER_LEAF } from '../../../src/shared/amber';
import { COIN, COIN_COLORS, coinDetail, type CoinTier } from '../../../src/shared/coins';

/** Without `size` the coin is sized by CSS (e.g. h-[1em] w-[1em] to follow the text). */
export function CoinIcon({ tier, size, className = '', title }: { tier: CoinTier; size?: number; className?: string; title?: string }) {
  const id = useId();
  const c = COIN_COLORS[tier];
  const { drop, depth } = COIN;
  const at = (x: number, y: number) => `translate(${x} ${y}) scale(${drop.k})`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${COIN.box} ${COIN.box}`} className={`inline-block shrink-0 ${className}`}
      role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <radialGradient id={`${id}-rim`} cx="9" cy="8" r={COIN.rim} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={c.mid} /><stop offset="1" stopColor={c.rim} />
        </radialGradient>
        <radialGradient id={`${id}-face`} cx="9" cy="8.5" r={COIN.face * 1.15} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={c.light} /><stop offset="0.55" stopColor={c.mid} /><stop offset="1" stopColor={c.deep} />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r={COIN.rim} fill={`url(#${id}-rim)`} />
      <circle cx="12" cy="12" r={COIN.face} fill={`url(#${id}-face)`} />
      {/* Engraved drop: lit lower-right edge, the recess over it, the leaf cut deeper. */}
      <path d={amberSvgPath(AMBER_DROP)} transform={at(drop.x + depth, drop.y + depth)} fill={c.shine} fillOpacity={0.8} />
      <path d={amberSvgPath(AMBER_DROP)} transform={at(drop.x, drop.y)} fill={c.recess} />
      {(size === undefined || coinDetail(size) === 'full') && <path d={amberSvgPath(AMBER_LEAF)} transform={at(drop.x, drop.y)} fill={c.deep} fillOpacity={0.55} />}
      <circle cx="12" cy="12" r={COIN.face} fill="none" stroke={c.deep} strokeOpacity={0.5} strokeWidth={0.5} />
    </svg>
  );
}
