// Page header backdrops: a calm, topic-specific motif behind the top of every page that fades out downwards.
// Drawn as SVG in the member's theme colours (var(--accent), var(--accent-2)), weighted to the right so the page
// title on the left stays readable. Deterministic (seeded), so a page always looks the same.
import { useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { CRYSTAL_OUTLINE } from '../../../src/shared/crystal';

gsap.registerPlugin(useGSAP);

export type Motif =
  | 'orbits' | 'chart' | 'bars' | 'shield' | 'waves' | 'confetti' | 'tickets' | 'terminal' | 'sound'
  | 'crystals' | 'grid' | 'stars' | 'numbers' | 'check' | 'chat' | 'smoke' | 'palette';

const W = 1200;
const H = 320;
const A = 'var(--accent)';
const B = 'var(--accent-2)';

/** Seeded pseudo-random numbers (mulberry32). */
function rng(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Points weighted to the right half (x 520–1200). */
const rightX = (r: () => number) => 520 + r() ** 0.7 * 680;

function motifShapes(motif: Motif): ReactNode {
  const r = rng(motif.length * 7919 + motif.charCodeAt(0));
  switch (motif) {
    case 'orbits':
      return (
        <g fill="none">
          {[0, 1, 2, 3].map((i) => (
            <ellipse key={i} cx={930} cy={150} rx={140 + i * 90} ry={38 + i * 24} transform="rotate(-12 930 150)"
              stroke={i % 2 ? B : A} strokeOpacity={0.35 - i * 0.06} strokeWidth={1.5} />
          ))}
          {[0, 1, 2, 3, 4].map((i) => <circle key={i} cx={720 + i * 110} cy={120 + (i % 2) * 70} r={3 + (i % 3)} fill={i % 2 ? B : A} fillOpacity={0.5} />)}
        </g>
      );
    case 'chart': {
      const line = (amp: number, phase: number, base: number) =>
        Array.from({ length: 25 }, (_, i) => `${i === 0 ? 'M' : 'L'}${560 + i * 27},${base - Math.sin(i / 3 + phase) * amp - i * 3}`).join('');
      return (
        <g fill="none">
          {[80, 140, 200, 260].map((y) => <line key={y} x1={560} x2={W} y1={y} y2={y} stroke="#ffffff" strokeOpacity={0.05} />)}
          <path d={`${line(28, 0.4, 250)}L1208,320L560,320Z`} fill={A} fillOpacity={0.08} stroke="none" />
          <path d={line(28, 0.4, 250)} stroke={A} strokeOpacity={0.55} strokeWidth={2} />
          <path d={line(20, 2.2, 280)} stroke={B} strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="4 6" />
        </g>
      );
    }
    case 'bars':
      return (
        <g>
          {Array.from({ length: 12 }, (_, i) => {
            const h = 50 + i * 16 + r() * 30;
            return <rect key={i} x={640 + i * 46} y={H - h} width={22} height={h} rx={8} fill={i % 3 === 2 ? B : A} fillOpacity={0.12 + i * 0.015} />;
          })}
        </g>
      );
    case 'shield': {
      const hexes: ReactNode[] = [];
      for (let row = 0; row < 6; row += 1) {
        for (let col = 0; col < 12; col += 1) {
          const cx = 560 + col * 56 + (row % 2) * 28;
          const cy = 30 + row * 48;
          const hot = r() < 0.12;
          const pts = Array.from({ length: 6 }, (_, k) => `${cx + 26 * Math.cos((Math.PI / 3) * k + Math.PI / 6)},${cy + 26 * Math.sin((Math.PI / 3) * k + Math.PI / 6)}`).join(' ');
          hexes.push(<polygon key={`${row}-${col}`} points={pts} fill={hot ? A : 'none'} fillOpacity={hot ? 0.16 : 0} stroke={hot ? A : '#ffffff'} strokeOpacity={hot ? 0.45 : 0.06} />);
        }
      }
      return <g>{hexes}</g>;
    }
    case 'waves':
      return (
        <g fill="none">
          {Array.from({ length: 7 }, (_, i) => {
            const d = Array.from({ length: 41 }, (_, k) => `${k === 0 ? 'M' : 'L'}${500 + k * 18},${90 + i * 26 + Math.sin(k / 4 + i * 0.7) * (18 + i * 2)}`).join('');
            return <path key={i} d={d} stroke={i % 2 ? B : A} strokeOpacity={0.12 + i * 0.04} strokeWidth={1.5} />;
          })}
        </g>
      );
    case 'confetti':
      return (
        <g>
          {Array.from({ length: 46 }, (_, i) => {
            const x = rightX(r);
            const y = r() * H * 0.9;
            const color = i % 3 === 0 ? B : A;
            return i % 2
              ? <rect key={i} x={x} y={y} width={10} height={4} rx={2} fill={color} fillOpacity={0.25 + r() * 0.3} transform={`rotate(${r() * 180} ${x} ${y})`} />
              : <circle key={i} cx={x} cy={y} r={2.5 + r() * 2.5} fill={color} fillOpacity={0.2 + r() * 0.3} />;
          })}
        </g>
      );
    case 'tickets':
      return (
        <g fill="none">
          {[0, 1, 2, 3].map((i) => {
            const x = 660 + i * 120;
            const y = 50 + (i % 2) * 70;
            return (
              <g key={i} transform={`rotate(${-8 + i * 6} ${x + 100} ${y + 50})`}>
                <path d={`M${x},${y} h200 v34 a16,16 0 0 0 0,32 v34 h-200 v-34 a16,16 0 0 0 0,-32 z`} fill={i % 2 ? B : A} fillOpacity={0.06} stroke={i % 2 ? B : A} strokeOpacity={0.35} />
                <line x1={x + 140} x2={x + 140} y1={y + 10} y2={y + 90} stroke="#ffffff" strokeOpacity={0.12} strokeDasharray="4 5" />
              </g>
            );
          })}
        </g>
      );
    case 'terminal':
      return (
        <g>
          {Array.from({ length: 11 }, (_, i) => {
            const indent = (i % 4) * 26;
            return (
              <g key={i}>
                <rect x={620 + indent} y={34 + i * 24} width={60 + r() * 200} height={8} rx={4} fill={i % 4 === 1 ? B : A} fillOpacity={0.14 + r() * 0.12} />
                <rect x={620 + indent + 280} y={34 + i * 24} width={30 + r() * 120} height={8} rx={4} fill="#ffffff" fillOpacity={0.05} />
              </g>
            );
          })}
        </g>
      );
    case 'sound':
      return (
        <g>
          {Array.from({ length: 34 }, (_, i) => {
            const h = 20 + Math.abs(Math.sin(i * 0.55) * 120) + r() * 30;
            return <rect key={i} x={600 + i * 17} y={160 - h / 2} width={8} height={h} rx={4} fill={i % 5 === 0 ? B : A} fillOpacity={0.14 + (h / 200) * 0.2} />;
          })}
        </g>
      );
    case 'crystals':
      return (
        <g fill="none">
          {Array.from({ length: 9 }, (_, i) => {
            const size = 40 + r() * 90;
            const x = rightX(r) - size / 2;
            const y = r() * (H - size);
            const pts = CRYSTAL_OUTLINE.map(([px, py]) => `${x + (px / 24) * size},${y + (py / 24) * size}`).join(' ');
            return <polygon key={i} points={pts} stroke={i % 3 === 0 ? B : A} strokeOpacity={0.3 + r() * 0.2} strokeWidth={1.5} fill={i % 3 === 0 ? B : A} fillOpacity={0.04} transform={`rotate(${(r() - 0.5) * 30} ${x + size / 2} ${y + size / 2})`} />;
          })}
        </g>
      );
    case 'grid':
      return (
        <g>
          {Array.from({ length: 14 * 7 }, (_, i) => {
            const cx = 560 + (i % 14) * 46;
            const cy = 26 + Math.floor(i / 14) * 44;
            return <circle key={i} cx={cx} cy={cy} r={r() < 0.1 ? 3 : 1.5} fill={r() < 0.1 ? A : '#ffffff'} fillOpacity={r() < 0.1 ? 0.5 : 0.12} />;
          })}
        </g>
      );
    case 'stars':
      return (
        <g>
          {Array.from({ length: 22 }, (_, i) => {
            const x = rightX(r);
            const y = r() * H * 0.9;
            const s = 4 + r() * 12;
            const d = `M${x},${y - s} Q${x},${y} ${x + s},${y} Q${x},${y} ${x},${y + s} Q${x},${y} ${x - s},${y} Q${x},${y} ${x},${y - s}Z`;
            return <path key={i} d={d} fill={i % 3 === 0 ? B : A} fillOpacity={0.25 + r() * 0.35} />;
          })}
        </g>
      );
    case 'numbers':
      return (
        <g fontFamily="Inter Variable, sans-serif" fontWeight={200}>
          {['1', '2', '3', '4', '5'].map((n, i) => (
            <text key={n} x={640 + i * 112} y={210 + (i % 2) * 40} fontSize={150 - i * 10} fill={i % 2 ? B : A} fillOpacity={0.09 + i * 0.015}>{n}</text>
          ))}
        </g>
      );
    case 'check':
      return (
        <g fill="none">
          {[0, 1, 2].map((i) => <circle key={i} cx={940} cy={150} r={70 + i * 52} stroke={i ? B : A} strokeOpacity={0.3 - i * 0.07} strokeWidth={1.5} />)}
          <path d="M905,152 l26,26 l52,-58" stroke={A} strokeOpacity={0.55} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case 'chat':
      return (
        <g>
          {[0, 1, 2, 3].map((i) => {
            const x = 640 + (i % 2) * 220 + i * 40;
            const y = 40 + i * 62;
            const w = 180 + (i % 3) * 60;
            return (
              <g key={i}>
                <rect x={x} y={y} width={w} height={44} rx={22} fill={i % 2 ? B : A} fillOpacity={0.08} stroke={i % 2 ? B : A} strokeOpacity={0.3} />
                <rect x={x + 22} y={y + 18} width={w * 0.55} height={8} rx={4} fill="#ffffff" fillOpacity={0.1} />
              </g>
            );
          })}
        </g>
      );
    case 'smoke':
      return (
        <g>
          {Array.from({ length: 7 }, (_, i) => (
            <ellipse key={i} cx={rightX(r)} cy={r() * H} rx={120 + r() * 160} ry={40 + r() * 60} fill={i % 2 ? B : A} fillOpacity={0.05 + r() * 0.04} />
          ))}
          {Array.from({ length: 40 }, (_, i) => <line key={`s${i}`} x1={0} x2={W} y1={i * 8} y2={i * 8} stroke="#000000" strokeOpacity={0.18} />)}
        </g>
      );
    case 'palette':
      return (
        <g>
          {[0, 1, 2, 3, 4].map((i) => (
            <circle key={i} cx={760 + i * 92} cy={150 + (i % 2 ? 36 : -24)} r={78} fill={i % 2 ? B : A} fillOpacity={0.09} stroke={i % 2 ? B : A} strokeOpacity={0.3} />
          ))}
        </g>
      );
  }
}

/** Which motif a route gets (server modules, member area, owner area, overview pages). */
export function motifFor(pathname: string): Motif {
  const seg = pathname.replace(/\/$/, '').split('/').pop() ?? '';
  const map: Record<string, Motif> = {
    insights: 'chart', general: 'grid', commands: 'terminal', automod: 'shield', moderation: 'shield', logging: 'terminal',
    welcome: 'confetti', verification: 'check', reactionroles: 'chat', tickets: 'tickets', applications: 'chat',
    leveling: 'bars', economy: 'crystals', giveaways: 'confetti', birthdays: 'stars', counting: 'numbers',
    jointocreate: 'waves', serverstats: 'chart', music: 'sound', reports: 'chat',
    me: 'crystals', shop: 'crystals', blackmarket: 'smoke', inventar: 'grid', verlauf: 'terminal', ranglisten: 'bars',
    erfolge: 'stars', design: 'palette', owner: 'grid', artikel: 'crystals', events: 'confetti', kristalle: 'crystals',
    einstellungen: 'grid', servers: 'orbits',
  };
  if (/^\d{17,20}$/.test(seg)) return 'orbits';
  return map[seg] ?? 'orbits';
}

// Fades out downwards and towards the title on the left.
const FADE = {
  maskImage: 'linear-gradient(to bottom, #000 35%, transparent), linear-gradient(to right, transparent, #000 55%)',
  maskComposite: 'intersect',
} as const;

/**
 * Absolute layer at the top of a scroll area; fades out downwards and re-appears softly on page change.
 * `art` = the page's own nav icon (24px grid paths), drawn large in the theme gradient so every page is recognisable;
 * `image` = a picture washed in as colour (the server icon); `surface` = a CSS background (the member's card background).
 */
export function PageBackdrop({ motif, art, image, surface }: { motif: Motif; art?: ReactNode; image?: string | null; surface?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    if (!ref.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(ref.current, { autoAlpha: 0, y: -10 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power2.out' });
    gsap.fromTo(ref.current.querySelectorAll('.js-art'), { rotate: -14, scale: 0.92 }, { rotate: -6, scale: 1, duration: 1.1, ease: 'power3.out' });
  }, { dependencies: [motif, art] });
  const artSvg = (className: string) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="url(#backdrop-ink)" strokeWidth={0.7} strokeLinecap="round" strokeLinejoin="round"
      className={`js-art absolute right-[5%] top-5 h-[140px] w-[140px] -rotate-6 md:h-[230px] md:w-[230px] ${className}`}>
      {art}
    </svg>
  );
  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[300px] overflow-hidden" style={FADE}>
      {surface && <div className="absolute inset-0 opacity-45" style={surface} />}
      {image && <img src={image} alt="" className="absolute -top-24 right-0 h-[440px] w-[75%] object-cover opacity-35 blur-3xl saturate-150" />}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(60% 120% at 85% 0%, var(--accent-soft), transparent 70%)' }} />
      <svg className="absolute inset-0 h-full w-full opacity-60" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMaxYMin slice">
        {motifShapes(motif)}
      </svg>
      {art && (
        <>
          <svg width="0" height="0" className="absolute">
            <defs>
              <linearGradient id="backdrop-ink" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="24">
                <stop offset="0" style={{ stopColor: 'var(--accent)' }} />
                <stop offset="1" style={{ stopColor: 'var(--accent-2)' }} />
              </linearGradient>
            </defs>
          </svg>
          {artSvg('opacity-40 blur-xl')}
          {artSvg('opacity-45')}
        </>
      )}
    </div>
  );
}
