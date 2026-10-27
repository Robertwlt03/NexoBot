// Companions ("Begleiter") for the profile card: small animals that sit at the lower left of the avatar and evolve when
// their owner looks after them. Drawn on canvas in a 100×100 design box centred on (0, 0) with the ground at y = 50,
// scaled to the requested size. Shared by the bot and the dashboard.
//
// Care, after the CS2 chickens: food comes only from finishing all three daily quests (never bought), at most
// PET_FOOD_MAX portions in stock, and each pet eats once per Berlin day. Every feeding is a care day; the care days
// decide the stage. Two days without food and the pet is hungry: it looks sad and, since only feeding counts, stops
// growing until it is fed again.

import type { PetData } from './cosmetics.js';

/** The canvas calls the drawer needs (a subset of the profile card context). */
interface PetCtx {
  fillStyle: string | object; strokeStyle: string | object; lineWidth: number; lineCap: string; lineJoin: string; globalAlpha: number;
  save(): void; restore(): void; beginPath(): void; closePath(): void;
  moveTo(x: number, y: number): void; lineTo(x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void;
  fill(): void; stroke(): void; translate(x: number, y: number): void; rotate(a: number): void; scale(x: number, y: number): void;
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): { addColorStop(offset: number, color: string): void };
}

/** A fill: a colour or a gradient from the context. */
type Paint = string | object;

// ---------- Care ----------

export type PetStage = 1 | 2 | 3 | 4;
export const PET_STAGE_NAMES = ['Jungtier', 'Halbstark', 'Ausgewachsen', 'Legendär'] as const;
/** Care days from which each stage starts. */
export const PET_STAGE_CARE = [0, 5, 15, 40] as const;
/** Food portions a member can keep in stock. */
export const PET_FOOD_MAX = 3;
/** Days without food after which a pet is hungry. */
export const PET_HUNGRY_AFTER = 2;

/** Stage from the care days (feedings) of a pet. */
export function petStage(care: number): PetStage {
  return (PET_STAGE_CARE.filter((from) => care >= from).length as PetStage);
}
/** Care days the next stage needs, or null at the last stage. */
export function nextStageAt(care: number): number | null {
  return PET_STAGE_CARE.find((from) => from > care) ?? null;
}

/** Whole days from Berlin day `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export interface PetCare {
  itemId: string;
  care: number;
  stage: PetStage;
  /** Care days the next stage starts at (null at "Legendär"). */
  nextAt: number | null;
  /** Berlin day of the last feeding (YYYY-MM-DD). */
  lastFed: string;
  fedToday: boolean;
  hungry: boolean;
}

/** A pet's state from its care days and the day it last ate (`today` as YYYY-MM-DD in Berlin). */
export function petCare(itemId: string, care: number, lastFed: string, today: string): PetCare {
  const since = daysBetween(lastFed, today);
  return { itemId, care, stage: petStage(care), nextAt: nextStageAt(care), lastFed, fedToday: since <= 0, hungry: since >= PET_HUNGRY_AFTER };
}

/** Size factor of the avatar radius per stage (Legendär keeps the adult size and gets its aura and crown instead). */
const STAGE_SIZE = [0.34, 0.42, 0.5, 0.5];

/** Where the companion sits: on the lower left rim of the avatar. */
export function petPoint(avatar: { cx: number; cy: number; r: number }, stage: number): { x: number; y: number; size: number } {
  const size = avatar.r * STAGE_SIZE[Math.min(4, Math.max(1, stage)) - 1];
  return { x: avatar.cx - avatar.r * 0.78, y: avatar.cy + avatar.r * 0.86 - size, size };
}

// ---------- Colours ----------

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixed(a: string, b: string, t: number): string {
  const [x, y] = [rgb(a), rgb(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(', ')})`;
}

// ---------- Shapes (design units) ----------

function ellipse(ctx: PetCtx, x: number, y: number, rx: number, ry: number, rotation = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(rx, ry);
  ctx.moveTo(1, 0);
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.restore();
}

function shape(ctx: PetCtx, fill: Paint, line: string | null, path: () => void) {
  ctx.beginPath();
  path();
  ctx.fillStyle = fill;
  ctx.fill();
  if (line) {
    ctx.strokeStyle = line;
    ctx.stroke();
  }
}

/** Mood of the pet being drawn (set by drawPet; the drawing is synchronous). */
let hungry = false;

/** Glossy eyes: a dark iris with a soft lighter rim, two catch lights. Hungry, the lids droop and a tear runs. */
function eyes(ctx: PetCtx, x: number, y: number, r: number, ink: string) {
  for (const side of [-1, 1]) {
    const cx = side * x;
    const iris = ctx.createRadialGradient(cx, y + r * 0.5, r * 0.2, cx, y, r * 1.15);
    iris.addColorStop(0, mixed(ink, '#7A6CFF', 0.35));
    iris.addColorStop(0.7, ink);
    iris.addColorStop(1, ink);
    shape(ctx, iris, null, () => ellipse(ctx, cx, y, r, r * 1.12));
    shape(ctx, '#FFFFFF', null, () => ellipse(ctx, cx + r * 0.32, y - r * 0.42, r * 0.38, r * 0.38));
    shape(ctx, '#FFFFFF', null, () => ellipse(ctx, cx - r * 0.38, y + r * 0.42, r * 0.16, r * 0.16));
    if (hungry) {
      // Heavy upper lid in the face colour's dark line.
      shape(ctx, ink, null, () => {
        ctx.moveTo(cx - r * 1.3, y - r * 0.2);
        ctx.quadraticCurveTo(cx, y - r * 1.6, cx + r * 1.3, y - r * 0.2);
        ctx.quadraticCurveTo(cx, y + r * 0.15, cx - r * 1.3, y - r * 0.2);
      });
    }
  }
  if (hungry) {
    shape(ctx, '#8FD3FF', '#3B82C4', () => {
      const tx = x + r * 0.2;
      ctx.moveTo(tx, y + r * 1.2);
      ctx.quadraticCurveTo(tx + r * 0.9, y + r * 2.4, tx, y + r * 2.8);
      ctx.quadraticCurveTo(tx - r * 0.9, y + r * 2.4, tx, y + r * 1.2);
    });
  }
}

function cheeks(ctx: PetCtx, x: number, y: number) {
  if (hungry) return;
  ctx.globalAlpha = 0.45;
  for (const side of [-1, 1]) shape(ctx, '#FF8FA3', null, () => ellipse(ctx, side * x, y, 4.5, 3));
  ctx.globalAlpha = 1;
}

type Drawer = (ctx: PetCtx, main: Paint, light: Paint, dark: Paint, line: string) => void;

const fox: Drawer = (ctx, main, light, dark, line) => {
  // Tail curled around the right side, with a white tip.
  shape(ctx, main, line, () => {
    ctx.moveTo(12, 44);
    ctx.bezierCurveTo(44, 50, 56, 18, 40, -2);
    ctx.bezierCurveTo(36, 16, 26, 30, 10, 30);
    ctx.closePath();
  });
  shape(ctx, '#FFF6EC', line, () => {
    ctx.moveTo(40, -2);
    ctx.bezierCurveTo(48, 8, 47, 14, 44, 20);
    ctx.quadraticCurveTo(40, 10, 34, 8);
    ctx.closePath();
  });
  shape(ctx, main, line, () => ellipse(ctx, 0, 24, 25, 25));
  shape(ctx, '#FFF6EC', null, () => ellipse(ctx, 0, 28, 13, 17));
  for (const side of [-1, 1]) {
    shape(ctx, main, line, () => { ctx.moveTo(side * 24, -22); ctx.lineTo(side * 15, -50); ctx.lineTo(side * 3, -30); ctx.closePath(); });
    shape(ctx, dark, null, () => { ctx.moveTo(side * 19, -26); ctx.lineTo(side * 15, -42); ctx.lineTo(side * 8, -31); ctx.closePath(); });
  }
  shape(ctx, main, line, () => ellipse(ctx, 0, -12, 27, 22));
  shape(ctx, '#FFF6EC', null, () => { ctx.moveTo(-26, -6); ctx.quadraticCurveTo(-12, -2, 0, 10); ctx.quadraticCurveTo(12, -2, 26, -6); ctx.quadraticCurveTo(14, 12, 0, 10); ctx.quadraticCurveTo(-14, 12, -26, -6); });
  eyes(ctx, 10, -14, 3.6, '#2A1A12');
  shape(ctx, '#2A1A12', null, () => ellipse(ctx, 0, -3, 3.4, 2.6));
  cheeks(ctx, 17, -4);
  for (const side of [-1, 1]) shape(ctx, light, line, () => ellipse(ctx, side * 10, 47, 7, 4.5));
};

const owl: Drawer = (ctx, main, light, dark, line) => {
  for (const side of [-1, 1]) {
    shape(ctx, main, line, () => { ctx.moveTo(side * 26, -24); ctx.lineTo(side * 28, -48); ctx.lineTo(side * 10, -32); ctx.closePath(); });
  }
  shape(ctx, main, line, () => ellipse(ctx, 0, 6, 31, 42));
  shape(ctx, light, null, () => ellipse(ctx, 0, 20, 19, 25));
  ctx.lineWidth *= 0.8;
  for (const [x, y] of [[-8, 12], [8, 12], [0, 22], [-8, 32], [8, 32]]) {
    ctx.beginPath();
    ctx.moveTo(x - 3.5, y - 2);
    ctx.quadraticCurveTo(x, y + 2.5, x + 3.5, y - 2);
    ctx.strokeStyle = dark;
    ctx.stroke();
  }
  ctx.lineWidth /= 0.8;
  for (const side of [-1, 1]) shape(ctx, dark, line, () => ellipse(ctx, side * 29, 14, 8, 21, side * 0.18));
  for (const side of [-1, 1]) shape(ctx, '#FFFDF5', line, () => ellipse(ctx, side * 12, -12, 12.5, 12.5));
  eyes(ctx, 12, -12, 5.6, '#1E1A2B');
  shape(ctx, '#F5A524', line, () => { ctx.moveTo(-4.5, -4); ctx.lineTo(4.5, -4); ctx.lineTo(0, 4); ctx.closePath(); });
  for (const side of [-1, 1]) shape(ctx, '#F5A524', line, () => ellipse(ctx, side * 9, 47, 6, 3.5));
};

const cat: Drawer = (ctx, main, light, dark, line) => {
  // Tail up behind the body.
  ctx.beginPath();
  ctx.moveTo(16, 40);
  ctx.bezierCurveTo(46, 40, 48, 8, 38, -14);
  ctx.lineCap = 'round';
  ctx.strokeStyle = line;
  ctx.lineWidth += 8;
  ctx.stroke();
  ctx.strokeStyle = main;
  ctx.lineWidth -= 4.4;
  ctx.stroke();
  ctx.lineWidth -= 3.6;
  shape(ctx, main, line, () => ellipse(ctx, 0, 25, 23, 24));
  shape(ctx, light, null, () => ellipse(ctx, 0, 30, 12, 16));
  for (const side of [-1, 1]) {
    shape(ctx, main, line, () => { ctx.moveTo(side * 26, -20); ctx.quadraticCurveTo(side * 26, -42, side * 20, -46); ctx.quadraticCurveTo(side * 12, -38, side * 4, -32); ctx.closePath(); });
    shape(ctx, '#FFB3C1', null, () => { ctx.moveTo(side * 21, -26); ctx.quadraticCurveTo(side * 21, -38, side * 19, -40); ctx.lineTo(side * 10, -32); ctx.closePath(); });
  }
  shape(ctx, main, line, () => ellipse(ctx, 0, -12, 28, 23));
  ctx.strokeStyle = dark;
  for (const x of [-7, 0, 7]) {
    ctx.beginPath();
    ctx.moveTo(x, -33);
    ctx.lineTo(x * 0.8, -26);
    ctx.stroke();
  }
  eyes(ctx, 11, -13, 3.8, '#1E1A2B');
  shape(ctx, '#FF8FA3', null, () => { ctx.moveTo(-3, -5); ctx.lineTo(3, -5); ctx.lineTo(0, -1.5); ctx.closePath(); });
  ctx.strokeStyle = line;
  ctx.beginPath();
  ctx.moveTo(-5, 1);
  ctx.quadraticCurveTo(-2.5, 4, 0, 0);
  ctx.quadraticCurveTo(2.5, 4, 5, 1);
  ctx.stroke();
  ctx.globalAlpha = 0.6;
  for (const side of [-1, 1]) {
    for (const dy of [-3, 2]) {
      ctx.beginPath();
      ctx.moveTo(side * 14, dy - 2);
      ctx.lineTo(side * 31, dy - 4 + (dy > 0 ? 4 : 0));
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  cheeks(ctx, 17, -4);
  for (const side of [-1, 1]) shape(ctx, light, line, () => ellipse(ctx, side * 10, 47, 7, 4.5));
};

const axolotl: Drawer = (ctx, main, light, dark, line) => {
  shape(ctx, main, line, () => { ctx.moveTo(14, 34); ctx.bezierCurveTo(34, 40, 48, 30, 50, 18); ctx.bezierCurveTo(40, 26, 30, 24, 16, 20); ctx.closePath(); });
  shape(ctx, main, line, () => ellipse(ctx, 0, 28, 24, 19));
  shape(ctx, light, null, () => ellipse(ctx, 0, 32, 14, 11));
  for (const side of [-1, 1]) {
    for (const [i, angle] of [[0, -0.7], [1, -0.15], [2, 0.4]] as const) {
      shape(ctx, dark, line, () => ellipse(ctx, side * (36 + (i === 1 ? 4 : 0)), -16 + i * 11, 11, 4.8, side * angle));
    }
  }
  shape(ctx, main, line, () => ellipse(ctx, 0, -8, 33, 25));
  eyes(ctx, 17, -11, 3.6, '#1E1A2B');
  ctx.beginPath();
  ctx.moveTo(-8, 2);
  ctx.quadraticCurveTo(0, 8, 8, 2);
  ctx.strokeStyle = line;
  ctx.stroke();
  cheeks(ctx, 23, 0);
  for (const side of [-1, 1]) shape(ctx, main, line, () => ellipse(ctx, side * 14, 46, 6.5, 4));
};

const dragon: Drawer = (ctx, main, light, dark, line) => {
  for (const side of [-1, 1]) {
    shape(ctx, dark, line, () => {
      ctx.moveTo(side * 12, 8);
      ctx.lineTo(side * 48, -20);
      ctx.quadraticCurveTo(side * 46, -2, side * 40, 4);
      ctx.quadraticCurveTo(side * 36, 2, side * 32, 10);
      ctx.quadraticCurveTo(side * 26, 10, side * 20, 20);
      ctx.closePath();
    });
  }
  shape(ctx, main, line, () => { ctx.moveTo(14, 42); ctx.bezierCurveTo(40, 50, 52, 34, 44, 22); ctx.bezierCurveTo(40, 32, 30, 34, 14, 30); ctx.closePath(); });
  shape(ctx, dark, line, () => { ctx.moveTo(44, 22); ctx.lineTo(50, 12); ctx.lineTo(52, 24); ctx.closePath(); });
  shape(ctx, main, line, () => ellipse(ctx, 0, 25, 24, 24));
  shape(ctx, light, null, () => ellipse(ctx, 0, 29, 13, 17));
  ctx.strokeStyle = mixed('#FFE7A3', '#000000', 0.25);
  for (const y of [20, 28, 36]) {
    ctx.beginPath();
    ctx.moveTo(-9, y);
    ctx.lineTo(9, y);
    ctx.stroke();
  }
  for (const side of [-1, 1]) {
    shape(ctx, '#FFF1C9', line, () => { ctx.moveTo(side * 18, -28); ctx.quadraticCurveTo(side * 26, -42, side * 22, -52); ctx.quadraticCurveTo(side * 16, -40, side * 8, -32); ctx.closePath(); });
  }
  shape(ctx, main, line, () => ellipse(ctx, 0, -12, 27, 22));
  shape(ctx, light, line, () => ellipse(ctx, 0, -1, 15, 9));
  for (const side of [-1, 1]) shape(ctx, line, null, () => ellipse(ctx, side * 5, -2, 1.6, 1.3));
  eyes(ctx, 11, -16, 3.8, '#1E1A2B');
  cheeks(ctx, 19, -6);
  for (const side of [-1, 1]) shape(ctx, main, line, () => ellipse(ctx, side * 10, 47, 7, 4.5));
};

const bunny: Drawer = (ctx, main, light, dark, line) => {
  shape(ctx, '#FFFDF8', line, () => ellipse(ctx, 25, 38, 9, 8));
  shape(ctx, main, line, () => ellipse(ctx, 0, 26, 24, 23));
  shape(ctx, light, null, () => ellipse(ctx, 0, 31, 13, 15));
  for (const side of [-1, 1]) {
    shape(ctx, main, line, () => ellipse(ctx, side * 11, -36, 8.5, 19, side * 0.2));
    shape(ctx, '#FFB3C1', null, () => ellipse(ctx, side * 11, -34, 4.2, 13, side * 0.2));
  }
  shape(ctx, main, line, () => ellipse(ctx, 0, -8, 26, 22));
  shape(ctx, light, null, () => ellipse(ctx, 0, 0, 13, 8));
  eyes(ctx, 11, -11, 3.8, '#1E1A2B');
  shape(ctx, '#FF8FA3', null, () => ellipse(ctx, 0, -2, 3, 2.2));
  ctx.strokeStyle = line;
  ctx.beginPath();
  ctx.moveTo(-5, 3);
  ctx.quadraticCurveTo(-2.5, 6, 0, 2);
  ctx.quadraticCurveTo(2.5, 6, 5, 3);
  ctx.stroke();
  shape(ctx, '#FFFFFF', line, () => { ctx.moveTo(-2.4, 4); ctx.lineTo(2.4, 4); ctx.lineTo(2.4, 8); ctx.lineTo(-2.4, 8); ctx.closePath(); });
  cheeks(ctx, 17, -1);
  for (const side of [-1, 1]) shape(ctx, light, line, () => ellipse(ctx, side * 11, 47, 8, 4.5));
  void dark;
};

const penguin: Drawer = (ctx, main, light, dark, line) => {
  for (const side of [-1, 1]) shape(ctx, dark, line, () => ellipse(ctx, side * 27, 14, 7, 18, side * -0.35));
  shape(ctx, main, line, () => ellipse(ctx, 0, 8, 28, 40));
  shape(ctx, '#FFFDF7', null, () => ellipse(ctx, 0, 20, 19, 27));
  shape(ctx, '#FFFDF7', null, () => ellipse(ctx, 0, -10, 21, 15));
  eyes(ctx, 8, -13, 3.6, '#1E1A2B');
  shape(ctx, '#F59E0B', line, () => { ctx.moveTo(-5.5, -5); ctx.quadraticCurveTo(0, -8, 5.5, -5); ctx.lineTo(0, 2); ctx.closePath(); });
  cheeks(ctx, 15, -3);
  for (const side of [-1, 1]) shape(ctx, '#F59E0B', line, () => ellipse(ctx, side * 10, 47, 8, 4));
  void light;
};

const panda: Drawer = (ctx, main, light, dark, line) => {
  const ink = '#2B2B33';
  for (const side of [-1, 1]) shape(ctx, ink, line, () => ellipse(ctx, side * 20, -29, 9, 9));
  shape(ctx, main, line, () => ellipse(ctx, 0, 26, 25, 23));
  shape(ctx, light, null, () => ellipse(ctx, 0, 30, 13, 14));
  for (const side of [-1, 1]) shape(ctx, ink, line, () => ellipse(ctx, side * 20, 22, 8, 13, side * 0.4));
  for (const side of [-1, 1]) shape(ctx, ink, line, () => ellipse(ctx, side * 12, 45, 9, 5.5));
  shape(ctx, main, line, () => ellipse(ctx, 0, -10, 28, 23));
  for (const side of [-1, 1]) shape(ctx, ink, null, () => ellipse(ctx, side * 11, -10, 7.5, 9.5, side * -0.5));
  for (const side of [-1, 1]) shape(ctx, '#FFFFFF', null, () => ellipse(ctx, side * 11, -11, 4.4, 4.8));
  eyes(ctx, 11, -11, 3, '#1E1A2B');
  shape(ctx, ink, null, () => ellipse(ctx, 0, -1, 3.6, 2.6));
  ctx.strokeStyle = ink;
  ctx.beginPath();
  ctx.moveTo(-4.5, 4);
  ctx.quadraticCurveTo(-2.2, 6.5, 0, 2.5);
  ctx.quadraticCurveTo(2.2, 6.5, 4.5, 4);
  ctx.stroke();
  cheeks(ctx, 19, 1);
  void dark;
};

const frog: Drawer = (ctx, main, light, dark, line) => {
  for (const side of [-1, 1]) shape(ctx, dark, line, () => ellipse(ctx, side * 24, 38, 13, 9, side * 0.3));
  shape(ctx, main, line, () => ellipse(ctx, 0, 22, 26, 24));
  shape(ctx, light, null, () => ellipse(ctx, 0, 28, 16, 15));
  shape(ctx, main, line, () => ellipse(ctx, 0, -6, 30, 20));
  for (const side of [-1, 1]) shape(ctx, main, line, () => ellipse(ctx, side * 15, -23, 11, 11));
  for (const side of [-1, 1]) shape(ctx, '#FFFDF5', null, () => ellipse(ctx, side * 15, -23, 8, 8));
  eyes(ctx, 15, -23, 4.2, '#1E1A2B');
  ctx.strokeStyle = line;
  ctx.beginPath();
  ctx.moveTo(-15, -2);
  ctx.quadraticCurveTo(0, hungry ? 0 : 8, 15, -2);
  ctx.stroke();
  cheeks(ctx, 21, 1);
  for (const side of [-1, 1]) shape(ctx, light, line, () => ellipse(ctx, side * 12, 46, 8, 4.5));
};

const DRAWERS: Record<PetData['species'], Drawer> = { fox, owl, cat, axolotl, dragon, bunny, penguin, panda, frog };

/** Soft light from the upper left over the whole animal: one gradient per tone, shared by all its shapes. */
function lit(ctx: PetCtx, color: string) {
  const paint = ctx.createRadialGradient(-20, -32, 4, -8, -6, 92);
  paint.addColorStop(0, mixed(color, '#FFFFFF', 0.38));
  paint.addColorStop(0.5, color);
  paint.addColorStop(1, mixed(color, '#000000', 0.22));
  return paint;
}

/** Four-point sparkle. */
function sparkle(ctx: PetCtx, x: number, y: number, r: number, fill: string, line: string | null) {
  shape(ctx, fill, line, () => {
    for (let i = 0; i < 8; i += 1) {
      const radius = i % 2 ? r * 0.35 : r;
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      if (i) ctx.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius); else ctx.moveTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
    }
    ctx.closePath();
  });
}

const GOLD = '#F5C542';

/**
 * Draws the companion standing on (x, y + size), `size` = half its height. Each stage shows more: a collar with a gold
 * tag (Halbstark), a sparkle (Ausgewachsen), a golden aura, crown and light points (Legendär). Hungry, it droops.
 */
export function drawPet(ctx: PetCtx, pet: PetData, x: number, y: number, size: number, stage = 1, isHungry = false) {
  const k = size / 50;
  const base = pet.species === 'dragon' ? '#FFE7A3' : mixed(pet.color, '#FFFFFF', 0.55);
  const dark = mixed(pet.color, '#000000', 0.28);
  const line = mixed(pet.color, '#000000', 0.62);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  if (stage >= 4) {
    const aura = ctx.createRadialGradient(0, 4, 10, 0, 4, 66);
    aura.addColorStop(0, 'rgba(255, 214, 102, 0.55)');
    aura.addColorStop(0.6, 'rgba(255, 196, 64, 0.18)');
    aura.addColorStop(1, 'rgba(255, 196, 64, 0)');
    shape(ctx, aura, null, () => ellipse(ctx, 0, 4, 66, 66));
  }
  // Soft contact shadow on whatever it sits on.
  const ground = ctx.createRadialGradient(0, 50, 2, 0, 50, 34);
  ground.addColorStop(0, 'rgba(0, 0, 0, 0.38)');
  ground.addColorStop(1, 'rgba(0, 0, 0, 0)');
  shape(ctx, ground, null, () => ellipse(ctx, 0, 50, 34, 6.5));
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  hungry = isHungry;
  if (isHungry) ctx.translate(0, 2);
  DRAWERS[pet.species](ctx, lit(ctx, pet.color), lit(ctx, base), lit(ctx, dark), line);
  if (stage >= 2) {
    // Collar with a gold tag under the chin.
    ctx.lineWidth = 2;
    shape(ctx, '#B4232F', '#5C0F16', () => {
      ctx.moveTo(-17, 6);
      ctx.quadraticCurveTo(0, 15, 17, 6);
      ctx.lineTo(17, 11);
      ctx.quadraticCurveTo(0, 20, -17, 11);
      ctx.closePath();
    });
    shape(ctx, GOLD, '#8A6410', () => ellipse(ctx, 0, 19, 4.4, 4.4));
    shape(ctx, '#FFF3C4', null, () => ellipse(ctx, -1.2, 17.6, 1.3, 1.3));
  }
  if (stage >= 3) sparkle(ctx, -40, -38, 8, '#FFE27A', line);
  if (stage >= 4) {
    // Crown on the head, tilted a little, and light points around.
    ctx.save();
    ctx.translate(2, -34);
    ctx.rotate(0.12);
    ctx.lineWidth = 2;
    shape(ctx, GOLD, '#8A6410', () => {
      ctx.moveTo(-12, 4);
      ctx.lineTo(-13, -9);
      ctx.lineTo(-6, -2);
      ctx.lineTo(0, -13);
      ctx.lineTo(6, -2);
      ctx.lineTo(13, -9);
      ctx.lineTo(12, 4);
      ctx.closePath();
    });
    shape(ctx, '#E5484D', null, () => ellipse(ctx, 0, -1, 2.4, 2.4));
    for (const side of [-1, 1]) shape(ctx, '#3DD6C6', null, () => ellipse(ctx, side * 7, 0, 1.6, 1.6));
    ctx.restore();
    sparkle(ctx, 42, -30, 6, '#FFF3C4', null);
    sparkle(ctx, -46, 8, 4.5, '#FFF3C4', null);
    sparkle(ctx, 40, 30, 3.5, '#FFE27A', null);
  }
  hungry = false;
  ctx.restore();
}
