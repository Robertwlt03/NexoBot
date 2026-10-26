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

/** A firework burst: rays fading in from the centre, a bright dot at each tip and a warm spark in the middle. */
function burst(uid: string, key: string, cx: number, cy: number, r: number, [inner, outer]: [string, string], rays: number, width: number) {
  const id = `${uid}-${key}`;
  const dirs = Array.from({ length: rays }, (_, i) => {
    const a = (i / rays) * Math.PI * 2 + 0.13;
    return [Math.cos(a), Math.sin(a)];
  });
  return (
    <g key={key}>
      <radialGradient id={id} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={r}>
        <stop offset=".25" stopColor={inner} stopOpacity="0" /><stop offset=".65" stopColor={inner} /><stop offset="1" stopColor={outer} />
      </radialGradient>
      <path d={dirs.map(([x, y]) => `M${cx + x * r * 0.28} ${cy + y * r * 0.28}L${cx + x * r * 0.86} ${cy + y * r * 0.86}`).join('')}
        stroke={`url(#${id})`} strokeWidth={width} strokeLinecap="round" />
      {dirs.map(([x, y], i) => <circle key={i} cx={cx + x * r} cy={cy + y * r} r={width * 0.8} fill={outer} />)}
      <circle cx={cx} cy={cy} r={width * 1.2} fill="#fff4d2" />
    </g>
  );
}

/** Snow lying along the lower edge of a pine tier: a band from xl to xr at y with soft scallops on top. */
function snowBand(xl: number, xr: number, y: number) {
  const n = Math.max(3, Math.round((xr - xl) / 1.7));
  const step = (xr - xl) / n;
  let d = `M${xl - 0.3} ${y + 0.25}`;
  for (let i = 0; i < n; i += 1) d += `q${step / 2} -${1.5 + (i % 2) * 0.35} ${step} 0`;
  return `${d}l.3 .35H${xl}Z`;
}

/** One small picture per event theme on a 24×24 grid; a function gets a unique id for its gradients and clip paths. */
const EVENT_ART: Record<EventTheme, ReactNode | ((uid: string) => ReactNode)> = {
  // Two hearts, the lighter one behind.
  love: <><path d={HEART} fill="#f27b93" transform="translate(8.6 1.2) scale(.62)" /><path d={HEART} fill="#e5536f" transform="translate(.6 5.2) scale(.72)" /></>,
  // The carnival mask in violet with a gold rim, gold-ringed eyes, a jewel and a magenta-violet feather.
  carnival: (uid) => (
    <g transform="rotate(-6 12 12) translate(1.6 2.4) scale(.18) translate(-4 -8)">
      <defs>
        <linearGradient id={`${uid}-mask`} gradientUnits="userSpaceOnUse" x1="14" y1="40" x2="106" y2="80">
          <stop offset="0" stopColor="#9d52e3" /><stop offset="1" stopColor="#57199a" />
        </linearGradient>
        <linearGradient id={`${uid}-gold`} gradientUnits="userSpaceOnUse" x1="10" y1="36" x2="110" y2="96">
          <stop offset="0" stopColor="#fbe39a" /><stop offset=".5" stopColor="#d79b2c" /><stop offset="1" stopColor="#f3cf6a" />
        </linearGradient>
        <linearGradient id={`${uid}-plume`} gradientUnits="userSpaceOnUse" x1="8" y1="8" x2="30" y2="48">
          <stop offset="0" stopColor="#f27bb8" /><stop offset="1" stopColor="#8a3bd0" />
        </linearGradient>
      </defs>
      <path d="M34 44C26 30 25 16 34 6c5 12 5 26 0 38Z" fill="#c25bc6" />
      <path d="M28 46C12 40 3 24 8 8c11 8 23 22 20 38Z" fill={`url(#${uid}-plume)`} />
      <path d="M27 45L10 11" stroke={`url(#${uid}-gold)`} strokeWidth="2.4" strokeLinecap="round" />
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
  // A snowy pine on a snow drift: three tiers with snow along each edge, a gold star on top, flakes around it.
  winter: (uid) => (
    <>
      <defs>
        <linearGradient id={`${uid}-pine`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4f9a5c" /><stop offset="1" stopColor="#2c6440" />
        </linearGradient>
        <linearGradient id={`${uid}-snow`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#cfe1f0" />
        </linearGradient>
      </defs>
      <g fill="#d3e5f4">{[[3, 5.4, 0.75], [20.6, 7.2, 0.7], [2.4, 12.4, 0.6], [21.4, 13.6, 0.65], [18.2, 2.8, 0.55], [5.6, 2.6, 0.5]].map(([x, y, r]) => <circle key={`${x}`} cx={x} cy={y} r={r} />)}</g>
      <rect x="10.9" y="17.6" width="2.2" height="3.4" rx=".5" fill="#6b4a33" />
      <path d="M12 9.6L19.4 18.2H4.6Z" fill={`url(#${uid}-pine)`} /><path d={snowBand(4.6, 19.4, 18.2)} fill={`url(#${uid}-snow)`} />
      <path d="M12 6l5.8 7H6.2Z" fill={`url(#${uid}-pine)`} /><path d={snowBand(6.2, 17.8, 13)} fill={`url(#${uid}-snow)`} />
      <path d="M12 2.8l4.2 5.4H7.8Z" fill={`url(#${uid}-pine)`} /><path d={snowBand(7.8, 16.2, 8.2)} fill={`url(#${uid}-snow)`} />
      <path d="M1.2 23.2c2.6-2.6 6.2-3.5 10.8-3.5s8.2.9 10.8 3.5Z" fill={`url(#${uid}-snow)`} />
      <path d="M12 .6l.7 1.5 1.6.2-1.2 1.1.3 1.6-1.4-.8-1.4.8.3-1.6-1.2-1.1 1.6-.2Z" fill="#f2c14e" />
    </>
  ),
  // Fireworks: a big gold burst, a pink and a blue one, rays fading in from the centre, and a few twinkles.
  newyear: (uid) => (
    <>
      {burst(uid, 'gold', 10.6, 9.6, 8.2, ['#ffe08a', '#d99a16'], 16, 0.8)}
      {burst(uid, 'pink', 18.6, 16.6, 4.7, ['#ffb7c8', '#e0406a'], 12, 0.7)}
      {burst(uid, 'blue', 5.2, 18.8, 3.7, ['#acdcff', '#2f86cf'], 10, 0.65)}
      {sparkle(20.4, 4.2, 1.6, '#f2c14e')}{sparkle(2.6, 6.4, 1.2, '#f27b93')}{sparkle(12.4, 21.4, 1.1, '#7cc4f2')}
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
