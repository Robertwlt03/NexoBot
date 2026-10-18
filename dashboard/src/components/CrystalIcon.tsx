// Kristalle currency icon: the same faceted crystal the profile cards draw (src/shared/crystal.ts).
import { CRYSTAL_BOX, CRYSTAL_FACETS, CRYSTAL_OUTLINE, CRYSTAL_OUTLINE_COLOR } from '../../../src/shared/crystal';

const toPoints = (points: readonly (readonly [number, number])[]) => points.map(([x, y]) => `${x},${y}`).join(' ');

/** Without `size` the icon is sized by CSS (e.g. h-[1em] w-[1em] to follow the text). */
export function CrystalIcon({ size, className = '', title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${CRYSTAL_BOX} ${CRYSTAL_BOX}`} className={`inline-block shrink-0 ${className}`}
      role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {CRYSTAL_FACETS.map((facet, index) => (
        <polygon key={index} points={toPoints(facet.points)} fill={facet.fill} fillOpacity={facet.opacity ?? 1} />
      ))}
      <polygon points={toPoints(CRYSTAL_OUTLINE)} fill="none" stroke={CRYSTAL_OUTLINE_COLOR} strokeWidth="0.6" strokeLinejoin="round" />
    </svg>
  );
}
