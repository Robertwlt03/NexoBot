// Seasonal dressing for shop events: falling leaves in autumn, snow and a snowman in winter, a carved pumpkin and bats
// at Halloween … The theme comes from the calendar event's id, or for custom events from words in the name.
// All art is drawn here (no third-party assets). Reduced motion: the particles stand still.
import { useId } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { ShopEvent } from '../../../src/web/dto/profile';

export type EventTheme = 'love' | 'carnival' | 'easter' | 'summer' | 'autumn' | 'halloween' | 'sale' | 'winter' | 'newyear' | 'party';

const BY_ID: Record<string, EventTheme> = {
  valentine: 'love', carnival: 'carnival', easter: 'easter', 'summer-sale': 'summer', autumn: 'autumn',
  halloween: 'halloween', 'black-friday': 'sale', christmas: 'winter', 'new-year': 'newyear',
};
// First match wins: "Sommer-Sale" is summer, not sale.
const BY_WORD: [RegExp, EventTheme][] = [
  [/valentin|liebe|love/, 'love'], [/fasching|karneval|fastnacht|carnival/, 'carnival'], [/ostern|easter|frühling|spring/, 'easter'],
  [/halloween|grusel|spuk/, 'halloween'], [/herbst|autumn|laub/, 'autumn'], [/winter|weihnacht|xmas|christmas|advent|schnee/, 'winter'],
  [/neujahr|silvester|new.?year/, 'newyear'], [/sommer|summer|sonne/, 'summer'], [/black.?friday|cyber|sale/, 'sale'],
];

export function eventTheme(event: Pick<ShopEvent, 'id' | 'name'>): EventTheme {
  const text = `${event.id} ${event.name}`.toLowerCase();
  return BY_ID[event.id] ?? BY_WORD.find(([pattern]) => pattern.test(text))?.[1] ?? 'party';
}

type Particle = 'leaf' | 'snow' | 'flake' | 'ember' | 'bat' | 'confetti' | 'percent' | 'mote' | 'heart' | 'petal' | 'streamer';

export const EVENT_THEMES: Record<EventTheme, { tint: string; motion: 'fall' | 'rise'; particles: Particle[] }> = {
  love: { tint: '#fb7185', motion: 'fall', particles: ['heart', 'heart', 'petal'] },
  carnival: { tint: '#c084fc', motion: 'fall', particles: ['confetti', 'confetti', 'streamer'] },
  easter: { tint: '#86efac', motion: 'fall', particles: ['petal'] },
  summer: { tint: '#fbbf24', motion: 'rise', particles: ['mote'] },
  autumn: { tint: '#e0913a', motion: 'fall', particles: ['leaf'] },
  halloween: { tint: '#f97316', motion: 'rise', particles: ['ember', 'ember', 'bat'] },
  sale: { tint: '#facc15', motion: 'fall', particles: ['percent', 'confetti'] },
  winter: { tint: '#8fd3ff', motion: 'fall', particles: ['snow', 'snow', 'flake'] },
  newyear: { tint: '#facc15', motion: 'fall', particles: ['confetti'] },
  party: { tint: '#a78bfa', motion: 'fall', particles: ['confetti'] },
};

const LEAF_COLOURS = ['#e0913a', '#b5400f', '#e8b33b', '#8fb36b'];
const CONFETTI_COLOURS = ['#facc15', '#f472b6', '#60a5fa', '#ffffff', '#a78bfa'];
const PETAL_COLOURS = ['#fbcfe8', '#ffffff', '#f9a8d4', '#fde68a'];
const HEART = 'M12 21C5 16.5 2 12.6 2 8.6 2 5.5 4.4 3 7.4 3c1.9 0 3.6 1 4.6 2.6C13 4 14.7 3 16.6 3 19.6 3 22 5.5 22 8.6c0 4-3 7.9-10 12.4Z';

function ParticleArt({ kind, size, colour }: { kind: Particle; size: number; colour: number }) {
  const s = { width: size, height: size };
  switch (kind) {
    case 'leaf': return <svg viewBox="-12 -12 24 24" style={s}><path d="M0-11C7-6 7 5 0 11-7 5-7-6 0-11Z" fill={LEAF_COLOURS[colour % 4]} /><path d="M0-9V10M0-2 4-5M0 3l4-3M0-2-4-5M0 3l-4-3" stroke="#00000040" strokeWidth="1.1" strokeLinecap="round" /></svg>;
    case 'snow': return <span className="block rounded-full bg-white/85 shadow-[0_0_6px_#fff]" style={{ width: size / 3, height: size / 3 }} />;
    case 'flake': return <svg viewBox="0 0 24 24" style={s}><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity=".9" /></svg>;
    case 'ember': return <span className="block rounded-full bg-[#ffb347] shadow-[0_0_8px_#f97316]" style={{ width: size / 4, height: size / 4 }} />;
    case 'bat': return <svg viewBox="0 0 24 12" style={{ width: size * 1.4, height: size * 0.7 }}><path d="M12 3C10 1 8 1 7 2 5 0 2 0 0 3c2 0 3 1 3 3 2-1 3 0 4 2 1-2 3-2 5 1 2-3 4-3 5-1 1-2 2-3 4-2 0-2 1-3 3-3-2-3-5-3-7-1-1-1-3-1-5 1Z" fill="#14100c" /></svg>;
    case 'confetti': return <span className="block rounded-[1px]" style={{ width: size / 2.5, height: size / 5, background: CONFETTI_COLOURS[colour % 5] }} />;
    case 'percent': return <span className="block font-black leading-none text-[#facc15]" style={{ fontSize: size * 0.9 }}>%</span>;
    case 'mote': return <span className="block rounded-full bg-[#ffe9a8]/70 blur-[1px]" style={{ width: size / 3, height: size / 3 }} />;
    case 'heart': return <svg viewBox="0 0 24 24" style={{ width: size * 0.8, height: size * 0.8 }}><path d={HEART} fill={colour % 2 ? '#fb7185' : '#fda4af'} /></svg>;
    case 'petal': return <svg viewBox="-6 -10 12 20" style={{ width: size * 0.6, height: size }}><path d="M0-9C5-5 5 5 0 9-5 5-5-5 0-9Z" fill={PETAL_COLOURS[colour % 4]} opacity=".9" /></svg>;
    case 'streamer': return <svg viewBox="0 0 12 30" style={{ width: size * 0.5, height: size * 1.3 }}><path d="M6 1c5 3-5 6 0 9s-5 6 0 9 -5 6 0 9" stroke={CONFETTI_COLOURS[colour % 5]} strokeWidth="2.2" fill="none" strokeLinecap="round" /></svg>;
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

// ---------- Figures (viewBox 120×120, standing on y ≈ 108) ----------

/** Tapered firework rays around (cx, cy). */
function burst(cx: number, cy: number, r: number, rays: number, colour: string, key: string) {
  return (
    <g key={key}>
      {Array.from({ length: rays }, (_, i) => {
        const a = (i / rays) * Math.PI * 2 + 0.2;
        const [dx, dy] = [Math.cos(a), Math.sin(a)];
        const [x0, y0, x1, y1] = [cx + dx * r * 0.28, cy + dy * r * 0.28, cx + dx * r, cy + dy * r];
        return (
          <g key={i}>
            <path d={`M${x0 - dy * 1.7} ${y0 + dx * 1.7}L${x1} ${y1}L${x0 + dy * 1.7} ${y0 - dx * 1.7}Z`} fill={colour} />
            <circle cx={x1} cy={y1} r={1.6} fill="#fff" />
          </g>
        );
      })}
    </g>
  );
}

/** Four-point sparkle. */
const sparkle = (x: number, y: number, r: number, fill = '#fff') => (
  <path key={`${x}-${y}`} d={`M${x} ${y - r}Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y}Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r}Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y}Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z`} fill={fill} />
);

const MAPLE = 'M0-40 6-24l10-6-3 18 17-6-6 14 14 4-16 8 4 12-16-6-6 16-4-4-4 4-6-16-16 6 4-12-16-8 14-4-6-14 17 6-3-18 10 6Z';
const MAPLE_VEINS = 'M0 30V-34M0 18 28-14M0 18-28-14M0 22 32 2M0 22-32 2M0 26 20 16M0 26-20 16';
const EGG = 'M60 34c16 0 28 26 28 44 0 18-12 30-28 30S32 96 32 78c0-18 12-44 28-44Z';
const BIG_HEART = 'M60 104C24 82 10 60 14 42c4-18 26-24 38-12 4 4 6 8 8 12 2-4 4-8 8-12 12-12 34-6 38 12 4 18-10 40-46 62Z';
const MASK = 'M14 54c2-14 20-16 46-6 26-10 44-8 46 6 2 18-14 28-28 24-8-2-12-8-18-8s-10 6-18 8c-14 4-30-6-28-24Z';
const MASK_EYE = 'M30 58c6-8 18-6 22 2-6 6-18 6-22-2Z';
const SALE_TAG = 'M-34-18H18L36 0 18 18H-34Q-38 18-38 14V-14Q-38-18-34-18Z';

function figure(theme: EventTheme, u: (name: string) => string): ReactNode {
  const ground = <ellipse cx="60" cy="109" rx="36" ry="5" fill="#000" opacity=".35" filter={`url(#${u('blur')})`} />;
  switch (theme) {
    case 'halloween': {
      const lobe = { stroke: '#7a2c05', strokeOpacity: 0.35, strokeWidth: 1.2 };
      const face = (
        <>
          <path d="M36 66 47 52l5 17Z" /><path d="M84 66 73 52l-5 17Z" /><path d="M56 77l4-7 4 7Z" />
          <path d="M30 81q30 26 60 0l-6 3-4-5-6 7-6-5-8 7-8-7-6 5-6-7-4 5Z" />
        </>
      );
      return (
        <>
          <defs>
            <radialGradient id={u('lobe')} cx="40%" cy="28%" r="80%"><stop offset="0" stopColor="#ffc46b" /><stop offset=".45" stopColor="#f5891f" /><stop offset=".85" stopColor="#c4520c" /><stop offset="1" stopColor="#7a2c05" /></radialGradient>
            <radialGradient id={u('back')} cx="50%" cy="30%" r="80%"><stop offset="0" stopColor="#e0761a" /><stop offset="1" stopColor="#6b2604" /></radialGradient>
            <radialGradient id={u('glow')} cx="50%" cy="55%" r="60%"><stop offset="0" stopColor="#fffbe0" /><stop offset=".45" stopColor="#ffd34d" /><stop offset="1" stopColor="#ff9500" /></radialGradient>
            <linearGradient id={u('stem')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8f7a3a" /><stop offset="1" stopColor="#3f5419" /></linearGradient>
          </defs>
          {ground}
          <ellipse cx="30" cy="74" rx="22" ry="28" fill={`url(#${u('back')})`} {...lobe} />
          <ellipse cx="90" cy="74" rx="22" ry="28" fill={`url(#${u('back')})`} {...lobe} />
          <ellipse cx="44" cy="73" rx="24" ry="32" fill={`url(#${u('lobe')})`} {...lobe} />
          <ellipse cx="76" cy="73" rx="24" ry="32" fill={`url(#${u('lobe')})`} {...lobe} />
          <ellipse cx="60" cy="73" rx="20" ry="33" fill={`url(#${u('lobe')})`} {...lobe} />
          <ellipse cx="49" cy="54" rx="4" ry="10" fill="#fff" opacity=".28" transform="rotate(-18 49 54)" />
          <ellipse cx="27" cy="66" rx="2.5" ry="7" fill="#fff" opacity=".18" transform="rotate(-20 27 66)" />
          <path d="M57 44c-1-10 1-18 8-24l6 4c-6 5-8 12-7 20Z" fill={`url(#${u('stem')})`} />
          <path d="M64 30c9-4 15 0 13 6-2 4-7 2-5-2" stroke="#5c7a2a" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M66 27c8-10 22-8 24-2-8 6-18 7-24 2Z" fill="#6f9a3a" /><path d="M68 27c6-2 13-3 20-2" stroke="#46661f" strokeWidth="1" fill="none" />
          {/* Carved face: the cut wall in dark orange, the candle light inside, and its glow. */}
          <g fill="#6b2604" transform="translate(1.4 2)">{face}</g>
          <g fill={`url(#${u('glow')})`}>{face}</g>
          <g fill="#ffd34d" opacity=".55" filter={`url(#${u('soft')})`}>{face}</g>
        </>
      );
    }
    case 'winter':
      return (
        <>
          <defs>
            <radialGradient id={u('snow')} cx="35%" cy="28%" r="80%"><stop offset="0" stopColor="#fff" /><stop offset=".55" stopColor="#eef5fc" /><stop offset="1" stopColor="#b8cde3" /></radialGradient>
            <linearGradient id={u('hat')} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#14141a" /><stop offset=".35" stopColor="#3b3b46" /><stop offset="1" stopColor="#0d0d12" /></linearGradient>
            <linearGradient id={u('scarf')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ef5257" /><stop offset="1" stopColor="#9b1c22" /></linearGradient>
            <linearGradient id={u('carrot')} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#e0670f" /><stop offset="1" stopColor="#ffb35c" /></linearGradient>
          </defs>
          <ellipse cx="60" cy="106" rx="46" ry="7" fill="#dce8f5" /><ellipse cx="60" cy="105" rx="26" ry="4" fill="#9fb6cf" opacity=".6" />
          <g stroke="#5b3a1e" strokeWidth="3" strokeLinecap="round"><path d="M45 52 22 38M30 43l-4-8M27 41l-7 1M75 52l23-12M90 44l5-8" /></g>
          <circle cx="99" cy="39" r="4.5" fill={`url(#${u('scarf')})`} />
          <circle cx="60" cy="84" r="24" fill={`url(#${u('snow')})`} />
          <circle cx="60" cy="54" r="17" fill={`url(#${u('snow')})`} />
          <circle cx="60" cy="30" r="13" fill={`url(#${u('snow')})`} />
          <path d="M46 41c6 5 22 5 28 0l1 6c-7 5-23 5-30 0Z" fill={`url(#${u('scarf')})`} />
          <path d="M52 44.5l1 5M60 45.5v5M68 44.5l-1 5" stroke="#fff" strokeWidth="1.6" opacity=".75" />
          <path d="M64 47l6 19-8 1-4-18Z" fill={`url(#${u('scarf')})`} /><path d="M63 67v3M66 66.5v3M69 66v3" stroke="#9b1c22" strokeWidth="1.4" strokeLinecap="round" />
          {[[60, 56, 2.2], [60, 63, 2.2], [60, 80, 2.6], [60, 90, 2.6], [55, 27, 1.9], [65, 27, 1.9]].map(([x, y, r]) => (
            <g key={`${x}-${y}`}><circle cx={x} cy={y} r={r} fill="#1d1d22" /><circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.32} fill="#fff" opacity=".6" /></g>
          ))}
          <path d="M60 31l17 4-17 .6Z" fill={`url(#${u('carrot')})`} />
          {[[53, 36.5], [56, 38.5], [60, 39.2], [64, 38.5], [67, 36.5]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1" fill="#1d1d22" />)}
          <circle cx="51" cy="33" r="2.6" fill="#ff9aa2" opacity=".55" /><circle cx="69" cy="33" r="2.6" fill="#ff9aa2" opacity=".55" />
          <ellipse cx="60" cy="19" rx="18" ry="3.5" fill={`url(#${u('hat')})`} />
          <rect x="48" y="2" width="24" height="17" rx="2" fill={`url(#${u('hat')})`} />
          <rect x="48" y="13" width="24" height="4" fill="#c62f35" />
          <ellipse cx="72" cy="12" rx="5" ry="2.2" fill="#2f7d3a" transform="rotate(-30 72 12)" /><ellipse cx="76" cy="15" rx="5" ry="2.2" fill="#3c9a48" transform="rotate(20 76 15)" />
          <circle cx="71" cy="15" r="1.8" fill="#e5484d" /><circle cx="73.5" cy="16.5" r="1.8" fill="#e5484d" />
          {sparkle(24, 70, 4)}{sparkle(98, 78, 3)}
        </>
      );
    case 'autumn':
      return (
        <>
          <defs>
            <linearGradient id={u('red')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f6b73c" /><stop offset=".5" stopColor="#e2571c" /><stop offset="1" stopColor="#a3260f" /></linearGradient>
            <linearGradient id={u('gold')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe08a" /><stop offset="1" stopColor="#d98a1c" /></linearGradient>
            <radialGradient id={u('nut')} cx="38%" cy="35%" r="75%"><stop offset="0" stopColor="#e3a965" /><stop offset="1" stopColor="#7d4219" /></radialGradient>
            <linearGradient id={u('cap')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9a6a35" /><stop offset="1" stopColor="#4f2f12" /></linearGradient>
          </defs>
          {ground}
          <g transform="translate(86 62) rotate(32) scale(.7)">
            <path d={MAPLE} fill={`url(#${u('gold')})`} stroke={`url(#${u('gold')})`} strokeWidth="3" strokeLinejoin="round" />
            <path d={MAPLE_VEINS} stroke="#9a5a10" strokeOpacity=".45" strokeWidth="1.6" fill="none" strokeLinecap="round" /><path d="M0 30v16" stroke="#9a5a10" strokeWidth="2.4" strokeLinecap="round" />
          </g>
          <g transform="translate(54 50) rotate(-12) scale(1.12)">
            <path d={MAPLE} fill={`url(#${u('red')})`} stroke={`url(#${u('red')})`} strokeWidth="3" strokeLinejoin="round" />
            <path d={MAPLE_VEINS} stroke="#6e1a08" strokeOpacity=".45" strokeWidth="1.5" fill="none" strokeLinecap="round" /><path d="M0 30v18" stroke="#7a2a0d" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M-6-30C-14-20-18-6-14 4" stroke="#fff" strokeOpacity=".25" strokeWidth="3" fill="none" strokeLinecap="round" />
          </g>
          <path d="M40 72c0-5 2-8 5-10" stroke="#4f2f12" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M28 86c0 12 6 20 12 22 6-2 12-10 12-22Z" fill={`url(#${u('nut')})`} />
          <ellipse cx="35" cy="95" rx="2.5" ry="5.5" fill="#fff" opacity=".3" />
          <path d="M25 87c0-11 7-15 15-15s15 4 15 15c-6 2-24 2-30 0Z" fill={`url(#${u('cap')})`} />
          <path d="M30 80l4 3M36 77l4 3M42 76l4 3M48 78l4 3M30 85l4 2M37 83l4 2M44 83l4 2" stroke="#2e1a07" strokeOpacity=".5" strokeWidth="1.2" strokeLinecap="round" />
        </>
      );
    case 'newyear': {
      const flute = (side: 1 | -1) => (
        <g transform={`translate(${60 - side * 9} 108) rotate(${-side * 14})`}>
          <path d="M-9-62H9L7-26C6-18 3-15 0-15S-6-18-7-26Z" fill="#fff" opacity=".12" stroke="#fff" strokeOpacity=".7" strokeWidth="1.4" />
          <path d="M-8.3-50H8.3L7-26C6-18 3-15 0-15S-6-18-7-26Z" fill={`url(#${u('bubbly')})`} />
          {[[-3, -40, 1], [2, -33, 0.8], [-1, -26, 0.9], [3, -45, 0.7]].map(([x, y, r]) => <circle key={y} cx={x} cy={y} r={r} fill="#fff" opacity=".85" />)}
          <path d="M0-15V-2M-8 0H8" stroke="#fff" strokeOpacity=".75" strokeWidth="2" strokeLinecap="round" />
          <path d="M-6-58-5-30" stroke="#fff" strokeOpacity=".45" strokeWidth="1.4" strokeLinecap="round" />
        </g>
      );
      return (
        <>
          <defs><linearGradient id={u('bubbly')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fde68a" /><stop offset="1" stopColor="#e9a516" /></linearGradient></defs>
          <g filter={`url(#${u('soft')})`} opacity=".7">{burst(60, 32, 30, 14, '#facc15', 'g1')}{burst(22, 42, 16, 10, '#f472b6', 'g2')}{burst(98, 36, 17, 10, '#60a5fa', 'g3')}</g>
          {burst(60, 32, 30, 14, '#facc15', 'a')}{burst(22, 42, 16, 10, '#f472b6', 'b')}{burst(98, 36, 17, 10, '#60a5fa', 'c')}
          {ground}
          {flute(1)}{flute(-1)}
          {sparkle(60, 50, 6)}{sparkle(40, 66, 3, '#fde68a')}{sparkle(84, 62, 3.5, '#fde68a')}
        </>
      );
    }
    case 'sale':
      return (
        <>
          <defs>
            <linearGradient id={u('gold')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff1b0" /><stop offset=".45" stopColor="#f5c451" /><stop offset="1" stopColor="#b7811a" /></linearGradient>
            <linearGradient id={u('black')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a3a40" /><stop offset="1" stopColor="#0b0b0e" /></linearGradient>
          </defs>
          {ground}
          <path d="M84 50c8-14 14-26 24-32" stroke="#d4c39a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <g transform="translate(66 46) rotate(16)">
            <path d={SALE_TAG} fill={`url(#${u('gold')})`} />
            <circle cx="22" cy="0" r="4.5" fill="#7a5410" />
            <text x="-10" y="7" textAnchor="middle" fontSize="19" fontWeight="900" fill="#3d2a05" fontFamily="system-ui, sans-serif" letterSpacing="1">SALE</text>
          </g>
          <path d="M80 76c10-8 18-16 22-28" stroke="#d4c39a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <g transform="translate(54 78) rotate(-16)">
            <path d={SALE_TAG} fill={`url(#${u('black')})`} stroke={`url(#${u('gold')})`} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M-34-15H17L22-10H-35Z" fill="#fff" opacity=".08" />
            <circle cx="22" cy="0" r="4.5" fill="#0b0b0e" stroke={`url(#${u('gold')})`} strokeWidth="2" />
            <text x="-9" y="2" dominantBaseline="middle" textAnchor="middle" fontSize="30" fontWeight="900" fill={`url(#${u('gold')})`} fontFamily="system-ui, sans-serif">%</text>
          </g>
          {sparkle(20, 40, 6, '#fff1b0')}{sparkle(102, 92, 4, '#fff1b0')}
        </>
      );
    case 'summer':
      return (
        <>
          <defs>
            <radialGradient id={u('sun')} cx="38%" cy="32%" r="75%"><stop offset="0" stopColor="#fff6c2" /><stop offset=".5" stopColor="#ffc93c" /><stop offset="1" stopColor="#f08a0b" /></radialGradient>
            <linearGradient id={u('ray')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe17a" /><stop offset="1" stopColor="#ff9f1a" /></linearGradient>
            <linearGradient id={u('lens')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4a3f6b" /><stop offset="1" stopColor="#0c0a14" /></linearGradient>
          </defs>
          <g fill={`url(#${u('ray')})`}>
            {Array.from({ length: 16 }, (_, i) => <path key={i} d={i % 2 ? 'M60 12l4 14h-8Z' : 'M60 3l6 22H54Z'} transform={`rotate(${i * 22.5} 60 58)`} strokeLinejoin="round" />)}
          </g>
          <circle cx="60" cy="58" r="31" fill={`url(#${u('sun')})`} />
          <ellipse cx="47" cy="42" rx="9" ry="5" fill="#fff" opacity=".35" transform="rotate(-30 47 42)" />
          <path d="M33 52h22v5c0 7-4 11-11 11s-11-4-11-11Zm32 0h22v5c0 7-4 11-11 11s-11-4-11-11Z" fill={`url(#${u('lens')})`} />
          <path d="M37 55l8 9M69 55l8 9" stroke="#fff" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round" />
          <path d="M31 52h58M55 54c3-2 7-2 10 0" stroke="#111" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <circle cx="40" cy="74" r="4" fill="#ff7a59" opacity=".4" /><circle cx="80" cy="74" r="4" fill="#ff7a59" opacity=".4" />
          <path d="M48 76q12 11 24 0" stroke="#a54e07" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      );
    case 'love':
      return (
        <>
          <defs>
            <radialGradient id={u('heart')} cx="35%" cy="30%" r="80%"><stop offset="0" stopColor="#ffb3c4" /><stop offset=".5" stopColor="#f43f5e" /><stop offset="1" stopColor="#8f1032" /></radialGradient>
            <linearGradient id={u('gold')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff1b0" /><stop offset="1" stopColor="#c9921f" /></linearGradient>
          </defs>
          {ground}
          <path d="M8 98 34 80" stroke="#c9a36b" strokeWidth="3" strokeLinecap="round" />
          <path d="M8 98l-2-9 7 5ZM8 98l9 2-5-7Z" fill="#fda4af" /><path d="M14 94l-2-9 7 5ZM14 94l9 2-5-7Z" fill="#fff" />
          <path d={BIG_HEART} fill={`url(#${u('heart')})`} />
          <ellipse cx="34" cy="42" rx="7" ry="12" fill="#fff" opacity=".38" transform="rotate(-35 34 42)" /><circle cx="44" cy="32" r="2.4" fill="#fff" opacity=".7" />
          <path d="M86 46l22-14" stroke="#c9a36b" strokeWidth="3" strokeLinecap="round" />
          <path d="M112 29 100 30l5 9Z" fill={`url(#${u('gold')})`} />
          <g transform="translate(92 82) scale(.85)"><path d={HEART} fill="#fda4af" /></g>
          <g transform="translate(14 16) scale(.6)"><path d={HEART} fill="#fb7185" /></g>
          {sparkle(100, 18, 4)}{sparkle(30, 70, 3, '#ffe4ea')}
        </>
      );
    case 'carnival':
      return (
        <>
          <defs>
            <linearGradient id={u('mask')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d8b4fe" /><stop offset=".5" stopColor="#7e22ce" /><stop offset="1" stopColor="#3b0764" /></linearGradient>
            <linearGradient id={u('gold')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff1b0" /><stop offset=".5" stopColor="#f5c451" /><stop offset="1" stopColor="#a8740f" /></linearGradient>
          </defs>
          {[['#facc15', -8], ['#22d3ee', 8], ['#f472b6', 24]].map(([fill, angle]) => (
            <g key={String(fill)} transform={`rotate(${angle} 98 48)`}>
              <path d="M98 48c3-16 10-30 18-38-1 14-7 28-16 40Z" fill={String(fill)} /><path d="M99 48c3-14 8-26 15-35" stroke="#fff" strokeOpacity=".55" strokeWidth="1" fill="none" />
            </g>
          ))}
          <path d="M100 76l12 34" stroke={`url(#${u('gold')})`} strokeWidth="4" strokeLinecap="round" />
          <path d={MASK} fill={`url(#${u('mask')})`} stroke={`url(#${u('gold')})`} strokeWidth="3" strokeLinejoin="round" />
          <path d={MASK_EYE} fill="#170826" stroke={`url(#${u('gold')})`} strokeWidth="2" />
          <path d={MASK_EYE} transform="matrix(-1 0 0 1 120 0)" fill="#170826" stroke={`url(#${u('gold')})`} strokeWidth="2" />
          <path d="M26 49c6-6 14-7 20-3M94 49c-6-6-14-7-20-3" stroke={`url(#${u('gold')})`} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d="M60 50l4 5-4 5-4-5Z" fill="#22d3ee" stroke={`url(#${u('gold')})`} strokeWidth="1.4" />
          <path d="M20 52c4-8 14-9 26-5" stroke="#fff" strokeOpacity=".35" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          {[[14, 26, '#facc15', 20], [30, 96, '#22d3ee', -30], [52, 20, '#f472b6', 50], [76, 100, '#facc15', 10], [12, 84, '#f472b6', 70]].map(([x, y, fill, a]) => (
            <rect key={`${x}`} x={Number(x)} y={Number(y)} width="7" height="3.5" rx="1" fill={String(fill)} transform={`rotate(${a} ${x} ${y})`} />
          ))}
        </>
      );
    case 'easter':
      return (
        <>
          <defs>
            <radialGradient id={u('egg')} cx="38%" cy="30%" r="80%"><stop offset="0" stopColor="#fff0f8" /><stop offset=".5" stopColor="#f9a8d4" /><stop offset="1" stopColor="#b8558f" /></radialGradient>
            <radialGradient id={u('mint')} cx="38%" cy="30%" r="80%"><stop offset="0" stopColor="#ecfdf5" /><stop offset=".5" stopColor="#6ee7b7" /><stop offset="1" stopColor="#23845c" /></radialGradient>
            <linearGradient id={u('grass')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#86efac" /><stop offset="1" stopColor="#15803d" /></linearGradient>
            <clipPath id={u('clip')}><path d={EGG} /></clipPath>
          </defs>
          {ground}
          {/* A bunny hides behind the egg: only its ears show. */}
          <g transform="rotate(-10 48 50)"><path d="M44 50c-8-24-6-44 2-46 8 2 8 24 6 46Z" fill="#f5f0ea" /><path d="M46 46c-5-18-4-34 0-36 4 2 4 20 3 36Z" fill="#f9b8c8" /></g>
          <g transform="rotate(12 72 50)"><path d="M68 50c-8-24-6-44 2-46 8 2 8 24 6 46Z" fill="#ebe4dc" /><path d="M70 46c-5-18-4-34 0-36 4 2 4 20 3 36Z" fill="#f4a9bb" /></g>
          <path d={EGG} fill={`url(#${u('egg')})`} />
          <g clipPath={`url(#${u('clip')})`}>
            <path d="M28 52q8-6 16 0t16 0 16 0 16 0v5q-8-6-16 0t-16 0-16 0-16 0Z" fill="#fde68a" />
            <path d="M28 70l6 6 6-6 6 6 6-6 6 6 6-6 6 6 6-6 6 6 6-6v8l-6 6-6-6-6 6-6-6-6 6-6-6-6 6-6-6-6 6-6-6Z" fill="#7dd3fc" />
            {[40, 50, 60, 70, 80].map((x) => <circle key={x} cx={x} cy="94" r="2.6" fill="#a7f3d0" />)}
            <path d="M28 34h64v108H28Z" fill={`url(#${u('egg')})`} opacity=".25" />
          </g>
          <ellipse cx="49" cy="52" rx="5" ry="10" fill="#fff" opacity=".45" transform="rotate(-20 49 52)" />
          <g transform="translate(90 98) rotate(18) scale(.5) translate(-60 -72)">
            <path d={EGG} fill={`url(#${u('mint')})`} />
            <path d="M33 70h54v8H33Z" fill="#fde68a" clipPath={`url(#${u('clip')})`} />
            <ellipse cx="49" cy="52" rx="5" ry="10" fill="#fff" opacity=".45" transform="rotate(-20 49 52)" />
          </g>
          <path d="M14 112l4-16 4 12 5-18 4 18 5-14 3 14 5-12 4 12 4-16 4 16h28l4-14 4 14 5-18 4 18 5-14 3 14H14Z" fill={`url(#${u('grass')})`} />
          {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="22" cy="95" rx="2" ry="4" fill="#fff" transform={`rotate(${a} 22 99)`} />)}
          <circle cx="22" cy="99" r="2.2" fill="#facc15" />
        </>
      );
    case 'party':
      return (
        <>
          <defs>
            <linearGradient id={u('box')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a78bfa" /><stop offset="1" stopColor="#5b21b6" /></linearGradient>
            <linearGradient id={u('lid')} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#c4b5fd" /><stop offset="1" stopColor="#7c3aed" /></linearGradient>
            <linearGradient id={u('gold')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff1b0" /><stop offset=".5" stopColor="#f5c451" /><stop offset="1" stopColor="#b7811a" /></linearGradient>
          </defs>
          {ground}
          <path d="M86 58l12-8v46l-12 8Z" fill="#3b1585" />
          <rect x="26" y="58" width="60" height="46" fill={`url(#${u('box')})`} />
          <path d="M86 76l12-8v6l-12 8Z" fill="#a8740f" /><rect x="26" y="76" width="60" height="6" fill={`url(#${u('gold')})`} />
          <rect x="51" y="58" width="10" height="46" fill={`url(#${u('gold')})`} />
          <path d="M22 46l12-8h68l-12 8Z" fill="#ddd6fe" /><path d="M90 46l12-8v14l-12 8Z" fill="#4c1d95" />
          <rect x="22" y="46" width="68" height="14" fill={`url(#${u('lid')})`} />
          <rect x="51" y="46" width="10" height="14" fill={`url(#${u('gold')})`} /><path d="M51 46h10l12-8H63Z" fill="#fde68a" />
          <path d="M60 38c-14-16-28-8-18 0 4 3 12 2 18 0Zm0 0c14-16 28-8 18 0-4 3-12 2-18 0Z" fill={`url(#${u('gold')})`} stroke="#a8740f" strokeWidth="1.2" />
          <ellipse cx="60" cy="38" rx="5" ry="4" fill="#f5c451" stroke="#a8740f" strokeWidth="1.2" />
          <rect x="30" y="62" width="4" height="36" fill="#fff" opacity=".18" />
          {sparkle(18, 28, 6)}{sparkle(104, 22, 4.5, '#fde68a')}{sparkle(108, 70, 3)}
        </>
      );
  }
}

/** The event's figure: carved pumpkin, snowman, maple leaves, champagne and fireworks, sale tags, sun with shades … */
export function EventMascot({ theme, className = '' }: { theme: EventTheme; className?: string }) {
  const id = useId().replace(/:/g, '');
  const u = (name: string) => `${id}-${name}`;
  return (
    <svg viewBox="0 0 120 120" className={className} style={{ filter: `drop-shadow(0 8px 12px rgba(0,0,0,.45)) drop-shadow(0 0 20px color-mix(in srgb, ${EVENT_THEMES[theme].tint} 40%, transparent))` }} aria-hidden="true">
      <defs>
        <filter id={u('blur')} x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="2.5" /></filter>
        <filter id={u('soft')} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      {figure(theme, u)}
    </svg>
  );
}
