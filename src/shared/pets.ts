// Companions ("Begleiter") for the profile card: small flat animals that sit at the lower left of the avatar and grow
// with the member (stage 1–3 from the days they chatted). Drawn on canvas in a 100×100 design box centred on (0, 0)
// with the ground at y = 50, scaled to the requested size. Shared by the bot and the dashboard.

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
}

/** Growth stage from the number of days a member chatted. */
export function petStage(chatDays: number): 1 | 2 | 3 {
  return chatDays >= 30 ? 3 : chatDays >= 7 ? 2 : 1;
}
export const PET_STAGE_NAMES = ['Jungtier', 'Halbstark', 'Ausgewachsen'] as const;
/** Size factor of the avatar radius per stage. */
const STAGE_SIZE = [0.34, 0.42, 0.5];

/** Where the companion sits: on the lower left rim of the avatar. */
export function petPoint(avatar: { cx: number; cy: number; r: number }, stage: number): { x: number; y: number; size: number } {
  const size = avatar.r * STAGE_SIZE[Math.min(3, Math.max(1, stage)) - 1];
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

function shape(ctx: PetCtx, fill: string, line: string | null, path: () => void) {
  ctx.beginPath();
  path();
  ctx.fillStyle = fill;
  ctx.fill();
  if (line) {
    ctx.strokeStyle = line;
    ctx.stroke();
  }
}

function eyes(ctx: PetCtx, x: number, y: number, r: number, ink: string) {
  for (const side of [-1, 1]) {
    shape(ctx, ink, null, () => ellipse(ctx, side * x, y, r, r * 1.12));
    shape(ctx, '#FFFFFF', null, () => ellipse(ctx, side * x + r * 0.35, y - r * 0.4, r * 0.36, r * 0.36));
  }
}

function cheeks(ctx: PetCtx, x: number, y: number) {
  ctx.globalAlpha = 0.45;
  for (const side of [-1, 1]) shape(ctx, '#FF8FA3', null, () => ellipse(ctx, side * x, y, 4.5, 3));
  ctx.globalAlpha = 1;
}

type Drawer = (ctx: PetCtx, main: string, light: string, dark: string, line: string) => void;

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
  ctx.strokeStyle = mixed(light.startsWith('#') ? light : '#FFE7A3', '#000000', 0.25);
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

const DRAWERS: Record<PetData['species'], Drawer> = { fox, owl, cat, axolotl, dragon };

/** Draws the companion standing on (x, y + size), `size` = half its height. Stage 3 gets a little sparkle. */
export function drawPet(ctx: PetCtx, pet: PetData, x: number, y: number, size: number, stage = 1) {
  const k = size / 50;
  const light = pet.species === 'dragon' ? '#FFE7A3' : mixed(pet.color, '#FFFFFF', 0.55);
  const dark = mixed(pet.color, '#000000', 0.28);
  const line = mixed(pet.color, '#000000', 0.62);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  // Contact shadow on whatever it sits on.
  ctx.globalAlpha = 0.28;
  shape(ctx, '#000000', null, () => ellipse(ctx, 0, 50, 30, 5));
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2.6;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  DRAWERS[pet.species](ctx, pet.color, light, dark, line);
  if (stage >= 3) {
    ctx.save();
    ctx.translate(-42, -40);
    ctx.rotate(-0.2);
    shape(ctx, '#FFE27A', line, () => {
      for (let i = 0; i < 8; i += 1) {
        const r = i % 2 ? 3 : 8;
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
    });
    ctx.restore();
  }
  ctx.restore();
}
