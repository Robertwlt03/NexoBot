// Item tiles (painted by the card renderer, see ItemPreviewCanvas), the member-area icons and currency helpers.
import { Fragment } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { CURRENCY, RARITY_LABELS, SLOT_LABELS } from '../../../src/shared/cosmetics';
import { CoinIcon } from '../components/CoinIcon';
import { COIN_TIERS, splitCoins } from '../../../src/shared/coins';
import { ItemPreviewCanvas } from '../components/ProfileCardPreview';
import type {
  BackgroundData, BadgeGlyph, CosmeticItem, LevelupData, Rarity,
} from '../../../src/shared/cosmetics';
import { num } from './api';

// ---------- Glyphs (24px line icons; the badge glyphs double as member-area icons) ----------

export const GLYPHS = {
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
  pumpkin: <><path d="M12 7.5c-1.4-.9-3.4-1.1-5.2-.4C3.9 8.2 2.5 11 2.8 14.2c.3 3.4 2.7 6 5.7 6.3 1.3.1 2.5-.2 3.5-.8 1 .6 2.2.9 3.5.8 3-.3 5.4-2.9 5.7-6.3.3-3.2-1.1-6-4-7.1-1.8-.7-3.8-.5-5.2.4z" /><path d="M12 7.5c-1.8 2.3-2.4 5-2.2 7.6.2 2.2.9 3.8 2.2 4.6 1.3-.8 2-2.4 2.2-4.6.2-2.6-.4-5.3-2.2-7.6M12 7.5V5c0-1.1.7-2 1.8-2.3" /></>,
  gift: <><rect x="3" y="8" width="18" height="5" rx="1" /><path d="M5 13v8h14v-8M12 8v13" /><path d="M12 8C10.5 4 6.5 4 7 6.5S12 8 12 8zM12 8c1.5-4 5.5-4 5-1.5S12 8 12 8z" /></>,
  paw: <><circle cx="6.5" cy="10" r="1.8" /><circle cx="10" cy="6" r="1.8" /><circle cx="14" cy="6" r="1.8" /><circle cx="17.5" cy="10" r="1.8" /><path d="M12 12c-3 0-5.5 3.5-5.5 5.5 0 1.5 1.5 2 3 1.5s3.5-.5 5 0 3 0 3-1.5C17.5 15.5 15 12 12 12z" /></>,
  code: <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />,
  acorn: <><path d="M4.5 11a7.5 5 0 0 1 15 0z" /><path d="M12 6V3.5" /><path d="M6.5 11h11c0 4.5-2.5 7.5-5.5 9-3-1.5-5.5-4.5-5.5-9z" /></>,
  mushroom: <><path d="M2.5 12a9.5 8.5 0 0 1 19 0z" /><path d="M8.5 12l-.5 8.5h8l-.5-8.5" /></>,
  tree: <path d="M12 2l6 7.5h-3l5.5 7H14v5.5h-4v-5.5H3.5l5.5-7H6z" />,
  chat: <><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /><path d="M8 11h.01M12 11h.01M16 11h.01" strokeWidth={3} /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" /></>,
  egg: <><path d="M12 3c4 0 7 6.5 7 11a7 7 0 0 1-14 0c0-4.5 3-11 7-11z" /><path d="M5.6 12.5l2.1-1.8 2.1 1.8 2.2-1.8 2.1 1.8 2.1-1.8 2.2 1.8" /></>,
  mask: <><path d="M2.5 9c.8-3.5 5.5-3.3 9.5-1 4-2.3 8.7-2.5 9.5 1 .5 4.5-3 7-6 6-1.8-.6-2.3-2-3.5-2s-1.7 1.4-3.5 2c-3 1-6.5-1.5-6-6z" /><path d="M6 10.5c1.2-1.5 3-1.5 4 0M14 10.5c1-1.5 2.8-1.5 4 0" /></>,
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
  rare: { border: 'border-sky-400/25', text: 'text-(--rarity-rare)' },
  epic: { border: 'border-violet-400/30', text: 'text-(--rarity-epic)' },
  legendary: { border: 'border-amber-300/30', text: 'text-(--rarity-legendary)' },
  mythic: { border: 'border-rose-500/25', text: 'text-(--rarity-mythic)' },
};

/** Rarity identity of a tile (game-shop convention: grey, blue, purple, gold, red). Only used inside item tiles. */
export const RARITY_TILE: Record<Rarity, string> = {
  common: '#8a8f99', rare: '#3b8cf6', epic: '#a35cf5', legendary: '#f2a516', mythic: '#f2415f',
};

export function RarityLabel({ rarity }: { rarity: Rarity }) {
  return <span className={`text-[12px] font-medium ${RARITY_CLASS[rarity].text}`}>{RARITY_LABELS[rarity]}</span>;
}

/** `large` shows the full amber drop (vein, bubble) for big hero numbers. */
/**
 * An amount as coins: platinum, gold, silver and bronze (each 100 of the one below), zero tiers left out. Plain
 * inline text, so the numbers sit on the surrounding text's baseline and each coin is centred on them (the usual
 * icon-in-text offset); it breaks only between coins, or never with `nowrap` (table cells, pills, price rows).
 * `max` shows only the highest coins (e.g. 2 in the header pill); the tooltip keeps the exact amount.
 */
export function Bernis({ amount, className = '', large = false, nowrap = false, max }: { amount: number; className?: string; large?: boolean; nowrap?: boolean; max?: number }) {
  const all = splitCoins(amount);
  const parts = max ? all.slice(0, max) : all;
  const label = `${num(amount)} ${CURRENCY.name}: ${all.map(({ tier, count }) => `${count} ${COIN_TIERS.find((t) => t.tier === tier)!.label}`).join(', ')}`;
  // Lowered so the coin's centre meets the middle of the digits (Inter digits are 0.738em tall).
  const coin = large ? 'h-[1.1em] w-[1.1em] align-[-0.181em]' : 'h-[1.05em] w-[1.05em] align-[-0.156em]';
  return (
    <span title={label} aria-label={label} className={`tabular-nums ${nowrap ? 'whitespace-nowrap' : ''} ${className}`}>
      {amount < 0 && <span aria-hidden="true">−</span>}
      {parts.map(({ tier, count }, index) => (
        <Fragment key={tier}>
          {index > 0 && ' '}
          <span aria-hidden="true" className={`whitespace-nowrap ${index > 0 ? 'ml-[0.25em]' : ''}`}>
            <CoinIcon tier={tier} className={`mr-[0.22em] ${coin}`} />{count}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

/**
 * The balance as little coin piles, one per metal: a layer per ten coins (at most ten), each layer nudged a little
 * so it reads as a pile; the count sits below.
 */
export function CoinStacks({ amount, className = '' }: { amount: number; className?: string }) {
  return (
    <div aria-hidden="true" className={`flex items-end gap-3 ${className}`}>
      {splitCoins(amount).map(({ tier, count }) => {
        const layers = Math.max(1, Math.min(10, Math.ceil(count / 10)));
        return (
          <div key={tier} className="flex flex-col items-center gap-1">
            <div className="relative w-7" style={{ height: 26 + (layers - 1) * 5 }}>
              {Array.from({ length: layers }, (_, i) => (
                <CoinIcon key={i} tier={tier} className="absolute h-7 w-7 drop-shadow-[0_2px_2px_rgba(0,0,0,.35)]"
                  style={{ bottom: i * 5, left: (i % 3 === 1 ? 1.5 : i % 3 === 2 ? -1 : 0) }} />
              ))}
            </div>
            <span className="text-[11px] font-medium tabular-nums text-mute">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

/** A former price, struck through by hand: text-decoration does not reach across the coin icons. */
export function StruckBernis({ amount, className = '' }: { amount: number; className?: string }) {
  return (
    <s className={`relative inline-block no-underline ${className}`}>
      <span className="sr-only">statt </span><Bernis amount={amount} nowrap className="opacity-80" />
      <span aria-hidden="true" className="absolute inset-x-[-2px] top-1/2 h-px -rotate-6 bg-current" />
    </s>
  );
}

/** Price with the base price struck through while an event discount applies (moves below when there is no room). */
export function Price({ price, finalPrice, className = '' }: { price: number; finalPrice: number; className?: string }) {
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${className}`}>
      <Bernis amount={finalPrice} nowrap className="font-medium text-ink" />
      {finalPrice < price && <StruckBernis amount={price} className="text-[12px] text-faint" />}
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
    // Scenes are drawn by the card renderer; CSS only needs their mood (backdrops, banners).
    case 'scene': return { background: `linear-gradient(160deg, ${a}, ${b} 60%, ${c})` };
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

function previewOf(item: CosmeticItem): ReactNode {
  // Everything the card shows is painted by the card renderer, so tile and card always match.
  if (item.slot === 'levelup') return <LevelupBanner data={item.data} />;
  return <ItemPreviewCanvas item={item} />;
}

/** Preview tile of what an item changes, exactly as the card renderer paints it. */
export function ItemVisual({ item, className = '' }: { item: CosmeticItem; className?: string }) {
  return (
    <div data-mode="dark" className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-[#101015] ${className}`}>
      {previewOf(item)}
    </div>
  );
}
