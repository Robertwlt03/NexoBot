// Event icons for event lists (season page, shop): small multi-colour pictures taken from the banner scenes in
// EventScene.tsx, so the list and the banner speak the same language. Kept apart from EventScene.tsx, which the
// tests import for eventTheme() without a React runtime.
import type { ReactNode } from 'react';
import type { ShopEvent } from '../../../src/web/dto/profile';
import { eventTheme, type EventTheme } from './EventScene';

const LEAF = 'M0-11C7-6 7 5 0 11-7 5-7-6 0-11Z';
const HEART = 'M12 21C5 16.5 2 12.6 2 8.6 2 5.5 4.4 3 7.4 3c1.9 0 3.6 1 4.6 2.6C13 4 14.7 3 16.6 3 19.6 3 22 5.5 22 8.6c0 4-3 7.9-10 12.4Z';
const MASK = 'M14 54c2-14 20-16 46-6 26-10 44-8 46 6 2 18-14 28-28 24-8-2-12-8-18-8s-10 6-18 8c-14 4-30-6-28-24Z';
const MASK_EYE = 'M30 58c6-8 18-6 22 2-6 6-18 6-22-2Z';
const egg = (x: number, y: number, rx: number, ry: number, fill: string) => (
  <g key={x}>
    <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={fill} />
    <path d={`M${x - rx + 0.4} ${y}l${rx / 2.4} -1.3 ${rx / 2.4} 1.3 ${rx / 2.4} -1.3 ${rx / 2.4} 1.3 ${rx / 2.4} -1.3`} stroke="#fff" strokeOpacity=".85" strokeWidth="1.1" strokeLinejoin="round" fill="none" />
  </g>
);

/** One small picture per event theme on a 24×24 grid. */
const EVENT_ART: Record<EventTheme, ReactNode> = {
  // Two hearts, the lighter one behind.
  love: <><path d={HEART} fill="#f27b93" transform="translate(8.6 1.2) scale(.62)" /><path d={HEART} fill="#e5536f" transform="translate(.6 5.2) scale(.72)" /></>,
  // The violet carnival mask with its gold rim and stick.
  carnival: (
    <g transform="translate(1.4 5.4) rotate(-8 10 6) scale(.19) translate(-12 -38)">
      <path d="M100 76l14 40" stroke="#c98a10" strokeWidth="7" strokeLinecap="round" />
      <path d={MASK} fill="#6d28b0" stroke="#e8b84a" strokeWidth="5" strokeLinejoin="round" />
      <path d={MASK_EYE} fill="#170826" /><path d={MASK_EYE} transform="matrix(-1 0 0 1 120 0)" fill="#170826" />
    </g>
  ),
  // Two painted eggs, pink and blue, with white zigzag bands.
  easter: <>{egg(9, 13.5, 5.2, 6.6, '#f2a7c3')}{egg(16.6, 15.6, 4.3, 5.4, '#7dc4e8')}</>,
  // The summer sun with its ring of rays.
  summer: <><path d="M19.4 12L22.4 12M18.41 15.7L21.01 17.2M15.7 18.41L17.2 21.01M12 19.4L12 22.4M8.3 18.41L6.8 21.01M5.59 15.7L2.99 17.2M4.6 12L1.6 12M5.59 8.3L2.99 6.8M8.3 5.59L6.8 2.99M12 4.6L12 1.6M15.7 5.59L17.2 2.99M18.41 8.3L21.01 6.8" stroke="#e09a22" strokeWidth="1.8" strokeLinecap="round" /><circle cx="12" cy="12" r="5.6" fill="#f2b33d" stroke="#d08a1a" strokeWidth="1" /></>,
  // Three autumn leaves fanned out, in the scene's rust, ochre and brown.
  autumn: (
    <>
      {([[-40, 7, 14.2, '#c98a2a'], [40, 17, 14.2, '#8a3414'], [0, 12, 11.4, '#b0561f']] as const).map(([angle, x, y, fill]) => (
        <g key={angle} transform={`translate(${x} ${y}) rotate(${angle}) scale(.62)`}>
          <path d={LEAF} fill={fill} /><path d="M0-9V10" stroke="#00000040" strokeWidth="1.4" />
        </g>
      ))}
    </>
  ),
  // The Halloween pumpkin from the banner: three lobes, a green stem and a lit face.
  halloween: (
    <g transform="translate(1 2.4) scale(.229) translate(-102 -220)">
      <g stroke="#9c420a" strokeWidth="2.5">
        <ellipse cx="128" cy="270" rx="26" ry="30" fill="#c2561a" /><ellipse cx="172" cy="270" rx="26" ry="30" fill="#c2561a" />
        <ellipse cx="150" cy="270" rx="24" ry="32" fill="#dc6a1f" />
      </g>
      <path d="M148 240c-1-8 1-14 6-18l5 3c-4 4-5 9-5 15Z" fill="#4d6b2a" />
      <g fill="#ffcf4a"><path d="M128 266l8-11 4 13Z" /><path d="M172 266l-8-11-4 13Z" /><path d="M128 279q22 18 44 0l-5 2-3-3-5 5-4-4-5 5-5-5-4 4-5-5-3 3Z" /></g>
    </g>
  ),
  // Black Friday: a black price tag with a gold rim, hole and percent sign, like the tags in the banner.
  sale: (
    <>
      <path d="M2.5 11.6V3.5a1 1 0 0 1 1-1h8.1l9.6 9.6-9.1 9.1Z" fill="#16130f" stroke="#e8b84a" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="7" cy="7" r="1.6" fill="#e8b84a" />
      <path d="M10.4 15.4l4.6-4.6" stroke="#e8b84a" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="10.9" cy="11.1" r="1" fill="#e8b84a" /><circle cx="14.5" cy="15.1" r="1" fill="#e8b84a" />
    </>
  ),
  // A snowy pine with a white tip and a few flakes.
  winter: (
    <>
      <path d="M12 1.8l5 7h-2.5l4 5.6h-2.7L20 20H4l4.2-5.6H5.5l4-5.6H7Z" fill="#3d7a4a" />
      <rect x="10.9" y="20" width="2.2" height="2.6" rx=".5" fill="#6b4a33" />
      <path d="M12 1.8l2.1 2.9L12 4l-2.1.7Z" fill="#eef4fa" />
      <g fill="#eef4fa"><circle cx="9.6" cy="12.6" r=".9" /><circle cx="14.6" cy="16.6" r=".9" /><circle cx="13.2" cy="9.4" r=".8" /><circle cx="8.4" cy="17.6" r=".8" /></g>
    </>
  ),
  // Fireworks: a big gold burst, a pink and a blue one.
  newyear: <><path d="M13.7 9.5L18.5 9.5M13.27 11.1L17.43 13.5M12.1 12.27L14.5 16.43M10.5 12.7L10.5 17.5M8.9 12.27L6.5 16.43M7.73 11.1L3.57 13.5M7.3 9.5L2.5 9.5M7.73 7.9L3.57 5.5M8.9 6.73L6.5 2.57M10.5 6.3L10.5 1.5M12.1 6.73L14.5 2.57M13.27 7.9L17.43 5.5" stroke="#d49a1a" strokeWidth="1.1" strokeLinecap="round" /><path d="M20.34 16.5L23.1 16.5M20.09 17.42L22.48 18.8M19.42 18.09L20.8 20.48M18.5 18.34L18.5 21.1M17.58 18.09L16.2 20.48M16.91 17.42L14.52 18.8M16.66 16.5L13.9 16.5M16.91 15.58L14.52 14.2M17.58 14.91L16.2 12.52M18.5 14.66L18.5 11.9M19.42 14.91L20.8 12.52M20.09 15.58L22.48 14.2" stroke="#e5536f" strokeWidth="1" strokeLinecap="round" /><path d="M6.36 19L8.4 19M6.18 19.68L7.94 20.7M5.68 20.18L6.7 21.94M5 20.36L5 22.4M4.32 20.18L3.3 21.94M3.82 19.68L2.06 20.7M3.64 19L1.6 19M3.82 18.32L2.06 17.3M4.32 17.82L3.3 16.06M5 17.64L5 15.6M5.68 17.82L6.7 16.06M6.18 18.32L7.94 17.3" stroke="#3a8fd0" strokeWidth=".9" strokeLinecap="round" /></>,
  // A violet gift with a gold ribbon and bow, as in the party banner.
  party: (
    <g transform="translate(2 1.6) scale(.217) translate(-114 -214)">
      <rect x="120" y="250" width="80" height="58" rx="3" fill="#5b2bb5" /><rect x="114" y="234" width="92" height="20" rx="3" fill="#7c4ad8" />
      <rect x="154" y="234" width="12" height="74" fill="#e8b84a" />
      <path d="M160 234c-16-18-32-8-20 0 4 3 14 2 20 0Zm0 0c16-18 32-8 20 0-4 3-14 2-20 0Z" fill="#e8b84a" />
    </g>
  ),
};

export function EventIcon({ event, size = 20 }: { event: Pick<ShopEvent, 'id' | 'name'>; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      {EVENT_ART[eventTheme(event)]}
    </svg>
  );
}
