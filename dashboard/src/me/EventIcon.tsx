// Event icons for event lists (season page, shop): small multi-colour pictures taken from the banner scenes in
// EventScene.tsx, so the list and the banner speak the same language. Kept apart from EventScene.tsx, which the
// tests import for eventTheme() without a React runtime.
import { useId } from 'react';
import type { ReactNode } from 'react';
import type { ShopEvent } from '../../../src/web/dto/profile';
import { eventTheme, type EventTheme } from './EventScene';

const LEAF = 'M0-11C7-6 7 5 0 11-7 5-7-6 0-11Z';
/** The right half of LEAF: its shaded side. */
const LEAF_SHADE = 'M0-11C7-6 7 5 0 11Z';
const HEART = 'M12 21C5 16.5 2 12.6 2 8.6 2 5.5 4.4 3 7.4 3c1.9 0 3.6 1 4.6 2.6C13 4 14.7 3 16.6 3 19.6 3 22 5.5 22 8.6c0 4-3 7.9-10 12.4Z';
const MASK = 'M14 54c2-14 20-16 46-6 26-10 44-8 46 6 2 18-14 28-28 24-8-2-12-8-18-8s-10 6-18 8c-14 4-30-6-28-24Z';
const MASK_EYE = 'M30 58c6-8 18-6 22 2-6 6-18 6-22-2Z';
const egg = (x: number, y: number, rx: number, ry: number, fill: string) => (
  <g key={x}>
    <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={fill} />
    <path d={`M${x - rx + 0.4} ${y}l${rx / 2.4} -1.3 ${rx / 2.4} 1.3 ${rx / 2.4} -1.3 ${rx / 2.4} 1.3 ${rx / 2.4} -1.3`} stroke="#fff" strokeOpacity=".85" strokeWidth="1.1" strokeLinejoin="round" fill="none" />
  </g>
);

/** Four-pointed twinkle. */
const sparkle = (x: number, y: number, r: number, fill: string) => (
  <path key={`${x}-${y}`} d={`M${x} ${y - r}Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y}Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r}Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y}Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z`} fill={fill} />
);

/** One small picture per event theme on a 24×24 grid; a function gets a unique id for its gradients and clip paths. */
const EVENT_ART: Record<EventTheme, ReactNode | ((uid: string) => ReactNode)> = {
  // Two hearts, the lighter one behind.
  love: <><path d={HEART} fill="#f27b93" transform="translate(8.6 1.2) scale(.62)" /><path d={HEART} fill="#e5536f" transform="translate(.6 5.2) scale(.72)" /></>,
  // The carnival mask in violet with a gold rim, gold-ringed eyes, a jewel and three feathers in violet and magenta.
  carnival: (uid) => (
    <g transform="rotate(-6 12 12) translate(1.6 2.4) scale(.18) translate(-4 -8)">
      <defs>
        <linearGradient id={`${uid}-mask`} gradientUnits="userSpaceOnUse" x1="14" y1="40" x2="106" y2="80">
          <stop offset="0" stopColor="#9d52e3" /><stop offset="1" stopColor="#57199a" />
        </linearGradient>
        <linearGradient id={`${uid}-gold`} gradientUnits="userSpaceOnUse" x1="10" y1="36" x2="110" y2="96">
          <stop offset="0" stopColor="#fbe39a" /><stop offset=".5" stopColor="#d79b2c" /><stop offset="1" stopColor="#f3cf6a" />
        </linearGradient>
      </defs>
      {/* Three feathers in the autumn leaf style: two-tone halves, here in violet and magenta. */}
      {([[-38, 18, 30, 1.45, '#d77fe0', '#b45ec4'], [6, 34, 24, 1.5, '#a964e8', '#8746cc'], [-14, 26, 22, 1.7, '#c06cd9', '#9a4cc0']] as const)
        .map(([angle, x, y, scale, lit, shade]) => (
          <g key={angle} transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
            <path d={LEAF} fill={lit} /><path d={LEAF_SHADE} fill={shade} />
          </g>
        ))}
      <path d="M100 76l14 40" stroke={`url(#${uid}-gold)`} strokeWidth="7" strokeLinecap="round" />
      <path d={MASK} fill={`url(#${uid}-mask)`} stroke={`url(#${uid}-gold)`} strokeWidth="5" strokeLinejoin="round" />
      <path d={MASK_EYE} fill="#1b0a30" stroke="#e8b84a" strokeWidth="2" />
      <path d={MASK_EYE} transform="matrix(-1 0 0 1 120 0)" fill="#1b0a30" stroke="#e8b84a" strokeWidth="2" />
      <circle cx="60" cy="52" r="5" fill={`url(#${uid}-gold)`} /><circle cx="60" cy="52" r="2.4" fill="#f27bb8" />
    </g>
  ),
  // Two painted eggs, pink and blue, with white zigzag bands.
  easter: <>{egg(9, 13.5, 5.2, 6.6, '#f2a7c3')}{egg(16.6, 15.6, 4.3, 5.4, '#7dc4e8')}</>,
  // The summer sun with its ring of rays.
  summer: <><path d="M19.4 12L22.4 12M18.41 15.7L21.01 17.2M15.7 18.41L17.2 21.01M12 19.4L12 22.4M8.3 18.41L6.8 21.01M5.59 15.7L2.99 17.2M4.6 12L1.6 12M5.59 8.3L2.99 6.8M8.3 5.59L6.8 2.99M12 4.6L12 1.6M15.7 5.59L17.2 2.99M18.41 8.3L21.01 6.8" stroke="#e09a22" strokeWidth="1.8" strokeLinecap="round" /><circle cx="12" cy="12" r="5.6" fill="#f2b33d" stroke="#d08a1a" strokeWidth="1" /></>,
  // Three autumn leaves fanned from one point, ochre, rust and brown; each lit on the left, shaded on the right.
  // The middle leaf is drawn last, so it sits in front.
  autumn: (
    <>
      {([[-44, 6.8, 13.4, 0.58, '#e0a43a', '#c98a2a'], [44, 17.2, 13.4, 0.58, '#a8401a', '#8a3414'], [0, 12, 10.8, 0.66, '#d0682a', '#b0561f']] as const)
        .map(([angle, x, y, scale, lit, shade]) => (
          <g key={angle} transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
            <path d={LEAF} fill={lit} /><path d={LEAF_SHADE} fill={shade} />
          </g>
        ))}
    </>
  ),
  // A wide Halloween pumpkin: three lobes without outlines, stem and leaf, and a carved face stretched across it.
  // The face glows bright on the lit front lobe and turns a muted gold where it runs into the shaded sides.
  halloween: (uid) => {
    const face = (
      <>
        <path d="M6.4 13.4l2.6-2.8 1.1 3.3z" /><path d="M17.6 13.4l-2.6-2.8-1.1 3.3z" />
        <path d="M4.8 15.4c2 2.6 4.4 3.6 7.2 3.6s5.2-1 7.2-3.6l-1.3.4-.7 1.1-.9-.9-1 1.2-.9-1-1 1.2-1-1.1-1 1.1-1-1.2-.9 1-1-1.2-.9.9-.7-1.1z" />
      </>
    );
    return (
      <>
        <ellipse cx="7.3" cy="14.6" rx="6.1" ry="6.3" fill="#b8501a" /><ellipse cx="16.7" cy="14.6" rx="6.1" ry="6.3" fill="#b8501a" />
        <ellipse cx="12" cy="14.6" rx="6.2" ry="6.8" fill="#de6d22" />
        <path d="M11.2 8.7c-.2-2 .3-3.6 1.6-4.8l1.2.8c-1 .9-1.4 2.2-1.3 4z" fill="#4d6b2a" />
        <path d="M13.4 5.3c1.4-1.2 3.2-1.3 4.6-.4-1.1 1.3-2.9 1.6-4.6.4z" fill="#6f8f3a" />
        <clipPath id={uid}><ellipse cx="12" cy="14.6" rx="6.2" ry="6.8" /></clipPath>
        <g fill="#c27f26">{face}</g>
        <g fill="#ffd257" clipPath={`url(#${uid})`}>{face}</g>
      </>
    );
  },
  // Black Friday: a black tag with a polished gold rim, a gold eyelet, a gold percent sign and a twinkle.
  sale: (uid) => (
    <>
      <defs>
        <linearGradient id={`${uid}-gold`} gradientUnits="userSpaceOnUse" x1="3" y1="3" x2="21" y2="21">
          <stop offset="0" stopColor="#fdeaa8" /><stop offset=".4" stopColor="#d49a2a" /><stop offset=".62" stopColor="#f8d97c" /><stop offset="1" stopColor="#a8701a" />
        </linearGradient>
        <linearGradient id={`${uid}-body`} gradientUnits="userSpaceOnUse" x1="3" y1="3" x2="19" y2="19">
          <stop offset="0" stopColor="#30281d" /><stop offset="1" stopColor="#0b0907" />
        </linearGradient>
      </defs>
      <path d="M2.5 11.6V3.5a1 1 0 0 1 1-1h8.1l9.6 9.6-9.1 9.1Z" fill={`url(#${uid}-body)`} stroke={`url(#${uid}-gold)`} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="7" cy="7" r="1.8" fill={`url(#${uid}-gold)`} /><circle cx="7" cy="7" r=".75" fill="#0b0907" />
      <g fill={`url(#${uid}-gold)`}>
        <path d="M10.2 15.6l5-5 .9.9-5 5z" />
        <circle cx="10.9" cy="11.2" r="1.1" /><circle cx="14.7" cy="15.1" r="1.1" />
      </g>
      {sparkle(19.4, 4.6, 2.2, '#f6d77a')}
    </>
  ),
  // A pine like a flat Christmas icon: three tiers lit on the left and shaded on the right (as the autumn leaves),
  // a gold garland with red baubles, a gold star, a brown trunk and a snow drift at its foot.
  winter: () => (
    <>
      <rect x="10.9" y="17.6" width="2.2" height="3.6" rx=".5" fill="#7a5233" />
      {/* Bottom tier widest, each tier above narrower, drawn bottom first so the upper ones overlap. */}
      {([[10.2, 7.8, 18.2], [6.4, 6.2, 13.4], [2.8, 4.4, 8.8]] as const).map(([top, half, base]) => (
        <g key={top}>
          <path d={`M12 ${top}L${12 - half} ${base}H12Z`} fill="#4e9a5b" />
          <path d={`M12 ${top}L${12 + half} ${base}H12Z`} fill="#2f7444" />
        </g>
      ))}
      <path d="M5.62 17.2Q10.54 16.7 15.45 14.2M6.96 12.6Q10.49 11.8 14.03 9.2" stroke="#f2c14e" strokeWidth=".7" strokeLinecap="round" fill="none" />
      <g fill="#e04b4b"><circle cx="10.6" cy="7.6" r=".8" /><circle cx="13.4" cy="12.2" r=".8" /><circle cx="9.2" cy="15" r=".8" /><circle cx="15.6" cy="17" r=".8" /></g>
      <path d="M12 .6l.7 1.5 1.6.2-1.2 1.1.3 1.6-1.4-.8-1.4.8.3-1.6-1.2-1.1 1.6-.2Z" fill="#f2c14e" />
      <path d="M2 23.3c2.4-2.2 5.8-3.1 10-3.1s7.6.9 10 3.1Z" fill="#e8f1f8" />
      <path d="M2 23.3c2.4-1.2 5.8-1.7 10-1.7s7.6.5 10 1.7Z" fill="#c9dcec" />
    </>
  ),
  // Fireworks: three calm bursts, each in one colour (gold, coral, blue): even rays with a dot at every tip.
  newyear: () => (
    <>
      {([[10.6, 8.4, 6.6, 12, '#d99a1e', 0.9], [18.4, 17.2, 4, 10, '#e0604f', 0.8], [5.4, 18.4, 3.4, 9, '#3a86c8', 0.75]] as const)
        .map(([cx, cy, r, rays, colour, width]) => {
          const dirs = Array.from({ length: rays }, (_, i) => [Math.cos((i / rays) * Math.PI * 2), Math.sin((i / rays) * Math.PI * 2)]);
          return (
            <g key={colour} fill={colour}>
              <path d={dirs.map(([x, y]) => `M${cx + x * r * 0.32} ${cy + y * r * 0.32}L${cx + x * r * 0.78} ${cy + y * r * 0.78}`).join('')}
                stroke={colour} strokeWidth={width} strokeLinecap="round" />
              {dirs.map(([x, y], i) => <circle key={i} cx={cx + x * r} cy={cy + y * r} r={width * 0.6} />)}
            </g>
          );
        })}
    </>
  ),
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
  const uid = useId();
  const art = EVENT_ART[eventTheme(event)];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      {typeof art === 'function' ? art(uid) : art}
    </svg>
  );
}
