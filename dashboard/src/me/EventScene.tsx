// Seasonal dressing for shop events: falling leaves in autumn, snow and a snowman in winter, a carved pumpkin and bats
// at Halloween … The theme comes from the calendar event's id, or for custom events from words in the name.
// All art is drawn here (no third-party assets). Reduced motion: the particles stand still.
import { useId } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { ShopEvent } from '../../../src/web/dto/profile';

export type EventTheme = 'autumn' | 'halloween' | 'winter' | 'newyear' | 'summer' | 'sale' | 'party';

const BY_ID: Record<string, EventTheme> = { halloween: 'halloween', christmas: 'winter', 'new-year': 'newyear', 'black-friday': 'sale', 'summer-sale': 'summer' };
// First match wins: "Sommer-Sale" is summer, not sale.
const BY_WORD: [RegExp, EventTheme][] = [
  [/halloween|grusel|spuk/, 'halloween'], [/herbst|autumn|laub/, 'autumn'], [/winter|weihnacht|xmas|christmas|advent|schnee/, 'winter'],
  [/neujahr|silvester|new.?year/, 'newyear'], [/sommer|summer|sonne/, 'summer'], [/black.?friday|cyber|sale/, 'sale'],
];

export function eventTheme(event: Pick<ShopEvent, 'id' | 'name'>): EventTheme {
  const text = `${event.id} ${event.name}`.toLowerCase();
  return BY_ID[event.id] ?? BY_WORD.find(([pattern]) => pattern.test(text))?.[1] ?? 'party';
}

type Particle = 'leaf' | 'snow' | 'flake' | 'ember' | 'bat' | 'confetti' | 'percent' | 'mote';

export const EVENT_THEMES: Record<EventTheme, { tint: string; motion: 'fall' | 'rise'; particles: Particle[] }> = {
  autumn: { tint: '#e0913a', motion: 'fall', particles: ['leaf'] },
  halloween: { tint: '#f97316', motion: 'rise', particles: ['ember', 'ember', 'bat'] },
  winter: { tint: '#8fd3ff', motion: 'fall', particles: ['snow', 'snow', 'flake'] },
  newyear: { tint: '#facc15', motion: 'fall', particles: ['confetti'] },
  summer: { tint: '#fbbf24', motion: 'rise', particles: ['mote'] },
  sale: { tint: '#facc15', motion: 'fall', particles: ['percent', 'confetti'] },
  party: { tint: '#a78bfa', motion: 'fall', particles: ['confetti'] },
};

const LEAF_COLOURS = ['#e0913a', '#b5400f', '#e8b33b', '#8fb36b'];
const CONFETTI_COLOURS = ['#facc15', '#f472b6', '#60a5fa', '#ffffff', '#a78bfa'];

function ParticleArt({ kind, size, colour }: { kind: Particle; size: number; colour: number }) {
  const s = { width: size, height: size };
  switch (kind) {
    case 'leaf': return <svg viewBox="-12 -12 24 24" style={s}><path d="M0-11C7-6 7 5 0 11-7 5-7-6 0-11Z" fill={LEAF_COLOURS[colour % 4]} /><path d="M0-9V10" stroke="#00000040" strokeWidth="1.2" /></svg>;
    case 'snow': return <span className="block rounded-full bg-white/85 shadow-[0_0_6px_#fff]" style={{ width: size / 3, height: size / 3 }} />;
    case 'flake': return <svg viewBox="0 0 24 24" style={s}><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity=".9" /></svg>;
    case 'ember': return <span className="block rounded-full bg-[#ffb347] shadow-[0_0_8px_#f97316]" style={{ width: size / 4, height: size / 4 }} />;
    case 'bat': return <svg viewBox="0 0 24 12" style={{ width: size * 1.4, height: size * 0.7 }}><path d="M12 3C10 1 8 1 7 2 5 0 2 0 0 3c2 0 3 1 3 3 2-1 3 0 4 2 1-2 3-2 5 1 2-3 4-3 5-1 1-2 2-3 4-2 0-2 1-3 3-3-2-3-5-3-7-1-1-1-3-1-5 1Z" fill="#14100c" /></svg>;
    case 'confetti': return <span className="block rounded-[1px]" style={{ width: size / 2.5, height: size / 5, background: CONFETTI_COLOURS[colour % 5] }} />;
    case 'percent': return <span className="block font-black leading-none text-[#facc15]" style={{ fontSize: size * 0.9 }}>%</span>;
    case 'mote': return <span className="block rounded-full bg-[#ffe9a8]/70 blur-[1px]" style={{ width: size / 3, height: size / 3 }} />;
  }
}

/** Stable pseudo-random 0–1 per particle, so the scene does not jump on re-render. */
const rand = (i: number, k: number) => {
  const x = Math.sin(i * 97.13 + k * 13.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Particles drifting over a container (position it relative, overflow hidden). */
export function EventParticles({ theme, count = 22 }: { theme: EventTheme; count?: number }) {
  const { motion, particles } = EVENT_THEMES[theme];
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const duration = 9 + rand(i, 1) * 9;
        return (
          <span key={i} className={`event-particle event-${motion}`}
            style={{ left: `${rand(i, 0) * 100}%`, '--dur': `${duration}s`, '--delay': `-${rand(i, 2) * duration}s`, '--y': `${rand(i, 3) * 90}%` } as CSSProperties}>
            <span className="event-sway" style={{ '--sway': `${8 + rand(i, 4) * 18}px`, '--spin': `${20 + rand(i, 5) * 60}deg`, opacity: 0.55 + rand(i, 6) * 0.45 } as CSSProperties}>
              <ParticleArt kind={particles[i % particles.length]} size={10 + rand(i, 7) * 12} colour={i} />
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** The event's figure: carved pumpkin, snowman, autumn leaves, firework, sale tag, sun with shades, gift. */
export function EventMascot({ theme, className = '' }: { theme: EventTheme; className?: string }) {
  const id = useId().replace(/:/g, '');
  const art: Record<EventTheme, ReactNode> = {
    halloween: (
      <>
        <defs>
          <radialGradient id={`${id}p`} cx="42%" cy="38%" r="70%"><stop offset="0" stopColor="#ffb347" /><stop offset=".6" stopColor="#ef7a17" /><stop offset="1" stopColor="#9c420a" /></radialGradient>
          <radialGradient id={`${id}g`}><stop offset="0" stopColor="#fff6b0" /><stop offset="1" stopColor="#ffae00" /></radialGradient>
        </defs>
        <path d="M50 30C48 20 50 12 57 8" stroke="#4d6b2a" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M56 11c9-4 16 1 15 8-7-1-12-3-15-8Z" fill="#6f9a3a" />
        <ellipse cx="50" cy="62" rx="45" ry="33" fill={`url(#${id}p)`} />
        <path d="M50 30c-12 12-12 52 0 64m0-64c12 12 12 52 0 64M50 30C26 34 16 84 42 94M50 30c24 4 34 54 8 64" stroke="#a8480b" strokeWidth="2" fill="none" opacity=".6" />
        <g fill={`url(#${id}g)`}>
          <path d="M27 56l10-14 7 15Z" /><path d="M73 56l-10-14-7 15Z" /><path d="M46 64l4-6 4 6Z" />
          <path d="M23 68l6 5 5-5 6 6 5-6 5 6 5-6 6 6 5-6 5 5 6-5c-7 19-47 19-54 0Z" />
        </g>
      </>
    ),
    winter: (
      <>
        <defs><radialGradient id={`${id}s`} cx="38%" cy="35%" r="75%"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#c6dcf0" /></radialGradient></defs>
        <path d="M36 52 18 40m6 4-6-1m2 6-3 1M64 52l18-12m-6 4 6-1m-2 6 3 1" stroke="#6b4423" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="50" cy="80" r="19" fill={`url(#${id}s)`} /><circle cx="50" cy="53" r="14" fill={`url(#${id}s)`} /><circle cx="50" cy="30" r="11" fill={`url(#${id}s)`} />
        <path d="M38 40c6 4 18 4 24 0v5c-6 4-18 4-24 0Z" fill="#c0392b" /><path d="M55 44l4 13h-6l-2-12Z" fill="#a83226" />
        <rect x="32" y="18" width="36" height="4" rx="2" fill="#1f1b18" /><rect x="38" y="3" width="24" height="16" rx="2" fill="#1f1b18" /><rect x="38" y="14" width="24" height="3" fill="#c0392b" />
        <circle cx="46" cy="28" r="1.7" fill="#1f1b18" /><circle cx="54" cy="28" r="1.7" fill="#1f1b18" /><path d="M50 31l12 3H50Z" fill="#f28c28" />
        <circle cx="50" cy="52" r="1.6" fill="#1f1b18" /><circle cx="50" cy="58" r="1.6" fill="#1f1b18" /><circle cx="50" cy="75" r="1.8" fill="#1f1b18" />
      </>
    ),
    autumn: (
      <>
        {[['#b5400f', -38, 40, 46], ['#e8b33b', 30, 60, 44], ['#e0913a', -4, 50, 36]].map(([fill, angle, x, y]) => (
          <g key={String(fill)} transform={`translate(${x} ${y}) rotate(${angle})`}>
            <path d="M0-34C20-20 20 16 0 34-20 16-20-20 0-34Z" fill={String(fill)} /><path d="M0-30V40M0-8 10-16M0 6 11-2M0-8-10-16M0 6-11-2" stroke="#00000035" strokeWidth="2" strokeLinecap="round" />
          </g>
        ))}
        <ellipse cx="62" cy="80" rx="11" ry="13" fill="#a0612b" /><path d="M49 72c0-8 26-8 26 0-4 4-22 4-26 0Z" fill="#6b3d17" /><path d="M62 64v-5" stroke="#6b3d17" strokeWidth="3" strokeLinecap="round" />
      </>
    ),
    newyear: (
      <>
        {[[50, 42, '#facc15', 30], [26, 70, '#f472b6', 18], [76, 72, '#60a5fa', 18]].map(([cx, cy, colour, r]) => (
          <g key={String(colour)} stroke={String(colour)} strokeWidth="3" strokeLinecap="round">
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2;
              const [x, y, rr] = [Number(cx), Number(cy), Number(r)];
              return <path key={i} d={`M${x + Math.cos(a) * rr * 0.35} ${y + Math.sin(a) * rr * 0.35}L${x + Math.cos(a) * rr} ${y + Math.sin(a) * rr}`} />;
            })}
          </g>
        ))}
        <circle cx="50" cy="42" r="4" fill="#fff" />
      </>
    ),
    sale: (
      <g transform="rotate(-18 50 50)">
        <path d="M14 30h48l24 20-24 20H14Z" fill="#111" stroke="#facc15" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="68" cy="50" r="4" fill="#facc15" />
        <text x="37" y="61" textAnchor="middle" fontSize="30" fontWeight="900" fill="#facc15" fontFamily="system-ui, sans-serif">%</text>
      </g>
    ),
    summer: (
      <>
        <defs><radialGradient id={`${id}u`} cx="40%" cy="38%" r="70%"><stop offset="0" stopColor="#fff1a8" /><stop offset=".55" stopColor="#fbbf24" /><stop offset="1" stopColor="#ea8a0c" /></radialGradient></defs>
        <g fill="#fbbf24">{Array.from({ length: 12 }, (_, i) => <path key={i} d="M50 2l5 14h-10Z" transform={`rotate(${i * 30} 50 50)`} />)}</g>
        <circle cx="50" cy="50" r="28" fill={`url(#${id}u)`} />
        <path d="M30 44h16v6c0 5-3 8-8 8s-8-3-8-8Zm24 0h16v6c0 5-3 8-8 8s-8-3-8-8Zm-8 2h8" fill="#1a1a1a" stroke="#1a1a1a" strokeWidth="2" strokeLinejoin="round" />
        <path d="M40 65c6 5 14 5 20 0" stroke="#9a4a07" strokeWidth="3" fill="none" strokeLinecap="round" />
      </>
    ),
    party: (
      <>
        <rect x="18" y="44" width="64" height="44" rx="5" fill="#7c5cd6" /><rect x="13" y="32" width="74" height="16" rx="4" fill="#a78bfa" />
        <rect x="45" y="32" width="10" height="56" fill="#facc15" />
        <path d="M50 32C40 14 24 20 32 30c4 3 12 2 18 2Zm0 0c10-18 26-12 18-2-4 3-12 2-18 2Z" fill="none" stroke="#facc15" strokeWidth="5" strokeLinejoin="round" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 100 100" className={className} style={{ filter: `drop-shadow(0 10px 14px rgba(0,0,0,.5)) drop-shadow(0 0 22px color-mix(in srgb, ${EVENT_THEMES[theme].tint} 45%, transparent))` }} aria-hidden="true">
      {art[theme]}
    </svg>
  );
}
