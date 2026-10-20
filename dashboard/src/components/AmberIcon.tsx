// Bernis currency icon: the same amber drop the profile cards draw (src/shared/amber.ts).
import { useId } from 'react';
import {
  AMBER_BOX, AMBER_BUBBLE, AMBER_COLORS, AMBER_DROP, AMBER_GLINT, AMBER_LEAF, AMBER_LIGHT, AMBER_VEIN, amberDetail, amberSvgPath,
  type AmberDetail,
} from '../../../src/shared/amber';

/**
 * Without `size` the icon is sized by CSS (e.g. h-[1em] w-[1em] to follow the text) and shows the "small" variant;
 * `detail` overrides the size-based level of detail.
 */
export function AmberIcon({ size, detail, className = '', title }: { size?: number; detail?: AmberDetail; className?: string; title?: string }) {
  const id = useId();
  const level = detail ?? (size ? amberDetail(size) : 'small');
  return (
    <svg width={size} height={size} viewBox={`0 0 ${AMBER_BOX} ${AMBER_BOX}`} className={`inline-block shrink-0 ${className}`}
      role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <radialGradient id={`${id}-light`} cx={AMBER_LIGHT.x} cy={AMBER_LIGHT.y} r={AMBER_LIGHT.r} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={AMBER_COLORS.light} />
          <stop offset="0.5" stopColor={AMBER_COLORS.mid} />
          <stop offset="1" stopColor={AMBER_COLORS.deep} />
        </radialGradient>
      </defs>
      <path d={amberSvgPath(AMBER_DROP)} fill={`url(#${id}-light)`} />
      <path d={amberSvgPath(AMBER_LEAF)} fill={AMBER_COLORS.leaf} fillOpacity={0.6} />
      {level === 'full' && (
        <>
          <path d={amberSvgPath(AMBER_VEIN)} fill="none" stroke={AMBER_COLORS.vein} strokeOpacity={0.45} strokeWidth={0.4} strokeLinecap="round" />
          <circle cx={AMBER_BUBBLE.x} cy={AMBER_BUBBLE.y} r={AMBER_BUBBLE.r} fill="#ffffff" fillOpacity={0.55} />
        </>
      )}
      {level !== 'tiny' && <path d={amberSvgPath(AMBER_GLINT)} fill="#ffffff" fillOpacity={0.55} />}
      <path d={amberSvgPath(AMBER_DROP)} fill="none" stroke={AMBER_COLORS.outline} strokeWidth={0.6} strokeLinejoin="round" />
    </svg>
  );
}
