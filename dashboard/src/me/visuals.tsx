// Small CSS/SVG previews of cosmetic items (shop tiles, slot editor), the badge glyphs and member-area icons.
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { CURRENCY, RARITY_LABELS, SLOT_LABELS } from '../../../src/shared/cosmetics';
import { CrystalIcon } from '../components/CrystalIcon';
import type {
  BackgroundData, BadgeGlyph, CosmeticItem, EffectData, FontData, FrameData, LevelupData, NameStyleData, Rarity, XpBarData,
} from '../../../src/shared/cosmetics';
import { num } from './api';

// ---------- Glyphs (24px line icons; the badge glyphs double as member-area icons) ----------

const GLYPHS = {
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  crown: <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />,
  flame: <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.4 1.2-3.8 2.5-5 .3 1.8 1 2.8 2 3.2C11 9 11 6 12 3z" />,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  heart: <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />,
  diamond: <><path d="M3 9l3-5h12l3 5-9 11z" /><path d="M3 9h18M9.5 4L12 9l2.5-5M12 9v11" /></>,
  shield: <path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z" />,
  leaf: <><path d="M5 19C5 10 10 5 20 4c0 10-5 15-14 15z" /><path d="M5 19l8-8" /></>,
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  snowflake: <><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" /><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5" /></>,
  skull: <><path d="M12 3a8 8 0 0 0-8 8c0 2.6 1.3 4.4 3 5.5V20h10v-3.5c1.7-1.1 3-2.9 3-5.5a8 8 0 0 0-8-8z" /><circle cx="9" cy="11.5" r="1.6" /><circle cx="15" cy="11.5" r="1.6" /><path d="M10.5 20v-2M13.5 20v-2" /></>,
  music: <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
  controller: <><path d="M7 8h10a4 4 0 0 1 4 4l.5 4a2.5 2.5 0 0 1-4.4 1.8L15 16H9l-2.1 1.8A2.5 2.5 0 0 1 2.5 16L3 12a4 4 0 0 1 4-4z" /><path d="M7.5 11v3M6 12.5h3M15.5 12h.01M17.5 13.5h.01" /></>,
  fish: <><path d="M2 7l3 5-3 5" /><path d="M5 12c2.5-3.5 6-5 9.5-5 3 0 5.5 2 6.5 5-1 3-3.5 5-6.5 5-3.5 0-7-1.5-9.5-5z" /><path d="M16.5 11h.01" /></>,
  pickaxe: <><path d="M5 8a14 14 0 0 1 11-4.5M16 3.5A14 14 0 0 1 20.5 14" /><path d="M15 9L4 20" /></>,
  dice: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9 9h.01M12 12h.01M15 15h.01" strokeWidth={3} /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M9.5 17h5" /></>,
  rocket: <><path d="M12 2.5c3.5 2.5 5 6 4.5 10.5L14 16h-4l-2.5-3C7 8.5 8.5 5 12 2.5z" /><path d="M10 16l-1 4 3-2 3 2-1-4M7.5 13L5 15l1 3M16.5 13L19 15l-1 3" /><circle cx="12" cy="9" r="1.5" /></>,
  ghost: <><path d="M5 20V10a7 7 0 0 1 14 0v10l-2.3-1.6L14.3 20 12 18.4 9.7 20l-2.4-1.6z" /><path d="M9.5 10h.01M14.5 10h.01" strokeWidth={3} /></>,
  pumpkin: <><path d="M12 7c-5 0-8 3-8 7s3 6 8 6 8-2 8-6-3-7-8-7z" /><path d="M12 7c-2 2-2.5 9 0 13M12 7c2 2 2.5 9 0 13M12 7c0-2 1-3 2.5-4" /></>,
  gift: <><rect x="3" y="8" width="18" height="5" rx="1" /><path d="M5 13v8h14v-8M12 8v13" /><path d="M12 8C10.5 4 6.5 4 7 6.5S12 8 12 8zM12 8c1.5-4 5.5-4 5-1.5S12 8 12 8z" /></>,
  paw: <><circle cx="6.5" cy="10" r="1.8" /><circle cx="10" cy="6" r="1.8" /><circle cx="14" cy="6" r="1.8" /><circle cx="17.5" cy="10" r="1.8" /><path d="M12 12c-3 0-5.5 3.5-5.5 5.5 0 1.5 1.5 2 3 1.5s3.5-.5 5 0 3 0 3-1.5C17.5 15.5 15 12 12 12z" /></>,
  code: <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />,
  // Member-area navigation (not badge glyphs).
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6" /></>,
  bag: <><path d="M5 8h14l-1 13H6z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  incognito: <><path d="M3 11h18M5.5 11l1.8-6h9.4l1.8 6" /><circle cx="7.5" cy="16" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /><path d="M10 16h4" /></>,
  box: <><path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z" /><path d="M3 7.5l9 4.5 9-4.5M12 12v9" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  medal: <><circle cx="12" cy="9" r="6" /><path d="M8.5 14L7 22l5-3 5 3-1.5-8" /></>,
  tag: <><path d="M3 12V4h8l10 10-8 8z" /><path d="M7.5 7.5h.01" strokeWidth={3} /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  chart: <><path d="M3 3v18h18" /><path d="M7 15l4-5 3 3 5-7" /></>,
  palette: <><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.9-.7-1.4-.7-2.3 0-1 .8-1.6 1.8-1.6H17a4 4 0 0 0 4-4C21 6.7 17 3 12 3z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7" r="1" /><circle cx="14.5" cy="7" r="1" /></>,
  sliders: <><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>,
  shuffle: <path d="M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4M18 4l3 3-3 3M18 14l3 3-3 3" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
} satisfies Record<BadgeGlyph, ReactElement> & Record<string, ReactElement>;

export type GlyphName = keyof typeof GLYPHS;

export function Glyph({ name, size = 20, className }: { name: GlyphName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {GLYPHS[name]}
    </svg>
  );
}

// ---------- Rarity & price ----------

/** Subtle per-rarity tint (border + label); kept out of the accent so the lavender stays for actions. */
export const RARITY_CLASS: Record<Rarity, { border: string; text: string }> = {
  common: { border: 'border-white/[.07]', text: 'text-mute' },
  rare: { border: 'border-sky-400/25', text: 'text-sky-300/90' },
  epic: { border: 'border-violet-400/30', text: 'text-violet-300' },
  legendary: { border: 'border-amber-300/30', text: 'text-amber-200/90' },
  mythic: { border: 'border-rose-500/25', text: 'text-rose-300' },
};

export function RarityLabel({ rarity }: { rarity: Rarity }) {
  return <span className={`text-[12px] font-medium ${RARITY_CLASS[rarity].text}`}>{RARITY_LABELS[rarity]}</span>;
}

/** `large` shows the full Nexo crystal (visor, eyes, moon) for big hero numbers. */
export function Kristalle({ amount, className = '', large = false }: { amount: number; className?: string; large?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-[0.3em] whitespace-nowrap tabular-nums ${className}`}>
      <CrystalIcon className={large ? 'h-[1.15em] w-[1.15em]' : 'h-[1.05em] w-[1.05em]'} detail={large ? 'full' : 'small'} title={CURRENCY.name} />{num(amount)}
    </span>
  );
}

/** Price with the base price struck through while an event discount applies. */
export function Price({ price, finalPrice, className = '' }: { price: number; finalPrice: number; className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-2 ${className}`}>
      <Kristalle amount={finalPrice} className="font-medium text-ink" />
      {finalPrice < price && <s className="text-[12px] text-faint">{num(price)}</s>}
    </span>
  );
}

export const slotLabel = (item: CosmeticItem) => SLOT_LABELS[item.slot];

// ---------- Item previews ----------

const withAlpha = (hex: string, alpha: string) => (/^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${alpha}` : hex);

export function backgroundStyle(data: BackgroundData): CSSProperties {
  const [a = '#15151b', b = a, c = b, d = c] = data.colors;
  switch (data.kind) {
    case 'solid': return { background: a };
    case 'gradient': return { background: `linear-gradient(${data.angle}deg, ${data.colors.join(', ')})` };
    case 'aurora': return { background: `radial-gradient(60% 80% at 20% 20%, ${withAlpha(b, 'aa')}, transparent 70%), radial-gradient(70% 70% at 85% 70%, ${withAlpha(c, '99')}, transparent 70%), ${a}` };
    case 'mesh': return { background: `radial-gradient(at 0% 0%, ${a}, transparent 60%), radial-gradient(at 100% 0%, ${b}, transparent 60%), radial-gradient(at 0% 100%, ${c}, transparent 60%), radial-gradient(at 100% 100%, ${d}, transparent 60%), #1a1a22` };
    case 'pattern': {
      const ink = withAlpha(b, '55');
      const patterns: Record<BackgroundData['pattern'], string> = {
        none: 'none',
        dots: `radial-gradient(${ink} 1px, transparent 1.6px) 0 0 / 12px 12px`,
        grid: `linear-gradient(${ink} 1px, transparent 1px) 0 0 / 14px 14px, linear-gradient(90deg, ${ink} 1px, transparent 1px) 0 0 / 14px 14px`,
        diagonal: `repeating-linear-gradient(45deg, ${ink} 0 1px, transparent 1px 10px)`,
        waves: `repeating-radial-gradient(circle at 0 100%, transparent 0 9px, ${ink} 10px 11px)`,
        stars: `radial-gradient(${b} .8px, transparent 1.4px) 0 0 / 23px 23px, radial-gradient(${ink} .8px, transparent 1.4px) 11px 7px / 31px 31px`,
        hex: `radial-gradient(circle, transparent 5px, ${ink} 6px, transparent 7px) 0 0 / 16px 14px`,
        circuit: `linear-gradient(${ink} 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(90deg, ${ink} 1px, transparent 1px) 0 0 / 22px 22px, radial-gradient(${b} 1.5px, transparent 2.5px) 0 0 / 22px 22px`,
      };
      return { background: `${patterns[data.pattern] === 'none' ? '' : `${patterns[data.pattern]}, `}${a}` };
    }
  }
}

export function nameStyle(data: NameStyleData): CSSProperties {
  const [first = '#f4f4f6'] = data.colors;
  const glow = data.glow ? { filter: `drop-shadow(0 0 8px ${withAlpha(first, 'aa')})` } : {};
  return data.colors.length > 1
    ? { backgroundImage: `linear-gradient(90deg, ${data.colors.join(', ')})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', ...glow }
    : { color: first, ...glow };
}

export function xpBarStyle(data: XpBarData): CSSProperties {
  const [a = '#a99bff', b = a] = data.colors;
  switch (data.style) {
    case 'solid': return { background: a };
    case 'gradient': return { background: `linear-gradient(90deg, ${data.colors.join(', ')})` };
    case 'striped': return { background: `repeating-linear-gradient(45deg, ${a} 0 6px, ${b} 6px 12px)` };
    case 'segmented': return { background: `repeating-linear-gradient(90deg, ${a} 0 10px, transparent 10px 13px)` };
    case 'glow': return { background: a, boxShadow: `0 0 12px ${a}` };
  }
}

export const FONT_FAMILY: Record<FontData['font'], string> = {
  inter: '"Inter Variable", Inter, sans-serif',
  unbounded: '"Unbounded Variable", sans-serif',
  caveat: 'Caveat, "Segoe Print", "Bradley Hand", cursive',
};

function FramedAvatar({ data }: { data: FrameData }) {
  const [a = '#d4d4d8', b = a] = data.colors;
  const ring: CSSProperties = data.style === 'gradient' || data.style === 'crown'
    ? { padding: data.width, background: `linear-gradient(135deg, ${a}, ${b})` }
    : {
      border: `${Math.max(data.width, data.style === 'double' ? 6 : 2)}px ${data.style === 'dashed' ? 'dashed' : data.style === 'double' ? 'double' : 'solid'} ${a}`,
      boxShadow: data.style === 'glow' ? `0 0 16px ${withAlpha(a, 'aa')}` : data.style === 'neon' ? `0 0 6px ${a}, 0 0 20px ${a}` : data.style === 'double' ? `0 0 0 2px ${b}` : undefined,
    };
  return (
    <span className="relative">
      {data.style === 'crown' && <span className="absolute -top-4 left-1/2 -translate-x-1/2" style={{ color: a }}><Glyph name="crown" size={18} /></span>}
      <span className="block rounded-full" style={ring}>
        <span className="block h-12 w-12 rounded-full bg-gradient-to-br from-[#3a3a46] to-[#1d1d24]" />
      </span>
    </span>
  );
}

const EFFECT_DOTS: [number, number][] = [[12, 14], [30, 40], [52, 10], [70, 32], [86, 12], [20, 58], [44, 64], [64, 54], [90, 62], [6, 36]];

function EffectPreview({ effect }: { effect: EffectData['effect'] }) {
  if (effect === 'scanlines') return <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,.09)_0_1px,transparent_1px_4px)]" />;
  if (effect === 'aurora') return <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_30%_30%,rgba(45,226,166,.35),transparent),radial-gradient(60%_50%_at_75%_60%,rgba(124,92,255,.35),transparent)]" />;
  const colors = { sparkles: ['#fde68a', '#fff'], snow: ['#fff', '#e0f2fe'], confetti: ['#f472b6', '#facc15', '#38bdf8', '#4ade80'], stardust: ['#c4b5fd', '#fff'], embers: ['#fb923c', '#f87171'], hearts: ['#fb7185', '#f9a8d4'] }[effect];
  return (
    <svg viewBox="0 0 100 75" className="absolute inset-0 h-full w-full" aria-hidden="true">
      {EFFECT_DOTS.map(([x, y], i) => {
        const fill = colors[i % colors.length];
        if (effect === 'sparkles') return <path key={i} d={`M${x} ${y - 4}l1 3 3 1-3 1-1 3-1-3-3-1 3-1z`} fill={fill} />;
        if (effect === 'confetti') return <rect key={i} x={x} y={y} width="3" height="5" rx=".5" fill={fill} transform={`rotate(${i * 37} ${x} ${y})`} />;
        if (effect === 'hearts') return <path key={i} d={`M${x} ${y + 3}l-3-3a1.8 1.8 0 0 1 3-2 1.8 1.8 0 0 1 3 2z`} fill={fill} />;
        const r = effect === 'stardust' ? 0.7 + (i % 3) * 0.3 : effect === 'embers' ? 1.2 + (i % 2) : 1.6 + (i % 3) * 0.5;
        return <circle key={i} cx={x} cy={y} r={r} fill={fill} opacity={effect === 'embers' ? 0.85 : 0.9} />;
      })}
    </svg>
  );
}

function LevelupBanner({ data }: { data: LevelupData }) {
  const c = data.color;
  const styles: Record<LevelupData['style'], CSSProperties> = {
    classic: { color: c, border: `1px solid ${withAlpha(c, '55')}`, background: withAlpha(c, '14') },
    minimal: { color: c, borderBottom: `2px solid ${c}`, borderRadius: 0 },
    neon: { color: c, border: `1px solid ${c}`, boxShadow: `0 0 12px ${withAlpha(c, '88')}, inset 0 0 10px ${withAlpha(c, '44')}`, textShadow: `0 0 8px ${c}` },
    royal: { color: '#1a1305', background: `linear-gradient(135deg, ${c}, #fff3c4 50%, ${c})` },
    retro: { color: c, border: `2px solid ${c}`, fontFamily: 'var(--mono)', letterSpacing: '.12em', boxShadow: `3px 3px 0 ${withAlpha(c, '66')}` },
  };
  return <span className="rounded-md px-2.5 py-1 text-[12px] font-bold tracking-wide" style={styles[data.style]}>LEVEL UP</span>;
}

function LayoutSketch({ layout }: { layout: 'classic' | 'compact' | 'centered' | 'split' }) {
  const line = 'fill-white/25';
  return (
    <svg viewBox="0 0 80 50" className="w-3/4" aria-hidden="true">
      <rect x=".5" y=".5" width="79" height="49" rx="6" className="fill-white/[.04] stroke-white/20" />
      {layout === 'classic' && <><circle cx="16" cy="25" r="9" className={line} /><rect x="30" y="17" width="34" height="5" rx="2" className={line} /><rect x="30" y="27" width="24" height="4" rx="2" className="fill-white/15" /><rect x="30" y="36" width="42" height="3" rx="1.5" className="fill-white/15" /></>}
      {layout === 'compact' && <><circle cx="12" cy="25" r="6" className={line} /><rect x="22" y="20" width="30" height="4" rx="2" className={line} /><rect x="22" y="28" width="50" height="3" rx="1.5" className="fill-white/15" /></>}
      {layout === 'centered' && <><circle cx="40" cy="17" r="8" className={line} /><rect x="24" y="29" width="32" height="4" rx="2" className={line} /><rect x="18" y="38" width="44" height="3" rx="1.5" className="fill-white/15" /></>}
      {layout === 'split' && <><rect x="6" y="6" width="28" height="38" rx="4" className="fill-white/15" /><circle cx="20" cy="22" r="7" className={line} /><rect x="40" y="16" width="30" height="5" rx="2" className={line} /><rect x="40" y="26" width="22" height="4" rx="2" className="fill-white/15" /><rect x="40" y="35" width="32" height="3" rx="1.5" className="fill-white/15" /></>}
    </svg>
  );
}

function previewOf(item: CosmeticItem): ReactNode {
  switch (item.slot) {
    case 'background': return <div className="absolute inset-0" style={backgroundStyle(item.data)} />;
    case 'accent': return (
      <div className="flex w-3/4 flex-col gap-2">
        <span className="h-1.5 w-10 rounded-full" style={{ background: item.data.color }} />
        <span className="h-2 w-full rounded-full bg-white/10"><span className="block h-full w-3/5 rounded-full" style={{ background: item.data.color }} /></span>
        <span className="h-6 w-6 rounded-full" style={{ background: item.data.color, boxShadow: `0 0 14px ${withAlpha(item.data.color, '66')}` }} />
      </div>
    );
    case 'nameStyle': return <span className="text-[22px] font-semibold tracking-tight" style={nameStyle(item.data)}>Name</span>;
    case 'frame': return <FramedAvatar data={item.data} />;
    case 'badge': return <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[.05] ring-1 ring-white/10" style={{ color: item.data.color }}><Glyph name={item.data.glyph} size={26} /></span>;
    case 'sticker': return <span className="-rotate-12 rounded-xl bg-white/[.06] p-2 shadow-lg ring-1 ring-white/15" style={{ color: item.data.color }}><Glyph name={item.data.glyph} size={30} /></span>;
    case 'title': return <span className="rounded-full px-3 py-1 text-[13px] font-medium" style={{ color: item.data.color, border: `1px solid ${withAlpha(item.data.color, '55')}`, background: withAlpha(item.data.color, '14') }}>{item.data.text}</span>;
    case 'xpBar': return <span className="block h-3 w-3/4 overflow-hidden rounded-full bg-white/[.07]"><span className="block h-full w-2/3 rounded-full" style={xpBarStyle(item.data)} /></span>;
    case 'font': return <span className="text-[34px] leading-none text-ink" style={{ fontFamily: FONT_FAMILY[item.data.font] }}>Aa</span>;
    case 'effect': return <EffectPreview effect={item.data.effect} />;
    case 'levelup': return <LevelupBanner data={item.data} />;
    case 'layout': return <LayoutSketch layout={item.data.layout} />;
  }
}

/** Mini preview tile of what an item changes (drawn with CSS/SVG). */
export function ItemVisual({ item, className = '' }: { item: CosmeticItem; className?: string }) {
  return (
    <div data-mode="dark" className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-[#101015] ${className}`}>
      {previewOf(item)}
    </div>
  );
}
