// Kristalle currency icon: the same Nexo crystal the profile cards draw (src/shared/crystal.ts).
import { useId } from 'react';
import {
  CRYSTAL_BOX, CRYSTAL_FACETS, CRYSTAL_GLINT, CRYSTAL_OUTLINE, CRYSTAL_OUTLINE_COLOR, EYES, EYE_GLOW, MOON, RING_COLORS,
  RING_WIDTH, RING_WIDTH_SMALL, VISOR_HALVES, VISOR_RIM, crystalDetail, ringHalf, type CrystalDetail, type CrystalFacet, type Point,
} from '../../../src/shared/crystal';

const toPoints = (points: readonly Point[]) => points.map(([x, y]) => `${x},${y}`).join(' ');
const Facet = ({ facet }: { facet: CrystalFacet }) => <polygon points={toPoints(facet.points)} fill={facet.fill} fillOpacity={facet.opacity ?? 1} />;

/**
 * Without `size` the icon is sized by CSS (e.g. h-[1em] w-[1em] to follow the text) and shows the "small" variant
 * (crystal with face and orbit ring); `detail` overrides the size-based level of detail.
 */
export function CrystalIcon({ size, detail, className = '', title }: { size?: number; detail?: CrystalDetail; className?: string; title?: string }) {
  const id = useId();
  const level = detail ?? (size ? crystalDetail(size) : 'small');
  const full = level === 'full';
  const ring = (half: 'back' | 'front') => (
    <polyline points={toPoints(ringHalf(half))} fill="none" stroke={`url(#${id}-ring)`} strokeWidth={full ? RING_WIDTH : RING_WIDTH_SMALL}
      strokeLinecap="round" strokeLinejoin="round" opacity={half === 'back' ? 0.55 : 1} />
  );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${CRYSTAL_BOX} ${CRYSTAL_BOX}`} className={`inline-block shrink-0 ${className}`}
      role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id={`${id}-ring`} x1="1" y1="0" x2="23" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={RING_COLORS[0]} />
          <stop offset="1" stopColor={RING_COLORS[1]} />
        </linearGradient>
        {EYES.map((eye, i) => (
          <radialGradient key={i} id={`${id}-glow${i}`}>
            <stop offset="0" stopColor={EYE_GLOW} stopOpacity={eye.glowOpacity} />
            <stop offset="1" stopColor={EYE_GLOW} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      {level !== 'tiny' && ring('back')}
      {CRYSTAL_FACETS.map((facet, i) => <Facet key={i} facet={facet} />)}
      {full && <Facet facet={CRYSTAL_GLINT} />}
      <polygon points={toPoints(CRYSTAL_OUTLINE)} fill="none" stroke={CRYSTAL_OUTLINE_COLOR} strokeWidth="0.6" strokeLinejoin="round" />
      {level !== 'tiny' && (
        <>
          {VISOR_HALVES.map((half, i) => <Facet key={i} facet={half} />)}
          {full && VISOR_RIM.map((rim, i) => (
            <line key={i} x1={rim.from[0]} y1={rim.from[1]} x2={rim.to[0]} y2={rim.to[1]} stroke={rim.color} strokeOpacity={rim.opacity} strokeWidth="0.35" strokeLinecap="round" />
          ))}
          {EYES.map((eye, i) => (
            <g key={i}>
              {full && <circle cx={eye.at[0]} cy={eye.at[1]} r={eye.r * 2.6} fill={`url(#${id}-glow${i})`} />}
              <circle cx={eye.at[0]} cy={eye.at[1]} r={eye.r * (full ? 1 : 1.25)} fill={eye.core} />
              {full && <circle cx={eye.at[0] - eye.r * 0.35} cy={eye.at[1] - eye.r * 0.35} r={eye.r * 0.38} fill="#ffffff" fillOpacity="0.85" />}
            </g>
          ))}
        </>
      )}
      {level !== 'tiny' && ring('front')}
      {full && <circle cx={MOON.at[0]} cy={MOON.at[1]} r={MOON.r} fill={MOON.fill} />}
    </svg>
  );
}
