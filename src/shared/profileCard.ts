// Profile card ("Profilkarte") and level-up card: ONE renderer for the dashboard preview (browser canvas) and the
// bot (@napi-rs/canvas). Import-free apart from types, like welcomeCard.ts, so both sides draw the same pixels.
// Randomness (patterns, effects) is seeded by the member's name, so preview == bot.

import { drawAmber } from './amber.js';
import type {
  BackgroundData, BackgroundScene, BadgeData, BadgeGlyph, CosmeticItem, EffectData, FrameData, LayoutData, LevelupData, NameStyleData, PatternKind,
  ProfileCardSubject, ResolvedCosmetics, StickerData, XpBarData,
} from './cosmetics.js';

export const PROFILE_CARD_WIDTH = 1024;
export const PROFILE_CARD_HEIGHT = 360;
export const LEVELUP_CARD_WIDTH = 900;
export const LEVELUP_CARD_HEIGHT = 240;
/** Nexo's default accent (lavender). */
export const DEFAULT_ACCENT = '#8FB36B';

/** Families of the bundled fonts (same names as CARD_FONTS in welcomeCard.ts, registered by the bot and the dashboard). */
export const PROFILE_FONTS = { inter: 'NexoCard Inter', unbounded: 'NexoCard Unbounded', caveat: 'NexoCard Caveat' } as const;
type FontKey = keyof typeof PROFILE_FONTS;

const W = PROFILE_CARD_WIDTH;
const H = PROFILE_CARD_HEIGHT;
const RADIUS = 28;
const TEXT = '#F3F2F8';
// Translucent text tones stay legible on light and dark backgrounds alike.
const SOFT = 'rgba(236, 233, 255, 0.82)';
const MUTED = 'rgba(236, 233, 255, 0.62)';
const FAINT = 'rgba(236, 233, 255, 0.5)';
const TAU = Math.PI * 2;

// ---------- Canvas contract ----------

export interface ProfileImage { width: number; height: number }
export interface ProfileGradient { addColorStop(offset: number, color: string): void }

/** The part of CanvasRenderingContext2D the renderer uses (browser canvas and @napi-rs/canvas both fit). */
export interface ProfileContext<I> {
  fillStyle: string | object;
  strokeStyle: string | object;
  lineWidth: number;
  lineCap: string;
  lineJoin: string;
  globalAlpha: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  save(): void;
  restore(): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  rect(x: number, y: number, w: number, h: number): void;
  fill(fillRule?: 'nonzero' | 'evenodd'): void;
  stroke(): void;
  clip(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): ProfileGradient;
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): ProfileGradient;
  drawImage(image: I, dx: number, dy: number, dw: number, dh: number): void;
  setLineDash(segments: number[]): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  scale(x: number, y: number): void;
}

/** Pre-loaded images (only the avatar; a missing avatar gets a lettered placeholder). */
export interface ProfileAssets<I> { avatar: I | null }

type Ctx = ProfileContext<unknown>;

// ---------- Colours ----------

function parseHex(color: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return null;
  const hex = match[1].length === 3 ? match[1].replace(/./g, (c) => c + c) : match[1];
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

export function withAlpha(color: string, alpha: number): string {
  const rgb = parseHex(color);
  return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})` : color;
}

function mix(color: string, other: string, t: number): string {
  const a = parseHex(color);
  const b = parseHex(other);
  if (!a || !b) return color;
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}
const lighten = (color: string, t: number) => mix(color, '#FFFFFF', t);
const darken = (color: string, t: number) => mix(color, '#000000', t);

/** Relative brightness 0–1 (sRGB average weighted by perception). */
export function brightness(color: string): number {
  const rgb = parseHex(color);
  return rgb ? (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) / 255 : 0;
}

// ---------- Deterministic randomness ----------

/** FNV-1a: a stable 32-bit seed from a string (same value in browser and bot). */
export function seedFrom(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: small seeded PRNG returning numbers in [0, 1). */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Small helpers ----------

export const xpFraction = (xp: number, needed: number) => (needed > 0 ? Math.min(1, Math.max(0, xp / needed)) : 0);
export const formatNumber = (value: number) => Math.round(value).toLocaleString('de-DE');
const font = (key: FontKey, weight: 400 | 700, size: number) => `${weight} ${size}px "${PROFILE_FONTS[key]}"`;
/** Caveat is a handwriting font with small glyphs; it gets a size boost so names stay legible. */
const fontScale = (key: FontKey) => (key === 'caveat' ? 1.28 : key === 'unbounded' ? 0.86 : 1);

function roundedRect(ctx: Ctx, x: number, y: number, w: number, h: number, radius: number) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(ctx: Ctx, x: number, y: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.arc(x, y, r, 0, TAU);
}

function resetShadow(ctx: Ctx) {
  ctx.shadowColor = 'rgba(0, 0, 0, 0)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/** Linear gradient through the box centre at `angle` degrees (0 = left → right), stops spread evenly. */
function linearGradient(ctx: Ctx, angle: number, x: number, y: number, w: number, h: number, colors: string[]): ProfileGradient {
  const a = (angle * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const half = (Math.abs(w * cos) + Math.abs(h * sin)) / 2;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const gradient = ctx.createLinearGradient(cx - cos * half, cy - sin * half, cx + cos * half, cy + sin * half);
  colors.forEach((color, index) => gradient.addColorStop(colors.length === 1 ? 0 : index / (colors.length - 1), color));
  return gradient;
}

/** Soft round glow (radial gradient fading to transparent). */
function glow(ctx: Ctx, x: number, y: number, r: number, color: string, alpha: number) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
  gradient.addColorStop(0, withAlpha(color, alpha));
  gradient.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Shrinks `text` to `maxWidth` (not below `minSize`), then cuts it with an ellipsis. Leaves ctx.font set. */
export function fitText(
  ctx: Pick<Ctx, 'font' | 'measureText'>, text: string, key: FontKey, weight: 400 | 700, size: number, minSize: number, maxWidth: number,
): { text: string; size: number } {
  ctx.font = font(key, weight, size);
  let width = ctx.measureText(text).width;
  if (width > maxWidth && size > minSize) {
    size = Math.max(minSize, Math.floor((size * maxWidth) / width));
    ctx.font = font(key, weight, size);
    width = ctx.measureText(text).width;
  }
  if (width <= maxWidth) return { text, size };
  const chars = Array.from(text);
  while (chars.length > 1 && ctx.measureText(`${chars.join('')}…`).width > maxWidth) chars.pop();
  return { text: `${chars.join('').trimEnd()}…`, size };
}

// ---------- Glyphs (vector, 24×24 box centred on the origin; no emoji fonts needed) ----------

type GlyphDrawer = (ctx: Ctx) => void;

const star = (ctx: Ctx, points: number, outer: number, inner: number) => {
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
};

const poly = (ctx: Ctx, points: [number, number][]) => {
  points.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
};

const box = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number) => {
  // Same as roundedRect but without beginPath, so it can be part of a compound path.
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

export const GLYPH_DRAWERS: Record<BadgeGlyph, GlyphDrawer> = {
  star: (ctx) => { ctx.beginPath(); star(ctx, 5, 11.5, 5); ctx.fill(); },
  crown: (ctx) => {
    ctx.beginPath();
    poly(ctx, [[-10, 5], [-11, -6], [-5, -0.5], [0, -9], [5, -0.5], [11, -6], [10, 5]]);
    box(ctx, -10, 6.5, 20, 3.5, 1.2);
    circle(ctx, -11, -7, 1.8); circle(ctx, 0, -10, 1.8); circle(ctx, 11, -7, 1.8);
    ctx.fill();
  },
  flame: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.bezierCurveTo(3, -6, 9, -3, 9, 3.5);
    ctx.bezierCurveTo(9, 8.5, 5, 12, 0, 12);
    ctx.bezierCurveTo(-5, 12, -9, 8.5, -9, 3.5);
    ctx.bezierCurveTo(-9, -1, -5.5, -3, -4, -7);
    ctx.bezierCurveTo(-2, -4, -1, -5, 0, -12);
    ctx.closePath();
    ctx.moveTo(0, 1);
    ctx.bezierCurveTo(3, 4, 4.2, 6, 4.2, 7.6);
    ctx.bezierCurveTo(4.2, 9.8, 2.4, 11, 0, 11);
    ctx.bezierCurveTo(-2.4, 11, -4.2, 9.8, -4.2, 7.6);
    ctx.bezierCurveTo(-4.2, 5.5, -2, 3.5, 0, 1);
    ctx.closePath();
    ctx.fill('evenodd');
  },
  bolt: (ctx) => { ctx.beginPath(); poly(ctx, [[3, -12], [-8, 2], [-1, 2], [-3, 12], [8, -2.5], [1, -2.5]]); ctx.fill(); },
  heart: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(0, 10.5);
    ctx.bezierCurveTo(-12.5, 2.5, -11.5, -9.5, -5.5, -9.5);
    ctx.bezierCurveTo(-2.6, -9.5, -0.8, -7.4, 0, -5.4);
    ctx.bezierCurveTo(0.8, -7.4, 2.6, -9.5, 5.5, -9.5);
    ctx.bezierCurveTo(11.5, -9.5, 12.5, 2.5, 0, 10.5);
    ctx.closePath();
    ctx.fill();
  },
  diamond: (ctx) => {
    ctx.beginPath();
    poly(ctx, [[-11.5, -3], [-6, -9.5], [6, -9.5], [11.5, -3], [0, 11]]);
    poly(ctx, [[-8.6, -4.1], [8.6, -4.1], [8.2, -2.7], [-8.2, -2.7]]);
    poly(ctx, [[-1.4, -3.4], [0, -8.6], [1.4, -3.4]]);
    ctx.fill('evenodd');
  },
  shield: (ctx) => {
    const outline = (s: number) => {
      ctx.moveTo(0, -11 * s);
      ctx.lineTo(9.5 * s, -7.5 * s);
      ctx.lineTo(9.5 * s, 0);
      ctx.bezierCurveTo(9.5 * s, 6 * s, 5.5 * s, 9.5 * s, 0, 12 * s);
      ctx.bezierCurveTo(-5.5 * s, 9.5 * s, -9.5 * s, 6 * s, -9.5 * s, 0);
      ctx.lineTo(-9.5 * s, -7.5 * s);
      ctx.closePath();
    };
    ctx.beginPath();
    outline(1);
    ctx.translate(0, 0.4);
    outline(0.68);
    ctx.fill('evenodd');
    ctx.beginPath();
    outline(0.42);
    ctx.fill();
  },
  leaf: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-9.5, 10.5);
    ctx.bezierCurveTo(-12, -2, -3, -11, 10.5, -10.5);
    ctx.bezierCurveTo(11, 3, 2, 11.5, -9.5, 10.5);
    ctx.closePath();
    poly(ctx, [[-7.4, 8.2], [7.2, -7.4], [7.9, -6.7], [-6.7, 8.9]]);
    ctx.fill('evenodd');
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-9.5, 10.5);
    ctx.lineTo(-11.5, 12);
    ctx.stroke();
  },
  moon: (ctx) => {
    ctx.save();
    ctx.beginPath();
    circle(ctx, 0, 0, 10.5);
    ctx.clip();
    ctx.beginPath();
    circle(ctx, 0, 0, 10.5);
    circle(ctx, 5.5, -4.5, 9);
    ctx.fill('evenodd');
    ctx.restore();
  },
  sun: (ctx) => {
    ctx.beginPath();
    circle(ctx, 0, 0, 5.2);
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
      ctx.lineTo(Math.cos(a) * 11.2, Math.sin(a) * 11.2);
    }
    ctx.stroke();
  },
  snowflake: (ctx) => {
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 - Math.PI / 2;
      const p = (r: number, da = 0) => [Math.cos(a + da) * r, Math.sin(a + da) * r] as const;
      ctx.moveTo(0, 0);
      ctx.lineTo(...p(11));
      ctx.moveTo(...p(6.5));
      ctx.lineTo(...p(9.6, 0.42));
      ctx.moveTo(...p(6.5));
      ctx.lineTo(...p(9.6, -0.42));
    }
    ctx.stroke();
  },
  skull: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-9.5, 2.5);
    ctx.arc(0, -1, 9.5, Math.PI * 0.94, Math.PI * 0.06);
    ctx.lineTo(9, 4.5);
    ctx.lineTo(6, 6);
    ctx.lineTo(6, 10.5);
    ctx.lineTo(-6, 10.5);
    ctx.lineTo(-6, 6);
    ctx.lineTo(-9, 4.5);
    ctx.closePath();
    circle(ctx, -3.9, 0, 2.9);
    circle(ctx, 3.9, 0, 2.9);
    poly(ctx, [[0, 3.6], [-1.5, 6.2], [1.5, 6.2]]);
    box(ctx, -2.6, 7.6, 1.2, 2.9, 0.4);
    box(ctx, 1.4, 7.6, 1.2, 2.9, 0.4);
    ctx.fill('evenodd');
  },
  music: (ctx) => {
    ctx.beginPath();
    circle(ctx, -5.6, 7.4, 3.6);
    circle(ctx, 6.4, 5, 3.6);
    box(ctx, -3.2, -7, 2.2, 14.4, 0.6);
    box(ctx, 8.8, -9.6, 2.2, 14.6, 0.6);
    poly(ctx, [[-3.2, -7], [11, -10.4], [11, -6.4], [-3.2, -3]]);
    ctx.fill();
  },
  controller: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-6, -6.5);
    ctx.lineTo(6, -6.5);
    ctx.bezierCurveTo(10, -6.5, 12, -2, 12, 3);
    ctx.bezierCurveTo(12, 7.5, 9.5, 9, 7.5, 7.5);
    ctx.lineTo(4.5, 4.5);
    ctx.lineTo(-4.5, 4.5);
    ctx.lineTo(-7.5, 7.5);
    ctx.bezierCurveTo(-9.5, 9, -12, 7.5, -12, 3);
    ctx.bezierCurveTo(-12, -2, -10, -6.5, -6, -6.5);
    ctx.closePath();
    box(ctx, -8.6, -1.6, 6, 2.2, 0.6);
    box(ctx, -6.7, -3.5, 2.2, 6, 0.6);
    circle(ctx, 5.2, -2.4, 1.5);
    circle(ctx, 7.8, 0.6, 1.5);
    ctx.fill('evenodd');
  },
  fish: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-11, 0);
    ctx.bezierCurveTo(-7, -7.5, 2, -8, 6, 0);
    ctx.bezierCurveTo(2, 8, -7, 7.5, -11, 0);
    ctx.closePath();
    poly(ctx, [[4.5, 0], [11.5, -6], [11.5, 6]]);
    circle(ctx, -5.6, -1.4, 1.4);
    ctx.fill('evenodd');
  },
  pickaxe: (ctx) => {
    ctx.save();
    ctx.rotate(-Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(-12, -2);
    ctx.quadraticCurveTo(0, -14.5, 12, -2);
    ctx.lineTo(10.5, 0);
    ctx.quadraticCurveTo(0, -6.5, -10.5, 0);
    ctx.closePath();
    box(ctx, -1.4, -8.5, 2.8, 20.5, 1.4);
    ctx.fill();
    ctx.restore();
  },
  dice: (ctx) => {
    ctx.beginPath();
    box(ctx, -10.5, -10.5, 21, 21, 4.5);
    for (const [x, y] of [[-5, -5], [5, -5], [0, 0], [-5, 5], [5, 5]] as const) circle(ctx, x, y, 2);
    ctx.fill('evenodd');
  },
  trophy: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-7, -10.5);
    ctx.lineTo(7, -10.5);
    ctx.lineTo(7, -3.5);
    ctx.bezierCurveTo(7, 1.5, 3.8, 4.5, 0, 4.5);
    ctx.bezierCurveTo(-3.8, 4.5, -7, 1.5, -7, -3.5);
    ctx.closePath();
    box(ctx, -1.6, 4, 3.2, 4.5, 0.4);
    box(ctx, -6.5, 8, 13, 3.2, 1.2);
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(-7, -5.5, 3.6, Math.PI / 2, (Math.PI * 3) / 2);
    ctx.moveTo(7, -9.1);
    ctx.arc(7, -5.5, 3.6, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
  },
  rocket: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.bezierCurveTo(5.5, -8, 6, -2, 4.6, 5);
    ctx.lineTo(-4.6, 5);
    ctx.bezierCurveTo(-6, -2, -5.5, -8, 0, -12);
    ctx.closePath();
    circle(ctx, 0, -3.6, 2.2);
    ctx.fill('evenodd');
    ctx.beginPath();
    poly(ctx, [[-4.4, -0.5], [-9, 6.5], [-4.6, 5.2]]);
    poly(ctx, [[4.4, -0.5], [9, 6.5], [4.6, 5.2]]);
    poly(ctx, [[-2.6, 6.6], [0, 12], [2.6, 6.6]]);
    ctx.fill();
  },
  ghost: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-9, 11);
    ctx.lineTo(-9, -1.5);
    ctx.arc(0, -1.5, 9, Math.PI, 0);
    ctx.lineTo(9, 11);
    ctx.lineTo(6, 8.4);
    ctx.lineTo(3, 11);
    ctx.lineTo(0, 8.4);
    ctx.lineTo(-3, 11);
    ctx.lineTo(-6, 8.4);
    ctx.closePath();
    circle(ctx, -3.4, -1.5, 2);
    circle(ctx, 3.4, -1.5, 2);
    ctx.fill('evenodd');
  },
  pumpkin: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.bezierCurveTo(9, -9, 13, 0, 10.5, 6);
    ctx.bezierCurveTo(8.5, 11, 2.5, 11.5, 0, 10.5);
    ctx.bezierCurveTo(-2.5, 11.5, -8.5, 11, -10.5, 6);
    ctx.bezierCurveTo(-13, 0, -9, -9, 0, -6);
    ctx.closePath();
    poly(ctx, [[-6.4, 0.5], [-2, 0.5], [-4.2, -3.2]]);
    poly(ctx, [[2, 0.5], [6.4, 0.5], [4.2, -3.2]]);
    poly(ctx, [[-6.5, 3.2], [6.5, 3.2], [4.8, 7], [2.2, 5.4], [0, 7.4], [-2.2, 5.4], [-4.8, 7]]);
    ctx.fill('evenodd');
    ctx.beginPath();
    box(ctx, -1.3, -11.5, 2.6, 5, 0.8);
    ctx.fill();
  },
  gift: (ctx) => {
    ctx.beginPath();
    box(ctx, -9.5, -2.5, 19, 13, 1.5);
    box(ctx, -11, -7, 22, 4, 1.2);
    box(ctx, -1.3, -7, 2.6, 17.5, 0);
    ctx.fill('evenodd');
    ctx.beginPath();
    ctx.moveTo(-0.6, -7.6);
    ctx.bezierCurveTo(-3, -13.5, -10, -11.5, -5.5, -7.6);
    ctx.closePath();
    ctx.moveTo(0.6, -7.6);
    ctx.bezierCurveTo(3, -13.5, 10, -11.5, 5.5, -7.6);
    ctx.closePath();
    ctx.fill();
  },
  paw: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(0, 0.5);
    ctx.bezierCurveTo(4.5, 0.5, 7.5, 5, 6, 8.2);
    ctx.bezierCurveTo(4.5, 11, 1.8, 9.8, 0, 9.8);
    ctx.bezierCurveTo(-1.8, 9.8, -4.5, 11, -6, 8.2);
    ctx.bezierCurveTo(-7.5, 5, -4.5, 0.5, 0, 0.5);
    ctx.closePath();
    circle(ctx, -8, -2.5, 2.5);
    circle(ctx, -3.2, -7, 2.7);
    circle(ctx, 3.2, -7, 2.7);
    circle(ctx, 8, -2.5, 2.5);
    ctx.fill();
  },
  code: (ctx) => {
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-5, -6.5);
    ctx.lineTo(-11, 0);
    ctx.lineTo(-5, 6.5);
    ctx.moveTo(5, -6.5);
    ctx.lineTo(11, 0);
    ctx.lineTo(5, 6.5);
    ctx.moveTo(2.4, -9.5);
    ctx.lineTo(-2.4, 9.5);
    ctx.stroke();
  },
  acorn: (ctx) => {
    ctx.beginPath();
    // Cap with stalk, then the nut below it.
    ctx.moveTo(-9.5, -1);
    ctx.bezierCurveTo(-9.5, -7.5, -5, -9.8, 0, -9.8);
    ctx.bezierCurveTo(5, -9.8, 9.5, -7.5, 9.5, -1);
    ctx.closePath();
    box(ctx, -1.2, -12.6, 2.4, 4, 1);
    ctx.moveTo(-7.2, 0.6);
    ctx.lineTo(7.2, 0.6);
    ctx.bezierCurveTo(7.2, 6.8, 3.8, 10.6, 0, 12.2);
    ctx.bezierCurveTo(-3.8, 10.6, -7.2, 6.8, -7.2, 0.6);
    ctx.closePath();
    ctx.fill();
  },
  egg: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.bezierCurveTo(6.5, -12, 9.5, -2.5, 9.5, 3);
    ctx.bezierCurveTo(9.5, 8.6, 5.2, 12, 0, 12);
    ctx.bezierCurveTo(-5.2, 12, -9.5, 8.6, -9.5, 3);
    ctx.bezierCurveTo(-9.5, -2.5, -6.5, -12, 0, -12);
    ctx.closePath();
    // Painted zigzag band and dots are holes.
    poly(ctx, [[-9.4, 0], [-6.2, -2.8], [-3.1, 0], [0, -2.8], [3.1, 0], [6.2, -2.8], [9.4, 0], [9.5, 2.6], [6.2, -0.2], [3.1, 2.6], [0, -0.2], [-3.1, 2.6], [-6.2, -0.2], [-9.5, 2.6]]);
    circle(ctx, -3.5, 6.5, 1.3);
    circle(ctx, 3.5, 6.5, 1.3);
    circle(ctx, 0, -6.5, 1.3);
    ctx.fill('evenodd');
  },
  mask: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-12, -3);
    ctx.bezierCurveTo(-11, -8.5, -5, -8, 0, -5);
    ctx.bezierCurveTo(5, -8, 11, -8.5, 12, -3);
    ctx.bezierCurveTo(12.4, 3, 8.5, 6.4, 4.4, 5.4);
    ctx.bezierCurveTo(2.2, 4.8, 1.2, 3.2, 0, 3.2);
    ctx.bezierCurveTo(-1.2, 3.2, -2.2, 4.8, -4.4, 5.4);
    ctx.bezierCurveTo(-8.5, 6.4, -12.4, 3, -12, -3);
    ctx.closePath();
    // Eye holes.
    ctx.moveTo(-2.4, -1.4);
    ctx.bezierCurveTo(-3.4, -3.8, -8, -3.8, -8.6, -1);
    ctx.bezierCurveTo(-7, 1.2, -3.6, 1, -2.4, -1.4);
    ctx.closePath();
    ctx.moveTo(2.4, -1.4);
    ctx.bezierCurveTo(3.4, -3.8, 8, -3.8, 8.6, -1);
    ctx.bezierCurveTo(7, 1.2, 3.6, 1, 2.4, -1.4);
    ctx.closePath();
    ctx.fill('evenodd');
    // Handle stick.
    ctx.beginPath();
    poly(ctx, [[9.6, 4], [11.4, 3.2], [6.2, 12.4], [4.6, 11.8]]);
    ctx.fill();
  },
  mushroom: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-11.5, 0.5);
    ctx.bezierCurveTo(-11.5, -7.5, -6, -11.5, 0, -11.5);
    ctx.bezierCurveTo(6, -11.5, 11.5, -7.5, 11.5, 0.5);
    ctx.closePath();
    // Spots are holes in the cap.
    circle(ctx, -5, -5, 2);
    circle(ctx, 3.5, -7.2, 1.6);
    circle(ctx, 6, -2.4, 1.4);
    ctx.fill('evenodd');
    ctx.beginPath();
    ctx.moveTo(-4.2, 2.2);
    ctx.lineTo(4.2, 2.2);
    ctx.bezierCurveTo(4.6, 6, 5.2, 9, 5.8, 11.8);
    ctx.lineTo(-5.8, 11.8);
    ctx.bezierCurveTo(-5.2, 9, -4.6, 6, -4.2, 2.2);
    ctx.closePath();
    ctx.fill();
  },
  tree: (ctx) => {
    ctx.beginPath();
    poly(ctx, [[0, -12.5], [7.5, -3.5], [4, -3.5], [10, 5], [2, 5], [2, 12], [-2, 12], [-2, 5], [-10, 5], [-4, -3.5], [-7.5, -3.5]]);
    ctx.fill();
  },
};

/** Draws `glyph` centred at (x, y), `size` px wide, in `color`. */
export function drawGlyph(ctx: Ctx, glyph: BadgeGlyph, x: number, y: number, size: number, color: string, rotation = 0) {
  const drawer = GLYPH_DRAWERS[glyph] ?? GLYPH_DRAWERS.star;
  ctx.save();
  ctx.translate(x, y);
  if (rotation) ctx.rotate(rotation);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  drawer(ctx);
  ctx.restore();
}

// ---------- Layout geometry ----------

export type ProfileLayout = LayoutData['layout'];
export type StatKey = 'level' | 'rank' | 'balance';
export interface Circle { cx: number; cy: number; r: number }
export interface Rect { x: number; y: number; w: number; h: number }
export interface StackedStat { key: StatKey; x: number; y: number; align: 'left' | 'center'; size: number }
export type StatBlock =
  | { style: 'stacked'; items: StackedStat[] }
  | { style: 'tiles'; rect: Rect; keys: StatKey[] }
  | { style: 'inline'; cx: number; y: number; keys: StatKey[] };

export interface ProfileGeometry {
  avatar: Circle;
  text: { x: number; align: 'left' | 'center'; maxWidth: number; nameY: number; nameSize: number; titleY: number; bioY: number };
  stats: StatBlock;
  xp: Rect;
  /** Baseline of the server name / XP captions above the bar; null = no captions (XP is part of the inline stats). */
  captionY: number | null;
  /** Right edge and top of the badge row. */
  badges: { right: number; top: number };
  /** Tinted side panel (split layout). */
  panel: Rect | null;
  /** Small server label for layouts without bar captions. */
  serverLabel: { x: number; y: number } | null;
}

export const PROFILE_LAYOUTS: ProfileLayout[] = ['classic', 'compact', 'centered', 'split'];
/** Space a frame may take outside the avatar circle (widest style incl. gap). */
export const FRAME_MAX_OUTSET = 18;
export const BADGE_SIZE = 40;
export const BADGE_GAP = 8;
export const STICKER_RADIUS = 22;
export const STICKER_INSET = 34;

export function profileGeometry(layout: ProfileLayout): ProfileGeometry {
  const badges = { right: W - 40, top: 34 };
  switch (layout) {
    case 'compact':
      return {
        avatar: { cx: 112, cy: 102, r: 58 },
        text: { x: 204, align: 'left', maxWidth: W - 204 - 40, nameY: 92, nameSize: 38, titleY: 124, bioY: 152 },
        stats: { style: 'tiles', rect: { x: 40, y: 184, w: W - 80, h: 70 }, keys: ['level', 'rank', 'balance'] },
        xp: { x: 40, y: 292, w: W - 80, h: 12 },
        captionY: 280,
        badges,
        panel: null,
        serverLabel: null,
      };
    case 'centered':
      return {
        avatar: { cx: W / 2, cy: 94, r: 58 },
        text: { x: W / 2, align: 'center', maxWidth: 760, nameY: 204, nameSize: 40, titleY: 234, bioY: 262 },
        stats: { style: 'inline', cx: W / 2, y: 298, keys: ['level', 'rank', 'balance'] },
        xp: { x: W / 2 - 280, y: 314, w: 560, h: 10 },
        captionY: null,
        badges,
        panel: null,
        serverLabel: { x: 40, y: 50 },
      };
    case 'split':
      return {
        avatar: { cx: 168, cy: 130, r: 82 },
        text: { x: 376, align: 'left', maxWidth: W - 376 - 44, nameY: 104, nameSize: 42, titleY: 138, bioY: 170 },
        stats: {
          style: 'stacked',
          items: [
            { key: 'level', x: 168, y: 262, align: 'center', size: 44 },
            { key: 'rank', x: 376, y: 214, align: 'left', size: 30 },
            { key: 'balance', x: 536, y: 214, align: 'left', size: 30 },
          ],
        },
        xp: { x: 376, y: 292, w: W - 376 - 44, h: 14 },
        captionY: 278,
        badges,
        panel: { x: 0, y: 0, w: 336, h: H },
        serverLabel: null,
      };
    case 'classic':
    default:
      return {
        avatar: { cx: 148, cy: 150, r: 88 },
        text: { x: 284, align: 'left', maxWidth: W - 284 - 44, nameY: 104, nameSize: 44, titleY: 138, bioY: 170 },
        stats: {
          style: 'stacked',
          items: [
            { key: 'level', x: 284, y: 214, align: 'left', size: 30 },
            { key: 'rank', x: 444, y: 214, align: 'left', size: 30 },
            { key: 'balance', x: 604, y: 214, align: 'left', size: 30 },
          ],
        },
        xp: { x: 284, y: 292, w: W - 284 - 44, h: 14 },
        captionY: 278,
        badges,
        panel: null,
        serverLabel: null,
      };
  }
}

/** Centre of a sticker in `corner` of a card of size w×h. */
export function stickerCenter(corner: StickerData['corner'], w = W, h = H): { x: number; y: number } {
  return {
    x: corner === 'tl' || corner === 'bl' ? STICKER_INSET : w - STICKER_INSET,
    y: corner === 'tl' || corner === 'tr' ? STICKER_INSET : h - STICKER_INSET,
  };
}

// ---------- Background ----------

function drawPattern(ctx: Ctx, kind: PatternKind, ink: string, w: number, h: number, rng: () => number) {
  ctx.save();
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  switch (kind) {
    case 'dots':
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      for (let y = 14; y < h; y += 22) for (let x = (y / 22) % 2 ? 14 : 25; x < w; x += 22) circle(ctx, x, y, 1.5);
      ctx.fill();
      break;
    case 'grid':
      ctx.globalAlpha = 0.07;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0.5; x < w; x += 32) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (let y = 0.5; y < h; y += 32) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();
      break;
    case 'waves':
      ctx.globalAlpha = 0.09;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let row = 0, y = 10; y < h + 10; row++, y += 24) {
        for (let x = 0; x <= w; x += 8) {
          const yy = y + Math.sin(x / 46 + row * 0.9) * 6;
          if (x === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
      }
      ctx.stroke();
      break;
    case 'stars':
      for (let i = 0; i < 70; i++) {
        ctx.globalAlpha = 0.12 + rng() * 0.35;
        const size = 1.5 + rng() * 3.5;
        ctx.save();
        ctx.translate(rng() * w, rng() * h);
        ctx.beginPath();
        star(ctx, 4, size, size * 0.3);
        ctx.fill();
        ctx.restore();
      }
      break;
    case 'hex': {
      ctx.globalAlpha = 0.09;
      ctx.lineWidth = 1;
      const r = 20;
      const dx = r * 1.5;
      const dy = r * Math.sqrt(3);
      ctx.beginPath();
      for (let col = 0, x = 0; x < w + r; col++, x += dx) {
        for (let y = col % 2 ? dy / 2 : 0; y < h + r; y += dy) {
          for (let i = 0; i <= 6; i++) {
            const a = (i * Math.PI) / 3;
            if (i === 0) ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
            else ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
          }
        }
      }
      ctx.stroke();
      break;
    }
    case 'diagonal':
      ctx.globalAlpha = 0.07;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = -h; x < w; x += 16) { ctx.moveTo(x, h); ctx.lineTo(x + h, 0); }
      ctx.stroke();
      break;
    case 'circuit': {
      const cell = 36;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.14;
      for (let i = 0; i < 30; i++) {
        let x = Math.floor(rng() * (w / cell)) * cell + 0.5;
        let y = Math.floor(rng() * (h / cell)) * cell + 0.5;
        ctx.beginPath();
        circle(ctx, x, y, 2.6);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x, y);
        let horizontal = rng() < 0.5;
        const steps = 2 + Math.floor(rng() * 3);
        for (let s = 0; s < steps; s++) {
          const length = (1 + Math.floor(rng() * 3)) * cell * (rng() < 0.5 ? -1 : 1);
          if (horizontal) x += length;
          else y += length;
          ctx.lineTo(x, y);
          horizontal = !horizontal;
        }
        ctx.stroke();
        ctx.beginPath();
        circle(ctx, x, y, 3);
        ctx.stroke();
      }
      break;
    }
    case 'none':
      break;
  }
  ctx.restore();
}

function drawBackground(ctx: Ctx, bg: BackgroundData | null, accent: string, w: number, h: number, seed: number) {
  if (!bg) {
    ctx.fillStyle = linearGradient(ctx, 115, 0, 0, w, h, ['#241A12', '#120D09']);
    ctx.fillRect(0, 0, w, h);
    glow(ctx, w * 0.88, -h * 0.25, w * 0.5, accent, 0.2);
    glow(ctx, w * 0.02, h * 1.15, w * 0.38, accent, 0.08);
    return;
  }
  const colors = bg.colors.length ? bg.colors : ['#16151D'];
  const rng = createRng(seed ^ 0x9e3779b9);
  switch (bg.kind) {
    case 'solid':
      ctx.fillStyle = colors[0];
      ctx.fillRect(0, 0, w, h);
      break;
    case 'gradient':
      ctx.fillStyle = linearGradient(ctx, bg.angle, 0, 0, w, h, colors.length > 1 ? colors : [colors[0], darken(colors[0], 0.4)]);
      ctx.fillRect(0, 0, w, h);
      break;
    case 'pattern':
      ctx.fillStyle = linearGradient(ctx, bg.angle, 0, 0, w, h, [colors[0], darken(colors[0], 0.35)]);
      ctx.fillRect(0, 0, w, h);
      break;
    case 'aurora': {
      ctx.fillStyle = linearGradient(ctx, 90, 0, 0, w, h, [mix(colors[0], '#06060B', 0.82), '#07070C']);
      ctx.fillRect(0, 0, w, h);
      colors.forEach((color, i) => {
        for (let k = 0; k <= 6; k++) {
          const x = (w * k) / 6 + (rng() - 0.5) * 60;
          const y = h * (0.22 + 0.16 * Math.sin(k * 0.9 + i * 2.1)) + i * 24;
          glow(ctx, x, y, 150 + rng() * 80, color, 0.22);
        }
      });
      break;
    }
    case 'mesh': {
      ctx.fillStyle = darken(colors[0], 0.25);
      ctx.fillRect(0, 0, w, h);
      const spots: [number, number][] = [[0, 0], [w, h], [w, 0], [0, h], [w * 0.55, h * 0.5]];
      spots.forEach(([x, y], i) => glow(ctx, x, y, w * 0.62, colors[i % colors.length], i === 0 ? 0.9 : 0.75));
      break;
    }
    case 'scene':
      drawScene(ctx, bg.scene ?? 'pixel', colors, w, h);
      break;
  }
  if (bg.pattern !== 'none') drawPattern(ctx, bg.pattern, bg.kind === 'pattern' && colors[1] ? colors[1] : '#FFFFFF', w, h, rng);
  // Readability scrim: keeps white text legible on bright or busy backgrounds.
  const bright = colors.reduce((sum, color) => sum + brightness(color), 0) / colors.length;
  ctx.fillStyle = linearGradient(ctx, 0, 0, 0, w, h, [`rgba(6, 6, 10, ${0.3 + bright * 0.35})`, `rgba(6, 6, 10, ${0.12 + bright * 0.3})`]);
  ctx.fillRect(0, 0, w, h);
}

// ---------- Scene backgrounds ----------

/**
 * Original, genre-inspired illustrations (retro platformer, neon city, moonlit ninja, dungeon, space station, pirate
 * cove) made of plain shapes: no franchise art, logos or names. Detail sits on the right; the left keeps room for the
 * name. Same look for everyone (fixed seed per scene); `colors` = [sky, landscape, light, details].
 */
function drawScene(ctx: Ctx, scene: BackgroundScene, colors: string[], w: number, h: number) {
  const [c0 = '#1B1A2E', c1 = mix(c0, '#FFFFFF', 0.3), c2 = '#FFD166', c3 = darken(c1, 0.4)] = colors;
  const rng = createRng(seedFrom(`scene:${scene}`));
  const sky = (top: string, bottom: string) => { ctx.fillStyle = linearGradient(ctx, 90, 0, 0, w, h, [top, bottom]); ctx.fillRect(0, 0, w, h); };
  const disc = (x: number, y: number, r: number, color: string) => { ctx.beginPath(); circle(ctx, x, y, r); ctx.fillStyle = color; ctx.fill(); };
  ctx.save();
  switch (scene) {
    case 'pixel': {
      const px = Math.max(4, Math.round(h / 40));
      sky(c0, c1);
      // Blocky sun.
      const sx = w * 0.8;
      const sy = h * 0.36;
      const sr = h * 0.2;
      ctx.fillStyle = c2;
      for (let y = sy - sr; y <= sy + sr; y += px) {
        for (let x = sx - sr; x <= sx + sr; x += px) if ((x - sx) ** 2 + (y - sy) ** 2 <= sr * sr) ctx.fillRect(Math.round(x / px) * px, Math.round(y / px) * px, px, px);
      }
      // Clouds as stacks of blocks.
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      for (let i = 0; i < 4; i++) {
        const cx = w * (0.45 + rng() * 0.5);
        const cy = h * (0.12 + rng() * 0.22);
        for (let k = 0; k < 5; k++) ctx.fillRect(Math.round((cx + (k - 2) * px * 2) / px) * px, Math.round((cy - (k % 2) * px) / px) * px, px * 3, px * 2);
      }
      // Two stepped mountain ranges and a grass strip.
      const ridge = (base: number, amp: number, freq: number, color: string) => {
        ctx.fillStyle = color;
        for (let x = 0; x < w; x += px) {
          const top = Math.round((h * base - amp * h * (0.5 + 0.5 * Math.sin(x * freq + 1.3)) * (0.6 + 0.4 * Math.sin(x * freq * 0.37))) / px) * px;
          ctx.fillRect(x, top, px, h - top);
        }
      };
      ridge(0.78, 0.36, 0.006, mix(c3, c1, 0.5));
      ridge(0.9, 0.24, 0.011, c3);
      ctx.fillStyle = lighten(c3, 0.25);
      ctx.fillRect(0, h - px * 3, w, px);
      ctx.fillStyle = darken(c3, 0.35);
      ctx.fillRect(0, h - px * 2, w, px * 2);
      break;
    }
    case 'neon-city': {
      sky(c0, mix(c1, c0, 0.7));
      glow(ctx, w * 0.72, h * 0.74, w * 0.45, c1, 0.5);
      // Striped retro sun on the horizon.
      const sx = w * 0.72;
      const sy = h * 0.6;
      const sr = h * 0.3;
      ctx.save();
      ctx.beginPath();
      ctx.rect(sx - sr, sy - sr, sr * 2, sr);
      ctx.clip();
      ctx.beginPath();
      circle(ctx, sx, sy, sr);
      ctx.fillStyle = linearGradient(ctx, 90, sx - sr, sy - sr, sr * 2, sr, [c2, c1]);
      ctx.fill();
      ctx.fillStyle = mix(c1, c0, 0.6);
      for (let i = 0; i < 5; i++) ctx.fillRect(sx - sr, sy - sr * (0.08 + i * 0.16), sr * 2, 2 + i * 1.6);
      ctx.restore();
      // Skyline with lit windows.
      let x = w * 0.5;
      while (x < w) {
        const bw = h * (0.08 + rng() * 0.14);
        // Lower right under the sun, so it shows above the roofs.
        const nearSun = Math.abs(x + bw / 2 - w * 0.72) < h * 0.34;
        const bh = h * (nearSun ? 0.1 + rng() * 0.12 : 0.22 + rng() * 0.38);
        const top = h * 0.78 - bh;
        ctx.fillStyle = darken(c3, 0.2);
        ctx.fillRect(x, top, bw - 3, bh);
        for (let wy = top + 8; wy < h * 0.76; wy += 11) {
          for (let wx = x + 5; wx < x + bw - 9; wx += 9) {
            if (rng() < 0.45) { ctx.fillStyle = withAlpha(rng() < 0.7 ? c2 : c1, 0.55 + rng() * 0.4); ctx.fillRect(wx, wy, 4, 5); }
          }
        }
        x += bw;
      }
      // Glowing perspective grid.
      const vy = h * 0.78;
      ctx.fillStyle = darken(c0, 0.3);
      ctx.fillRect(0, vy, w, h - vy);
      ctx.strokeStyle = withAlpha(c1, 0.55);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 7; i++) { const y = vy + (h - vy) * (i / 6) ** 1.8; ctx.moveTo(0, y); ctx.lineTo(w, y); }
      for (let i = -12; i <= 12; i++) { ctx.moveTo(w * 0.72, vy); ctx.lineTo(w * 0.72 + i * w * 0.09, h); }
      ctx.stroke();
      break;
    }
    case 'moon-ninja': {
      sky(c0, darken(c0, 0.55));
      glow(ctx, w * 0.78, h * 0.32, h * 0.6, c2, 0.28);
      disc(w * 0.78, h * 0.32, h * 0.21, c2);
      disc(w * 0.74, h * 0.27, h * 0.04, withAlpha(darken(c2, 0.2), 0.5));
      disc(w * 0.82, h * 0.38, h * 0.03, withAlpha(darken(c2, 0.2), 0.45));
      // Mountain ridge.
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, h * 0.78);
      ctx.bezierCurveTo(w * 0.2, h * 0.62, w * 0.35, h * 0.82, w * 0.5, h * 0.66);
      ctx.bezierCurveTo(w * 0.62, h * 0.54, w * 0.78, h * 0.74, w, h * 0.6);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = c1;
      ctx.fill();
      // Bamboo on the right.
      const stalk = darken(c1, 0.55);
      for (let i = 0; i < 6; i++) {
        const bx = w * (0.58 + i * 0.075 + rng() * 0.02);
        const bw = h * (0.028 + rng() * 0.012);
        ctx.fillStyle = stalk;
        ctx.fillRect(bx, -10, bw, h + 20);
        ctx.fillStyle = darken(stalk, 0.35);
        for (let ny = h * (0.1 + rng() * 0.15); ny < h; ny += h * 0.22) ctx.fillRect(bx - 1, ny, bw + 2, 3);
        ctx.fillStyle = stalk;
        for (let k = 0; k < 3; k++) {
          const ly = h * (0.12 + rng() * 0.6);
          const dir = rng() < 0.5 ? -1 : 1;
          ctx.beginPath();
          ctx.moveTo(bx + bw / 2, ly);
          ctx.quadraticCurveTo(bx + dir * h * 0.09, ly - h * 0.05, bx + dir * h * 0.16, ly + h * 0.02);
          ctx.quadraticCurveTo(bx + dir * h * 0.08, ly + h * 0.01, bx + bw / 2, ly);
          ctx.fill();
        }
      }
      // Drifting blossom petals.
      for (let i = 0; i < 26; i++) {
        ctx.globalAlpha = 0.5 + rng() * 0.4;
        ctx.save();
        ctx.translate(w * (0.4 + rng() * 0.6), h * rng());
        ctx.rotate(rng() * TAU);
        ctx.scale(1, 0.55);
        disc(0, 0, 2.5 + rng() * 3, c3);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'dungeon': {
      ctx.fillStyle = darken(c0, 0.2);
      ctx.fillRect(0, 0, w, h);
      // Stone wall: offset rows of rounded bricks.
      const rowH = h / 8;
      const brickW = rowH * 2.1;
      for (let row = 0; row < 9; row++) {
        for (let bx = -(row % 2) * brickW * 0.5; bx < w; bx += brickW) {
          ctx.beginPath();
          box(ctx, bx + 3, row * rowH + 3, brickW - 6, rowH - 6, 5);
          ctx.fillStyle = mix(c1, c0, 0.25 + rng() * 0.45);
          ctx.fill();
        }
      }
      // Two torches throwing warm light.
      for (const tx of [w * 0.62, w * 0.9]) {
        const ty = h * 0.42;
        glow(ctx, tx, ty, h * 0.75, c2, 0.4);
        ctx.fillStyle = darken(c3, 0.3);
        ctx.fillRect(tx - 5, ty, 10, h * 0.18);
        ctx.fillRect(tx - 11, ty, 22, 6);
        drawGlyph(ctx, 'flame', tx, ty - h * 0.07, h * 0.16, c2);
        drawGlyph(ctx, 'flame', tx, ty - h * 0.05, h * 0.08, lighten(c2, 0.5));
      }
      ctx.fillStyle = linearGradient(ctx, 90, 0, h * 0.75, w, h * 0.25, ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.55)']);
      ctx.fillRect(0, h * 0.75, w, h * 0.25);
      break;
    }
    case 'orbital': {
      ctx.fillStyle = c0;
      ctx.fillRect(0, 0, w, h);
      glow(ctx, w * 0.7, h * 0.3, w * 0.4, c1, 0.35);
      glow(ctx, w * 0.95, h * 0.85, w * 0.3, c3, 0.3);
      for (let i = 0; i < 160; i++) {
        ctx.globalAlpha = 0.2 + rng() * 0.7;
        disc(rng() * w, rng() * h, 0.4 + rng() * 1.2, '#FFFFFF');
      }
      ctx.globalAlpha = 1;
      // Ringed planet, low on the right.
      const px = w * 0.84;
      const py = h * 0.78;
      const pr = h * 0.36;
      const ring = (front: boolean) => {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(-0.25);
        ctx.scale(1, 0.24);
        ctx.beginPath();
        ctx.arc(0, 0, pr * 1.55, front ? 0 : Math.PI, front ? Math.PI : TAU);
        ctx.restore();
        ctx.strokeStyle = withAlpha(c2, front ? 0.85 : 0.45);
        ctx.lineWidth = h * 0.035;
        ctx.stroke();
      };
      ring(false);
      ctx.beginPath();
      circle(ctx, px, py, pr);
      const shade = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.5, pr * 0.1, px, py, pr);
      shade.addColorStop(0, lighten(c1, 0.3));
      shade.addColorStop(1, darken(c1, 0.6));
      ctx.fillStyle = shade;
      ctx.fill();
      ring(true);
      disc(w * 0.6, h * 0.24, h * 0.055, c2);
      disc(w * 0.605, h * 0.235, h * 0.045, lighten(c2, 0.35));
      break;
    }
    case 'pirate-cove': {
      sky(c0, mix(c1, c0, 0.4));
      for (let i = 0; i < 50; i++) {
        ctx.globalAlpha = 0.3 + rng() * 0.6;
        disc(rng() * w, rng() * h * 0.55, 0.5 + rng(), '#FFFFFF');
      }
      ctx.globalAlpha = 1;
      glow(ctx, w * 0.8, h * 0.24, h * 0.5, c2, 0.3);
      disc(w * 0.8, h * 0.24, h * 0.12, c2);
      // Sea with a moon path.
      const sea = h * 0.7;
      ctx.fillStyle = c1;
      ctx.fillRect(0, sea, w, h - sea);
      ctx.strokeStyle = withAlpha(lighten(c1, 0.35), 0.5);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const y = sea + 10 + k * ((h - sea) / 5);
        for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.04 + k) * 2.5);
        ctx.moveTo(0, y + 18);
      }
      ctx.stroke();
      ctx.fillStyle = withAlpha(c2, 0.55);
      for (let k = 0; k < 7; k++) ctx.fillRect(w * 0.8 - 24 + rng() * 48 - k * 2, sea + 6 + k * ((h - sea) / 8), 18 + rng() * 22, 2);
      // Ship silhouette.
      const sx = w * 0.62;
      ctx.fillStyle = c3;
      ctx.beginPath();
      poly(ctx, [[sx, sea - 6], [sx + h * 0.62, sea - 6], [sx + h * 0.54, sea + 12], [sx + h * 0.08, sea + 12]]);
      ctx.fill();
      ctx.fillRect(sx + h * 0.2, sea - h * 0.5, 4, h * 0.45);
      ctx.fillRect(sx + h * 0.42, sea - h * 0.4, 4, h * 0.35);
      ctx.beginPath();
      poly(ctx, [[sx + h * 0.06, sea - h * 0.14], [sx + h * 0.2, sea - h * 0.46], [sx + h * 0.32, sea - h * 0.14]]);
      poly(ctx, [[sx + h * 0.3, sea - h * 0.12], [sx + h * 0.42, sea - h * 0.37], [sx + h * 0.55, sea - h * 0.12]]);
      ctx.fill();
      ctx.fillRect(sx + h * 0.2, sea - h * 0.54, 16, 9);
      break;
    }
  }
  ctx.restore();
}

// ---------- Effects ----------

const EFFECT_PALETTE = ['#FF7AA8', '#FFD166', '#7EE7C1', '#7CC8FF'];

/** Effect overlay, seeded per member. `scanlines` belongs on top of the content, everything else under it. */
function drawEffect(ctx: Ctx, effect: EffectData['effect'], accent: string, w: number, h: number, seed: number) {
  const rng = createRng(seed ^ seedFrom(effect));
  ctx.save();
  switch (effect) {
    case 'sparkles':
      for (let i = 0; i < 26; i++) {
        const size = 2.5 + rng() * rng() * 9;
        ctx.globalAlpha = 0.3 + rng() * 0.5;
        ctx.fillStyle = rng() < 0.6 ? '#FFFFFF' : lighten(accent, 0.35);
        ctx.save();
        ctx.translate(rng() * w, rng() * h);
        ctx.beginPath();
        star(ctx, 4, size, size * 0.22);
        ctx.fill();
        ctx.restore();
      }
      break;
    case 'snow':
      ctx.fillStyle = '#FFFFFF';
      for (let i = 0; i < 110; i++) {
        ctx.globalAlpha = 0.18 + rng() * 0.55;
        ctx.beginPath();
        circle(ctx, rng() * w, Math.pow(rng(), 1.4) * h, 0.7 + rng() * 2.4);
        ctx.fill();
      }
      break;
    case 'confetti': {
      const palette = [...EFFECT_PALETTE, accent];
      for (let i = 0; i < 40; i++) {
        ctx.globalAlpha = 0.45 + rng() * 0.35;
        ctx.fillStyle = palette[Math.floor(rng() * palette.length)];
        ctx.save();
        ctx.translate(rng() * w, rng() * h);
        ctx.rotate(rng() * TAU);
        ctx.fillRect(-1.6, -4.5, 3.2, 9);
        ctx.restore();
      }
      break;
    }
    case 'aurora': {
      const colors = ['#5EEAD4', '#7CC8FF', accent];
      ctx.lineCap = 'round';
      colors.forEach((color, i) => {
        const base = h * (0.12 + i * 0.1);
        for (const [width, alpha] of [[70, 0.06], [34, 0.06], [10, 0.07]] as const) {
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = color;
          ctx.lineWidth = width;
          ctx.beginPath();
          for (let x = -20; x <= w + 20; x += 16) {
            const y = base + Math.sin(x / 140 + i * 1.7 + rng() * 0.04) * 22;
            if (x === -20) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      });
      break;
    }
    case 'scanlines':
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
      ctx.fillStyle = withAlpha(accent, 0.03);
      ctx.fillRect(0, 0, w, h);
      break;
    case 'stardust':
      ctx.fillStyle = '#FFFFFF';
      for (let i = 0; i < 220; i++) {
        ctx.globalAlpha = 0.12 + rng() * 0.5;
        ctx.beginPath();
        circle(ctx, rng() * w, rng() * h, 0.4 + rng() * 1);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < 6; i++) glow(ctx, rng() * w, rng() * h, 5 + rng() * 6, lighten(accent, 0.5), 0.6);
      break;
    case 'embers':
      for (let i = 0; i < 45; i++) {
        const color = ['#FF8A3D', '#FFB347', '#FF5E3A'][Math.floor(rng() * 3)];
        ctx.globalAlpha = 0.35 + rng() * 0.5;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        circle(ctx, rng() * w, h * (1 - rng() * rng()), 0.8 + rng() * 2);
        ctx.fill();
      }
      break;
    case 'hearts':
      for (let i = 0; i < 18; i++) {
        ctx.globalAlpha = 0.16 + rng() * 0.3;
        drawGlyph(ctx, 'heart', rng() * w, rng() * h, 8 + rng() * 12, rng() < 0.5 ? '#FF7AB6' : lighten(accent, 0.3), (rng() - 0.5) * 0.8);
      }
      break;
    case 'leaves':
      // Falling leaves in moss, fern and autumn amber.
      for (let i = 0; i < 22; i++) {
        ctx.globalAlpha = 0.22 + rng() * 0.38;
        const color = ['#8FB36B', '#5FA35A', '#C98A4B', '#E0A85A'][Math.floor(rng() * 4)];
        drawGlyph(ctx, 'leaf', rng() * w, rng() * h, 9 + rng() * 13, color, rng() * Math.PI * 2);
      }
      break;
  }
  ctx.restore();
}

// ---------- Avatar + frame ----------

function drawCover(ctx: Ctx, image: ProfileImage, x: number, y: number, w: number, h: number) {
  if (!image.width || !image.height) return;
  const scale = Math.max(w / image.width, h / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function ring(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
}

function drawAvatar(ctx: Ctx, image: ProfileImage | null, { cx, cy, r }: Circle, frame: FrameData | null, accent: string, name: string) {
  const colors = frame?.colors.length ? frame.colors : [accent];
  const width = frame ? Math.min(12, Math.max(2, frame.width)) : 3;
  const c0 = colors[0];
  const c1 = colors[1] ?? lighten(c0, 0.45);

  // Soft drop shadow under the avatar.
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = '#1A130D';
  ring(ctx, cx, cy, r);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ring(ctx, cx, cy, r);
  ctx.clip();
  if (image) {
    drawCover(ctx, image, cx - r, cy - r, r * 2, r * 2);
  } else {
    const gradient = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.5, 0, cx, cy, r * 1.3);
    gradient.addColorStop(0, mix(accent, '#33261B', 0.35));
    gradient.addColorStop(1, '#1D150F');
    ctx.fillStyle = gradient;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.font = font('inter', 700, Math.round(r * 0.9));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((Array.from(name.trim())[0] ?? '?').toUpperCase(), cx, cy + r * 0.04);
  }
  ctx.restore();

  ctx.save();
  ctx.lineCap = 'round';
  const at = r + 3 + width / 2;
  if (!frame) {
    ctx.strokeStyle = withAlpha(accent, 0.9);
    ctx.lineWidth = width;
    ring(ctx, cx, cy, r + 5);
    ctx.stroke();
    ctx.strokeStyle = withAlpha(accent, 0.22);
    ctx.lineWidth = 1;
    ring(ctx, cx, cy, r + 12);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const gradient = () => linearGradient(ctx, 45, cx - at, cy - at, at * 2, at * 2, colors.length > 1 ? colors : [c0, c1]);
  ctx.lineWidth = width;
  switch (frame.style) {
    case 'solid':
      ctx.strokeStyle = c0;
      ring(ctx, cx, cy, at);
      ctx.stroke();
      break;
    case 'gradient':
      ctx.strokeStyle = gradient();
      ring(ctx, cx, cy, at);
      ctx.stroke();
      break;
    case 'glow':
      ctx.shadowColor = c0;
      ctx.shadowBlur = 10 + width * 2;
      ctx.strokeStyle = colors.length > 1 ? gradient() : c0;
      ring(ctx, cx, cy, at);
      ctx.stroke();
      ctx.stroke();
      break;
    case 'double':
      ctx.lineWidth = Math.max(1.5, width * 0.55);
      ctx.strokeStyle = c0;
      ring(ctx, cx, cy, r + 3 + ctx.lineWidth / 2);
      ctx.stroke();
      ctx.strokeStyle = colors[1] ?? c0;
      ring(ctx, cx, cy, r + 6 + ctx.lineWidth * 1.5);
      ctx.stroke();
      break;
    case 'dashed':
      ctx.setLineDash([width * 2.2, width * 1.6]);
      ctx.strokeStyle = colors.length > 1 ? gradient() : c0;
      ring(ctx, cx, cy, at + 1);
      ctx.stroke();
      break;
    case 'neon':
      ctx.shadowColor = c0;
      ctx.shadowBlur = 22;
      ctx.strokeStyle = c0;
      ring(ctx, cx, cy, at);
      ctx.stroke();
      ctx.stroke();
      ctx.shadowBlur = 6;
      ctx.lineWidth = Math.max(1.2, width / 3);
      ctx.strokeStyle = colors[1] ?? '#FFFFFF';
      ring(ctx, cx, cy, at);
      ctx.stroke();
      break;
    case 'crown':
      ctx.strokeStyle = gradient();
      ring(ctx, cx, cy, at);
      ctx.stroke();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
      drawGlyph(ctx, 'crown', cx + r * 0.62, cy - r * 0.84, Math.max(30, r * 0.62), c0, 0.42);
      break;
  }
  ctx.restore();
}

// ---------- Text pieces ----------

/** `amber` draws the Bernis currency icon (shared/amber.ts) instead of text or a badge glyph. */
interface Run { text?: string; glyph?: BadgeGlyph; amber?: boolean; font: string; color: string; size?: number; gap?: number }

function runWidths(ctx: Ctx, runs: Run[]): number[] {
  return runs.map((run) => {
    if (run.glyph || run.amber) return (run.size ?? 16) + (run.gap ?? 6);
    ctx.font = run.font;
    return ctx.measureText(run.text ?? '').width + (run.gap ?? 0);
  });
}
const measureRuns = (ctx: Ctx, runs: Run[]) => runWidths(ctx, runs).reduce((sum, width) => sum + width, 0);

/** Draws runs of differently styled text (and glyphs) on one baseline. Returns the total width. */
function drawRuns(ctx: Ctx, runs: Run[], x: number, y: number, align: 'left' | 'center' | 'right'): number {
  const widths = runWidths(ctx, runs);
  const total = widths.reduce((sum, width) => sum + width, 0);
  let cursor = align === 'left' ? x : align === 'center' ? x - total / 2 : x - total;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  runs.forEach((run, index) => {
    if (run.amber) {
      const size = run.size ?? 16;
      drawAmber(ctx, cursor + size / 2, y - size * 0.36, size * 1.15);
    } else if (run.glyph) {
      const size = run.size ?? 16;
      drawGlyph(ctx, run.glyph, cursor + size / 2, y - size * 0.36, size, run.color);
    } else {
      ctx.font = run.font;
      ctx.fillStyle = run.color;
      ctx.fillText(run.text ?? '', cursor, y);
    }
    cursor += widths[index];
  });
  return total;
}

function drawName(
  ctx: Ctx, text: string, x: number, y: number, align: 'left' | 'center' | 'right', size: number, key: FontKey,
  style: NameStyleData | null, maxWidth: number,
) {
  const scaled = Math.round(size * fontScale(key));
  const fitted = fitText(ctx, text, key, 700, scaled, Math.round(scaled * 0.6), maxWidth);
  const width = ctx.measureText(fitted.text).width;
  const left = align === 'left' ? x : align === 'center' ? x - width / 2 : x - width;
  const colors = style?.colors.length ? style.colors : [TEXT];
  ctx.save();
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = colors.length > 1 ? linearGradient(ctx, 0, left, y - fitted.size, Math.max(1, width), fitted.size, colors) : colors[0];
  if (style?.glow) {
    ctx.shadowColor = withAlpha(colors[0], 0.75);
    ctx.shadowBlur = Math.round(fitted.size * 0.5);
  } else {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 2;
  }
  ctx.fillText(fitted.text, x, y);
  ctx.restore();
}

const STAT_LABELS: Record<StatKey, string> = { level: 'LEVEL', rank: 'RANG', balance: 'BERNIS' };

function statValue(key: StatKey, subject: ProfileCardSubject): string {
  if (key === 'level') return String(subject.level);
  if (key === 'rank') return subject.rank ? `#${subject.rank}` : '–';
  return formatNumber(subject.balance);
}

function valueRuns(key: StatKey, subject: ProfileCardSubject, size: number, accent: string): Run[] {
  const value = { text: statValue(key, subject), font: font('inter', 700, size), color: key === 'level' ? lighten(accent, 0.2) : TEXT };
  return key === 'balance' ? [{ amber: true, size: Math.round(size * 0.66), color: accent, font: '', gap: Math.round(size * 0.36) }, value] : [value];
}

function drawStats(ctx: Ctx, block: StatBlock, subject: ProfileCardSubject, accent: string) {
  const label = (key: StatKey, size = 12): Run => ({ text: STAT_LABELS[key], font: font('inter', 700, size), color: FAINT });
  ctx.save();
  if (block.style === 'stacked') {
    for (const item of block.items) {
      drawRuns(ctx, [label(item.key, item.size > 36 ? 13 : 12)], item.x, item.y, item.align);
      drawRuns(ctx, valueRuns(item.key, subject, item.size, accent), item.x, item.y + 10 + item.size * 0.8, item.align);
    }
  } else if (block.style === 'tiles') {
    const gap = 14;
    const tileW = (block.rect.w - gap * (block.keys.length - 1)) / block.keys.length;
    block.keys.forEach((key, index) => {
      const x = block.rect.x + index * (tileW + gap);
      roundedRect(ctx, x, block.rect.y, tileW, block.rect.h, 16);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.lineWidth = 1;
      ctx.stroke();
      drawRuns(ctx, [label(key)], x + 20, block.rect.y + 26, 'left');
      drawRuns(ctx, valueRuns(key, subject, 26, accent), x + 20, block.rect.y + 57, 'left');
    });
  } else {
    const separator: Run = { text: '·', font: font('inter', 700, 18), color: FAINT, gap: 18 };
    const runs: Run[] = [];
    block.keys.forEach((key, index) => {
      if (index) runs.push(separator);
      runs.push({ ...label(key), gap: 8 }, ...valueRuns(key, subject, 19, accent).map((run, i, all) => (i === all.length - 1 ? { ...run, gap: 18 } : run)));
    });
    runs.push(separator,
      { text: formatNumber(subject.xp), font: font('inter', 700, 16), color: SOFT },
      { text: ` / ${formatNumber(subject.xpNeeded)} XP`, font: font('inter', 400, 16), color: MUTED });
    drawRuns(ctx, runs, block.cx, block.y, 'center');
  }
  ctx.restore();
}

// ---------- XP bar ----------

function drawXpBar(ctx: Ctx, { x, y, w, h }: Rect, fraction: number, style: XpBarData | null, accent: string) {
  const colors = style?.colors.length ? style.colors : [accent, lighten(accent, 0.4)];
  const pair = colors.length > 1 ? colors : [colors[0], lighten(colors[0], 0.35)];
  const r = h / 2;
  ctx.save();
  if (style?.style === 'segmented') {
    const count = 24;
    const gap = 4;
    const segW = (w - gap * (count - 1)) / count;
    const filled = Math.round(fraction * count);
    const gradient = linearGradient(ctx, 0, x, y, w, h, pair);
    for (let i = 0; i < count; i++) {
      roundedRect(ctx, x + i * (segW + gap), y, segW, h, Math.min(3, r));
      ctx.fillStyle = i < filled ? gradient : 'rgba(255, 255, 255, 0.08)';
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  roundedRect(ctx, x, y, w, h, r);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fill();
  if (fraction <= 0) { ctx.restore(); return; }
  const fw = Math.max(h, w * fraction);
  const kind = style?.style ?? 'gradient';
  ctx.fillStyle = kind === 'solid' ? colors[0] : linearGradient(ctx, 0, x, y, kind === 'gradient' && style ? w : fw, h, pair);
  if (kind === 'glow') {
    ctx.shadowColor = withAlpha(colors[0], 0.85);
    ctx.shadowBlur = 16;
  }
  roundedRect(ctx, x, y, fw, h, r);
  ctx.fill();
  if (kind === 'striped') {
    ctx.save();
    roundedRect(ctx, x, y, fw, h, r);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let sx = x - h; sx < x + fw + h; sx += 13) { ctx.moveTo(sx, y + h); ctx.lineTo(sx + h, y); }
    ctx.stroke();
    ctx.restore();
  }
  if (kind === 'glow') {
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    circle(ctx, x + fw - r, y + r, r * 0.55);
    ctx.fill();
  }
  ctx.restore();
}

// ---------- Badges + sticker ----------

/** Draws the badge row right-aligned at `right`; returns its width. */
function drawBadges(ctx: Ctx, badges: BadgeData[], right: number, top: number): number {
  const shown = badges.slice(0, 3);
  shown.forEach((badge, index) => {
    const x = right - (shown.length - index) * (BADGE_SIZE + BADGE_GAP) + BADGE_GAP;
    ctx.save();
    roundedRect(ctx, x, top, BADGE_SIZE, BADGE_SIZE, 12);
    ctx.fillStyle = withAlpha(badge.color, 0.14);
    ctx.fill();
    ctx.strokeStyle = withAlpha(badge.color, 0.42);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    drawGlyph(ctx, badge.glyph, x + BADGE_SIZE / 2, top + BADGE_SIZE / 2, 22, badge.color);
  });
  return shown.length ? shown.length * (BADGE_SIZE + BADGE_GAP) - BADGE_GAP : 0;
}

function drawSticker(ctx: Ctx, sticker: StickerData, w: number, h: number) {
  const { x, y } = stickerCenter(sticker.corner, w, h);
  const rotation = { tl: -0.22, tr: 0.22, bl: 0.16, br: -0.16 }[sticker.corner];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.beginPath();
  circle(ctx, 0, 0, STICKER_RADIUS);
  ctx.fillStyle = sticker.color;
  ctx.fill();
  resetShadow(ctx);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3;
  ctx.stroke();
  drawGlyph(ctx, sticker.glyph, 0, 0, 24, brightness(sticker.color) > 0.62 ? '#17151F' : '#FFFFFF');
  ctx.restore();
}

// ---------- Item preview ----------

export const ITEM_PREVIEW_WIDTH = 320;
export const ITEM_PREVIEW_HEIGHT = 240;

/**
 * Shop/inventory tile of one item, painted with the same functions as the card, so a badge, sticker, frame or effect
 * looks exactly like it will on the card (frames around the member's own avatar). Transparent except for
 * backgrounds, so the tile's own backdrop shows through. Returns false for slots without a painted preview
 * (level-up style, layout); the dashboard draws those itself.
 */
export function renderItemPreview<I extends ProfileImage>(
  context: ProfileContext<NoInfer<I>>, item: CosmeticItem, subject: { name: string; username: string }, assets: ProfileAssets<I>,
  w = ITEM_PREVIEW_WIDTH, h = ITEM_PREVIEW_HEIGHT,
): boolean {
  const ctx: Ctx = context;
  const seed = seedFrom(subject.username || subject.name);
  const accent = item.slot === 'accent' ? item.data.color : DEFAULT_ACCENT;
  const avatar = (r: number, cy = h / 2) => ({ cx: w / 2, cy, r });
  // Small items are drawn larger than on the card so they read on a tile.
  const zoomAt = (zoom: number) => { ctx.translate(w / 2, h / 2); ctx.scale(zoom, zoom); };
  ctx.save();
  switch (item.slot) {
    case 'background': drawBackground(ctx, item.data, accent, w, h, seed); break;
    case 'effect': drawEffect(ctx, item.data.effect, accent, w, h, seed); break;
    case 'frame': drawAvatar(ctx, assets.avatar, avatar(h * 0.27), item.data, accent, subject.name); break;
    case 'accent':
      drawAvatar(ctx, assets.avatar, avatar(h * 0.2, h * 0.4), null, accent, subject.name);
      drawXpBar(ctx, { x: w * 0.2, y: h * 0.74, w: w * 0.6, h: 12 }, 0.62, null, accent);
      break;
    case 'badge': zoomAt(2.2); drawBadges(ctx, [item.data], BADGE_SIZE / 2, -BADGE_SIZE / 2); break;
    case 'sticker': {
      const at = stickerCenter(item.data.corner, w, h);
      zoomAt(1.9);
      ctx.translate(-at.x, -at.y);
      drawSticker(ctx, item.data, w, h);
      break;
    }
    case 'xpBar': drawXpBar(ctx, { x: w * 0.12, y: h / 2 - 10, w: w * 0.76, h: 20 }, 0.66, item.data, accent); break;
    case 'nameStyle': drawName(ctx, subject.name, w / 2, h / 2 + 14, 'center', 44, 'inter', item.data, w * 0.86); break;
    case 'font': drawName(ctx, subject.name, w / 2, h / 2 + 14, 'center', 44, item.data.font, null, w * 0.86); break;
    case 'title': drawRuns(ctx, [{ text: item.data.text, font: font('inter', 700, 26), color: item.data.color }], w / 2, h / 2 + 9, 'center'); break;
    default: ctx.restore(); return false;
  }
  ctx.restore();
  return true;
}

// ---------- Profile card ----------

/** Draws the profile card at 1024×360 onto `ctx`. All cosmetics null = Nexo's default look. */
export function renderProfileCard<I extends ProfileImage>(
  context: ProfileContext<NoInfer<I>>, subject: ProfileCardSubject, cosmetics: ResolvedCosmetics, assets: ProfileAssets<I>,
): void {
  const ctx: Ctx = context;
  const g = profileGeometry(cosmetics.layout?.layout ?? 'classic');
  const accent = cosmetics.accent?.color ?? DEFAULT_ACCENT;
  const seed = seedFrom(subject.username || subject.name);
  const effect = cosmetics.effect?.effect ?? null;
  const sticker = cosmetics.sticker;
  const fontKey: FontKey = cosmetics.font?.font ?? 'inter';

  ctx.save();
  roundedRect(ctx, 0, 0, W, H, RADIUS);
  ctx.clip();
  drawBackground(ctx, cosmetics.background, accent, W, H, seed);
  if (effect && effect !== 'scanlines') drawEffect(ctx, effect, accent, W, H, seed);

  if (g.panel) {
    ctx.fillStyle = linearGradient(ctx, 90, g.panel.x, g.panel.y, g.panel.w, g.panel.h, [withAlpha(accent, 0.1), 'rgba(255, 255, 255, 0.02)']);
    ctx.fillRect(g.panel.x, g.panel.y, g.panel.w, g.panel.h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.fillRect(g.panel.x + g.panel.w - 1, 0, 1, H);
  }

  drawAvatar(ctx, assets.avatar, g.avatar, cosmetics.frame, accent, subject.name);

  const badgeRight = g.badges.right - (sticker?.corner === 'tr' ? 2 * STICKER_RADIUS + 8 : 0);
  const badgeWidth = drawBadges(ctx, cosmetics.badges, badgeRight, g.badges.top);

  const bio = subject.bio.trim().replace(/\s+/g, ' ');
  // Without a bio the name block moves down a little so the gap above the stats does not look empty.
  const shift = bio ? 0 : 14;
  const { text } = g;
  const nameMax = text.align === 'left' && badgeWidth
    ? Math.min(text.maxWidth, badgeRight - badgeWidth - 24 - text.x)
    : text.maxWidth;
  drawName(ctx, subject.name, text.x, text.nameY + shift, text.align, text.nameSize, fontKey, cosmetics.nameStyle, nameMax);

  const handle = subject.username ? `@${subject.username}` : '';
  const titleRuns: Run[] = cosmetics.title
    ? [{ text: cosmetics.title.text, font: font('inter', 700, 18), color: cosmetics.title.color, gap: handle ? 10 : 0 },
      ...(handle ? [{ text: `·  ${handle}`, font: font('inter', 400, 17), color: MUTED }] : [])]
    : [{ text: handle, font: font('inter', 400, 18), color: MUTED }];
  drawRuns(ctx, titleRuns, text.x, text.titleY + shift, text.align);

  if (bio) {
    const fitted = fitText(ctx, bio, 'inter', 400, 17, 17, text.maxWidth);
    drawRuns(ctx, [{ text: fitted.text, font: font('inter', 400, 17), color: SOFT }], text.x, text.bioY, text.align);
  }

  drawStats(ctx, g.stats, subject, accent);

  const fraction = xpFraction(subject.xp, subject.xpNeeded);
  if (g.captionY !== null) {
    const xpRuns: Run[] = [
      { text: formatNumber(subject.xp), font: font('inter', 700, 15), color: SOFT },
      { text: ` / ${formatNumber(subject.xpNeeded)} XP`, font: font('inter', 400, 15), color: MUTED },
    ];
    const xpWidth = drawRuns(ctx, xpRuns, g.xp.x + g.xp.w, g.captionY, 'right');
    if (subject.serverName) {
      const fitted = fitText(ctx, subject.serverName, 'inter', 400, 15, 15, g.xp.w - xpWidth - 24);
      drawRuns(ctx, [{ text: fitted.text, font: font('inter', 400, 15), color: MUTED }], g.xp.x, g.captionY, 'left');
    }
  }
  drawXpBar(ctx, g.xp, fraction, cosmetics.xpBar, accent);

  if (g.serverLabel && subject.serverName) {
    const x = g.serverLabel.x + (sticker?.corner === 'tl' ? 2 * STICKER_RADIUS + 8 : 0);
    const fitted = fitText(ctx, subject.serverName.toUpperCase(), 'inter', 700, 12, 12, 300);
    drawRuns(ctx, [{ text: fitted.text, font: font('inter', 700, 12), color: FAINT }], x, g.serverLabel.y, 'left');
  }

  if (effect === 'scanlines') drawEffect(ctx, effect, accent, W, H, seed);
  if (sticker) drawSticker(ctx, sticker, W, H);
  ctx.restore();

  ctx.save();
  roundedRect(ctx, 0.5, 0.5, W - 1, H - 1, RADIUS);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

// ---------- Level-up card ----------

export type LevelUpStyle = LevelupData['style'];
export const LEVELUP_STYLES: LevelUpStyle[] = ['classic', 'minimal', 'neon', 'royal', 'retro'];
const GOLD = '#E9C46A';
const LW = LEVELUP_CARD_WIDTH;
const LH = LEVELUP_CARD_HEIGHT;

function drawLevelUpBackground(ctx: Ctx, style: LevelUpStyle, color: string) {
  switch (style) {
    case 'minimal':
      ctx.fillStyle = '#121217';
      ctx.fillRect(0, 0, LW, LH);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 6, LH);
      break;
    case 'neon':
      ctx.fillStyle = '#07060D';
      ctx.fillRect(0, 0, LW, LH);
      glow(ctx, 120, 120, 240, color, 0.18);
      glow(ctx, LW - 140, LH / 2, 260, color, 0.12);
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      roundedRect(ctx, 10, 10, LW - 20, LH - 20, 18);
      ctx.stroke();
      ctx.restore();
      break;
    case 'royal':
      ctx.fillStyle = linearGradient(ctx, 25, 0, 0, LW, LH, ['#1C1236', '#2B1848', '#1A1030']);
      ctx.fillRect(0, 0, LW, LH);
      glow(ctx, 120, 120, 260, color, 0.2);
      glow(ctx, LW - 150, 40, 220, GOLD, 0.12);
      ctx.save();
      ctx.strokeStyle = withAlpha(GOLD, 0.85);
      ctx.lineWidth = 2;
      roundedRect(ctx, 10, 10, LW - 20, LH - 20, 16);
      ctx.stroke();
      ctx.strokeStyle = withAlpha(GOLD, 0.35);
      ctx.lineWidth = 1;
      roundedRect(ctx, 16, 16, LW - 32, LH - 32, 12);
      ctx.stroke();
      ctx.restore();
      break;
    case 'retro': {
      ctx.fillStyle = linearGradient(ctx, 90, 0, 0, LW, LH, ['#160A33', '#2E0B45', '#45114F']);
      ctx.fillRect(0, 0, LW, LH);
      // Sun with horizontal cuts.
      const sx = 725;
      const sy = 128;
      const sr = 86;
      ctx.save();
      ctx.beginPath();
      circle(ctx, sx, sy, sr);
      ctx.clip();
      ctx.fillStyle = linearGradient(ctx, 90, sx - sr, sy - sr, sr * 2, sr * 2, ['#FFD166', '#FF5FA2']);
      ctx.fillRect(sx - sr, sy - sr, sr * 2, sr);
      // Below the middle: bands that get thinner while the gaps grow.
      for (let y = sy, i = 0; y < sy + sr; i++) {
        const band = Math.max(3, 11 - i * 1.6);
        ctx.fillRect(sx - sr, y, sr * 2, band);
        y += band + 2 + i * 1.2;
      }
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = linearGradient(ctx, 90, 0, 172, LW, LH - 172, ['#1A0830', '#2A0A3E']);
      ctx.fillRect(0, 172, LW, LH - 172);
      ctx.restore();
      // Perspective grid below the horizon.
      ctx.save();
      ctx.strokeStyle = withAlpha(color, 0.55);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const horizon = 172;
      for (let i = -14; i <= 14; i++) { ctx.moveTo(LW / 2 + i * 22, horizon); ctx.lineTo(LW / 2 + i * 110, LH); }
      for (let k = 1; k <= 6; k++) { const y = horizon + Math.pow(k / 6, 1.8) * (LH - horizon); ctx.moveTo(0, y); ctx.lineTo(LW, y); }
      ctx.stroke();
      ctx.strokeStyle = withAlpha(color, 0.9);
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      ctx.lineTo(LW, horizon);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'classic':
    default:
      ctx.fillStyle = linearGradient(ctx, 115, 0, 0, LW, LH, ['#241A12', '#120D09']);
      ctx.fillRect(0, 0, LW, LH);
      glow(ctx, 120, 120, 280, color, 0.26);
      glow(ctx, LW - 120, LH + 40, 260, color, 0.12);
      break;
  }
}

/** Draws the level-up card at 900×240 onto `ctx` in the member's level-up style. */
export function renderLevelUpCard<I extends ProfileImage>(
  context: ProfileContext<NoInfer<I>>, subject: ProfileCardSubject, cosmetics: ResolvedCosmetics, newLevel: number, reward: number,
  assets: ProfileAssets<I> = { avatar: null },
): void {
  const ctx: Ctx = context;
  const style: LevelUpStyle = cosmetics.levelup?.style ?? 'classic';
  const color = cosmetics.levelup?.color ?? cosmetics.accent?.color ?? DEFAULT_ACCENT;
  const highlight = style === 'royal' ? GOLD : color;
  const fontKey: FontKey = cosmetics.font?.font ?? 'inter';

  ctx.save();
  roundedRect(ctx, 0, 0, LW, LH, 24);
  ctx.clip();
  drawLevelUpBackground(ctx, style, color);
  const effect = cosmetics.effect?.effect;
  if (effect && effect !== 'scanlines' && style !== 'minimal') drawEffect(ctx, effect, color, LW, LH, seedFrom(subject.username || subject.name));

  const frame: FrameData | null = cosmetics.frame
    ?? (style === 'royal' ? { style: 'solid', colors: [GOLD], width: 3 } : style === 'neon' ? { style: 'neon', colors: [color], width: 3 } : null);
  drawAvatar(ctx, assets.avatar, { cx: 120, cy: 120, r: 68 }, frame, color, subject.name);

  // Big level number on the right.
  const numberFont: FontKey = 'unbounded';
  const levelText = String(newLevel);
  const fitted = fitText(ctx, levelText, numberFont, 700, 92, 48, 300);
  const numberWidth = ctx.measureText(fitted.text).width;
  const right = LW - 52;
  const baseline = 168;
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font(numberFont, 700, fitted.size);
  if (style === 'retro') {
    ctx.fillStyle = withAlpha(color, 0.9);
    ctx.fillText(fitted.text, right + 4, baseline + 4);
    ctx.fillStyle = '#FFF4F9';
  } else if (style === 'neon') {
    ctx.shadowColor = color;
    ctx.shadowBlur = 26;
    ctx.fillStyle = lighten(color, 0.55);
    ctx.fillText(fitted.text, right, baseline);
  } else if (style === 'minimal') {
    ctx.fillStyle = TEXT;
  } else {
    ctx.fillStyle = linearGradient(ctx, 90, right - numberWidth, baseline - fitted.size, numberWidth, fitted.size,
      style === 'royal' ? ['#F8E6A8', '#C99A3D'] : [lighten(color, 0.55), color]);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
  }
  ctx.fillText(fitted.text, right, baseline);
  ctx.restore();
  const levelLabel: Run[] = style === 'royal'
    ? [{ glyph: 'crown', size: 18, color: GOLD, font: '', gap: 8 }, { text: 'LEVEL', font: font('inter', 700, 14), color: GOLD }]
    : [{ text: 'LEVEL', font: font('inter', 700, 14), color: style === 'minimal' ? FAINT : withAlpha(lighten(color, 0.3), 0.9) }];
  drawRuns(ctx, levelLabel, right, baseline - fitted.size * 0.84 - 14, 'right');

  // Text column.
  const x = 222;
  const textMax = right - numberWidth - 36 - x;
  drawRuns(ctx, [{ text: 'LEVEL UP', font: font(style === 'retro' ? 'unbounded' : 'inter', 700, 14), color: highlight }], x, 76, 'left');
  drawName(ctx, subject.name, x, 120, 'left', 34, fontKey, cosmetics.nameStyle, textMax);
  const sub = subject.serverName ? `Neues Level auf ${subject.serverName}` : 'Neues Level erreicht';
  const subFit = fitText(ctx, sub, 'inter', 400, 16, 16, textMax);
  drawRuns(ctx, [{ text: subFit.text, font: font('inter', 400, 16), color: MUTED }], x, 150, 'left');

  if (reward > 0) {
    const runs: Run[] = [
      { amber: true, size: 16, color: highlight, font: '', gap: 11 },
      { text: `+${formatNumber(reward)}`, font: font('inter', 700, 16), color: TEXT, gap: 6 },
      { text: 'Bernis', font: font('inter', 400, 16), color: SOFT },
    ];
    const pillW = measureRuns(ctx, runs) + 32;
    roundedRect(ctx, x, 168, pillW, 36, 18);
    ctx.fillStyle = withAlpha(highlight, 0.14);
    ctx.fill();
    ctx.strokeStyle = withAlpha(highlight, 0.4);
    ctx.lineWidth = 1;
    ctx.stroke();
    drawRuns(ctx, runs, x + 16, 192, 'left');
  }

  if (effect === 'scanlines') drawEffect(ctx, effect, color, LW, LH, 0);
  ctx.restore();

  if (style !== 'neon' && style !== 'royal') {
    ctx.save();
    roundedRect(ctx, 0.5, 0.5, LW - 1, LH - 1, 24);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}
