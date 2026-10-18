// Kristalle currency icon: the same Nexo crystal the profile cards draw (src/shared/crystal.ts).
import { useId } from 'react';
import {
  CRYSTAL_BOX, CRYSTAL_FACETS, CRYSTAL_OUTLINE, CRYSTAL_OUTLINE_COLOR, EYES, MOON, RING_COLORS, RING_WIDTH, VISOR,
  crystalDetail, ringHalf, type CrystalDetail, type Point,
} from '../../../src/shared/crystal';

const toPoints = (points: readonly Point[]) => points.map(([x, y]) => `${x},${y}`).join(' ');

/**
 * Without `size` the icon is sized by CSS (e.g. h-[1em] w-[1em] to follow the text) and shows the ring variant;
 * `detail` overrides the size-based level of detail.
 */
export function CrystalIcon({ size, detail, className = '', title }: { size?: number; detail?: CrystalDetail; className?: string; title?: string }) {
  const gradientId = useId();
  const level = detail ?? (size ? crystalDetail(size) : 'small');
  const ring = (half: 'back' | 'front') => (
    <polyline points={toPoints(ringHalf(half))} fill="none" stroke={`url(#${gradientId})`} strokeWidth={RING_WIDTH}
      strokeLinecap="round" strokeLinejoin="round" opacity={half === 'back' ? 0.55 : 1} />
  );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${CRYSTAL_BOX} ${CRYSTAL_BOX}`} className={`inline-block shrink-0 ${className}`}
      role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id={gradientId} x1="1" y1="0" x2="23" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={RING_COLORS[0]} />
          <stop offset="1" stopColor={RING_COLORS[1]} />
        </linearGradient>
      </defs>
      {level !== 'tiny' && ring('back')}
      {CRYSTAL_FACETS.filter((facet) => level !== 'tiny' || facet.opacity === undefined).map((facet, index) => (
        <polygon key={index} points={toPoints(facet.points)} fill={facet.fill} fillOpacity={facet.opacity ?? 1} />
      ))}
      <polygon points={toPoints(CRYSTAL_OUTLINE)} fill="none" stroke={CRYSTAL_OUTLINE_COLOR} strokeWidth="0.6" strokeLinejoin="round" />
      {level === 'full' && (
        <>
          <rect x={VISOR.x} y={VISOR.y} width={VISOR.w} height={VISOR.h} rx={VISOR.h / 2} fill={VISOR.fill} />
          {EYES.points.map(([x, y]) => <circle key={x} cx={x} cy={y} r={EYES.r} fill={EYES.fill} />)}
        </>
      )}
      {level !== 'tiny' && ring('front')}
      {level === 'full' && <circle cx={MOON.at[0]} cy={MOON.at[1]} r={MOON.r} fill={MOON.fill} />}
    </svg>
  );
}
