// Drawing of the companions (shared/pets.ts has the care rules): every species has its own line of four forms, from a
// baby (often an egg, a larva or a tadpole) to a fantasy creature at the crown form. Built from a kit of parts with the
// same light and outline, so 39 lines × 4 forms keep one style. Design box 100×100 centred on (0, 0), ground at y = 50.
// A sad pet (a missed day) droops its lids, cries a tear and turns a little grey, in every form.

import type { PetData } from './cosmetics.js';

/** The canvas calls the drawer needs (a subset of the profile card context). */
export interface PetCtx {
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


// ---------- Kit ----------

/** The tones of one pet: lit main, light and dark paints, the outline, and the plain hex values. */
interface Pal { main: Paint; light: Paint; dark: Paint; line: string; hex: string }
type Form = (ctx: PetCtx, c: Pal) => void;

const GOLD = '#F5C542';
const INK = '#1E1A2B';

/** Outlined, lit oval. */
function oval(ctx: PetCtx, c: Pal, fill: Paint, x: number, y: number, rx: number, ry: number, rot = 0) {
  shape(ctx, fill, c.line, () => ellipse(ctx, x, y, rx, ry, rot));
}
/** Oval without an outline (markings, bellies). */
function patch(ctx: PetCtx, fill: Paint, x: number, y: number, rx: number, ry: number, rot = 0) {
  shape(ctx, fill, null, () => ellipse(ctx, x, y, rx, ry, rot));
}
function both(fn: (side: number) => void) {
  fn(-1);
  fn(1);
}
function feet(ctx: PetCtx, c: Pal, dx: number, rx = 7, fill: Paint = c.light, y = 47) {
  both((side) => oval(ctx, c, fill, side * dx, y, rx, rx * 0.62));
}
function curve(ctx: PetCtx, color: string, pts: number[], width?: number) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i + 3 < pts.length; i += 4) ctx.quadraticCurveTo(pts[i], pts[i + 1], pts[i + 2], pts[i + 3]);
  const before = ctx.lineWidth;
  if (width) ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.lineWidth = before;
}
function smile(ctx: PetCtx, c: Pal, y: number, w = 5) {
  curve(ctx, c.line, hungry ? [-w, y + 2, 0, y - 2, w, y + 2] : [-w, y, 0, y + w * 0.7, w, y]);
}
function catMouth(ctx: PetCtx, c: Pal, y: number) {
  curve(ctx, c.line, [-5, y, -2.5, y + 3, 0, y - 1]);
  curve(ctx, c.line, [0, y - 1, 2.5, y + 3, 5, y]);
}
function nose(ctx: PetCtx, y: number, r = 3.2, color = '#2A1A12') {
  patch(ctx, color, 0, y, r, r * 0.75);
}
function beak(ctx: PetCtx, c: Pal, y: number, w = 5, color = '#F5A524') {
  shape(ctx, color, c.line, () => { ctx.moveTo(-w, y - 3); ctx.quadraticCurveTo(0, y - 6, w, y - 3); ctx.lineTo(0, y + w * 0.9); ctx.closePath(); });
}
function earsPointy(ctx: PetCtx, c: Pal, fill: Paint, x: number, y: number, h: number, w: number, inner: string | null = null) {
  both((side) => {
    shape(ctx, fill, c.line, () => { ctx.moveTo(side * (x + w), y + 4); ctx.lineTo(side * (x + w * 0.45), y - h); ctx.lineTo(side * (x - w * 0.4), y); ctx.closePath(); });
    if (inner) shape(ctx, inner, null, () => { ctx.moveTo(side * (x + w * 0.7), y); ctx.lineTo(side * (x + w * 0.45), y - h * 0.7); ctx.lineTo(side * (x - w * 0.1), y - 1); ctx.closePath(); });
  });
}
function earsRound(ctx: PetCtx, c: Pal, fill: Paint, x: number, y: number, r: number, inner: string | null = null) {
  both((side) => {
    oval(ctx, c, fill, side * x, y, r, r);
    if (inner) patch(ctx, inner, side * x, y + 1, r * 0.55, r * 0.55);
  });
}
function earsLong(ctx: PetCtx, c: Pal, fill: Paint, x: number, y: number, h: number, w: number, inner = '#FFB3C1') {
  both((side) => {
    oval(ctx, c, fill, side * x, y, w, h, side * 0.2);
    patch(ctx, inner, side * x, y + 2, w * 0.5, h * 0.7, side * 0.2);
  });
}
/** Bushy tail on the right, rotated by `angle` around its root at (x, y); `tip` colours the end. */
function bushyTail(ctx: PetCtx, c: Pal, fill: Paint, x: number, y: number, angle: number, len = 1, tip: string | null = '#FFF6EC') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(len, len);
  shape(ctx, fill, c.line, () => { ctx.moveTo(0, 0); ctx.bezierCurveTo(30, 6, 44, -24, 30, -44); ctx.bezierCurveTo(26, -26, 16, -12, -2, -12); ctx.closePath(); });
  if (tip) shape(ctx, tip, c.line, () => { ctx.moveTo(30, -44); ctx.bezierCurveTo(38, -34, 37, -28, 35, -22); ctx.quadraticCurveTo(31, -32, 25, -34); ctx.closePath(); });
  ctx.restore();
}
/** Thin curled tail as a thick stroke with an outline. */
function ropeTail(ctx: PetCtx, c: Pal, color: string, pts: number[], width = 5) {
  ctx.lineCap = 'round';
  curve(ctx, c.line, pts, width + 4);
  curve(ctx, color, pts, width);
}
function wingsBat(ctx: PetCtx, c: Pal, fill: Paint, y: number, span: number, rise = 26) {
  both((side) => shape(ctx, fill, c.line, () => {
    ctx.moveTo(side * 12, y);
    ctx.lineTo(side * span, y - rise);
    ctx.quadraticCurveTo(side * (span - 2), y - rise * 0.35, side * (span - 8), y - rise * 0.2);
    ctx.quadraticCurveTo(side * (span - 12), y - rise * 0.3, side * (span - 16), y);
    ctx.quadraticCurveTo(side * (span - 22), y - rise * 0.05, side * 18, y + 12);
    ctx.closePath();
  }));
}
function wingsFeather(ctx: PetCtx, c: Pal, fill: Paint, y: number, span: number, rise = 22) {
  both((side) => shape(ctx, fill, c.line, () => {
    ctx.moveTo(side * 12, y + 8);
    ctx.bezierCurveTo(side * (span * 0.6), y - rise * 1.2, side * span, y - rise, side * span, y - rise * 0.6);
    for (let i = 0; i < 4; i += 1) ctx.quadraticCurveTo(side * (span - 3 - i * 6), y - rise * 0.2 + i * 6, side * (span - 6 - i * 6), y - rise * 0.25 + i * 7);
    ctx.quadraticCurveTo(side * 20, y + 10, side * 12, y + 8);
    ctx.closePath();
  }));
}
function wingsInsect(ctx: PetCtx, c: Pal, top: string, bottom: string, y: number, span: number) {
  both((side) => {
    shape(ctx, lit(ctx, top), c.line, () => ellipse(ctx, side * span * 0.55, y - 12, span * 0.5, 20, side * -0.5));
    shape(ctx, lit(ctx, bottom), c.line, () => ellipse(ctx, side * span * 0.42, y + 12, span * 0.34, 14, side * 0.5));
    patch(ctx, 'rgba(255, 255, 255, 0.45)', side * span * 0.62, y - 16, 4, 4);
  });
}
function hornPair(ctx: PetCtx, c: Pal, fill: Paint, x: number, y: number, h: number, w = 6, lean = 6) {
  both((side) => shape(ctx, fill, c.line, () => { ctx.moveTo(side * (x - w), y); ctx.quadraticCurveTo(side * (x + lean * 0.4), y - h * 0.7, side * (x + lean), y - h); ctx.quadraticCurveTo(side * (x + w * 0.4), y - h * 0.4, side * (x + w), y); ctx.closePath(); }));
}
function antlers(ctx: PetCtx, color: string, x: number, y: number) {
  both((side) => {
    const s = side;
    curve(ctx, '#5A3A1E', [s * x, y, s * (x + 4), y - 12, s * (x + 2), y - 24, s * (x + 12), y - 26, s * (x + 16), y - 34], 6);
    curve(ctx, color, [s * x, y, s * (x + 4), y - 12, s * (x + 2), y - 24, s * (x + 12), y - 26, s * (x + 16), y - 34], 3.4);
    curve(ctx, '#5A3A1E', [s * (x + 3), y - 14, s * (x + 9), y - 16, s * (x + 12), y - 20], 5);
    curve(ctx, color, [s * (x + 3), y - 14, s * (x + 9), y - 16, s * (x + 12), y - 20], 2.8);
  });
}
/** Soft glow behind a creature. */
function aura(ctx: PetCtx, rgb: string, r = 66, y = 4, strength = 0.5) {
  const glow = ctx.createRadialGradient(0, y, 10, 0, y, r);
  glow.addColorStop(0, `rgba(${rgb}, ${strength})`);
  glow.addColorStop(0.6, `rgba(${rgb}, ${strength * 0.32})`);
  glow.addColorStop(1, `rgba(${rgb}, 0)`);
  shape(ctx, glow, null, () => ellipse(ctx, 0, y, r, r));
}
/** A flame shape pointing up, `s` its height. */
function flame(ctx: PetCtx, x: number, y: number, s: number, outer: string, inner: string) {
  const path = (k: number) => () => {
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x - s * 0.42 * k, y - s * 0.1, x - s * 0.3 * k, y - s * 0.55 * k, x, y - s * k);
    ctx.bezierCurveTo(x + s * 0.12 * k, y - s * 0.6 * k, x + s * 0.48 * k, y - s * 0.3 * k, x, y);
  };
  shape(ctx, outer, null, path(1));
  shape(ctx, inner, null, path(0.6));
}
/** An egg standing on the ground with spots, an optional crack and two eyes peeking through it. */
function egg(ctx: PetCtx, c: Pal, fill: Paint, spot: string | null, crack: boolean, peek: boolean, rx = 24, ry = 30) {
  const cy = 50 - ry;
  oval(ctx, c, fill, 0, cy, rx, ry);
  if (spot) for (const [px, py, r] of [[-10, -6, 4], [8, -14, 3], [10, 6, 4.5], [-6, 12, 3]] as const) patch(ctx, spot, px, cy + py, r, r * 0.8);
  if (crack) curve(ctx, c.line, [-rx * 0.9, cy - 2, -rx * 0.5, cy - 8, -rx * 0.2, cy - 2, rx * 0.15, cy - 9, rx * 0.4, cy - 2, rx * 0.7, cy - 8, rx * 0.95, cy - 3]);
  if (peek) {
    patch(ctx, '#1A1424', 0, cy - 2, rx * 0.62, 7);
    eyes(ctx, 6, cy - 2, 3.4, INK);
  } else {
    eyes(ctx, 7, cy + 2, 3, INK);
    smile(ctx, c, cy + 9, 3.5);
  }
}
function cloud(ctx: PetCtx, x: number, y: number, s: number, fill: string, line: string | null) {
  shape(ctx, fill, line, () => {
    ellipse(ctx, x - s * 0.5, y, s * 0.5, s * 0.4);
    ellipse(ctx, x, y - s * 0.25, s * 0.6, s * 0.5);
    ellipse(ctx, x + s * 0.55, y, s * 0.48, s * 0.38);
  });
}
function crystal(ctx: PetCtx, x: number, y: number, h: number, w: number, fill: string, line: string, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  shape(ctx, fill, line, () => { ctx.moveTo(-w, 0); ctx.lineTo(-w * 0.8, -h * 0.7); ctx.lineTo(0, -h); ctx.lineTo(w * 0.8, -h * 0.7); ctx.lineTo(w, 0); ctx.closePath(); });
  shape(ctx, 'rgba(255, 255, 255, 0.45)', null, () => { ctx.moveTo(-w * 0.5, -h * 0.15); ctx.lineTo(-w * 0.4, -h * 0.75); ctx.lineTo(0, -h * 0.92); ctx.lineTo(-w * 0.1, -h * 0.2); ctx.closePath(); });
  ctx.restore();
}
function flower(ctx: PetCtx, x: number, y: number, r: number, color: string) {
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    patch(ctx, color, x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.8, r * 0.8);
  }
  patch(ctx, '#FFE27A', x, y, r * 0.6, r * 0.6);
}
function leaf(ctx: PetCtx, x: number, y: number, s: number, rot: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  shape(ctx, color, null, () => { ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 0.6, -s * 0.5, 0, -s); ctx.quadraticCurveTo(-s * 0.6, -s * 0.5, 0, 0); });
  ctx.restore();
}
function star5(ctx: PetCtx, x: number, y: number, r: number, fill: string) {
  shape(ctx, fill, null, () => {
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 ? r * 0.45 : r;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      if (i) ctx.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius); else ctx.moveTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
    }
    ctx.closePath();
  });
}

interface MammalSpec {
  /** Head radius; babies have big heads on small bodies. */
  head: number;
  body: [number, number];
  eyeR?: number;
  eyeDx?: number;
  behind?: Form;
  ears?: Form;
  /** Drawn on the head before the eyes (masks, patches, stripes); gets the head centre y. */
  markings?: (ctx: PetCtx, c: Pal, hy: number) => void;
  front?: Form;
  /** Height of the head relative to its width (default 0.9; horses have long heads). */
  headRy?: number;
  /** Light muzzle under the eyes. */
  snout?: boolean;
  mouth?: 'smile' | 'cat' | 'none';
  noseColor?: string | null;
  belly?: boolean;
  feet?: boolean;
  ink?: string;
}

/** A round mammal: tail behind, body on the ground, head on top with ears, eyes, muzzle and mouth. */
function mammal(ctx: PetCtx, c: Pal, m: MammalSpec) {
  const [bw, bh] = m.body;
  const by = 50 - bh;
  const hy = by - bh * 0.45 - m.head * 0.5;
  m.behind?.(ctx, c);
  oval(ctx, c, c.main, 0, by, bw, bh);
  if (m.belly !== false) patch(ctx, c.light, 0, by + bh * 0.2, bw * 0.55, bh * 0.68);
  if (m.feet !== false) feet(ctx, c, bw * 0.45, Math.max(5, bw * 0.3));
  m.ears?.(ctx, c);
  oval(ctx, c, c.main, 0, hy, m.head * 1.08, m.head * (m.headRy ?? 0.9));
  m.markings?.(ctx, c, hy);
  if (m.snout) patch(ctx, c.light, 0, hy + m.head * 0.35, m.head * 0.5, m.head * 0.33);
  const r = m.eyeR ?? m.head * 0.15;
  eyes(ctx, m.eyeDx ?? m.head * 0.42, hy - m.head * 0.05, r, m.ink ?? INK);
  if (m.noseColor !== null) nose(ctx, hy + m.head * 0.28, m.head * 0.11, m.noseColor ?? '#2A1A12');
  if (m.mouth === 'cat') catMouth(ctx, c, hy + m.head * 0.42);
  else if (m.mouth !== 'none') smile(ctx, c, hy + m.head * 0.42, m.head * 0.18);
  cheeks(ctx, m.head * 0.68, hy + m.head * 0.3);
  m.front?.(ctx, c);
}
/** Head centre y of a mammal spec (to place hats, horns and crowns). */
const headY = (m: { head: number; body: [number, number] }) => 50 - m.body[1] - m.body[1] * 0.45 - m.head * 0.5;

interface BirdSpec { body: [number, number]; wing?: Paint; beakColor?: string; tuft?: boolean; belly?: boolean; eyeR?: number; feetColor?: string }
/** A round bird: one body with a light breast, wings at the sides, beak and feet. */
function bird(ctx: PetCtx, c: Pal, b: BirdSpec) {
  const [bw, bh] = b.body;
  const cy = 50 - bh;
  if (b.tuft) both((side) => shape(ctx, c.main, c.line, () => { ctx.moveTo(side * bw * 0.8, cy - bh * 0.55); ctx.lineTo(side * bw * 0.9, cy - bh * 1.05); ctx.lineTo(side * bw * 0.3, cy - bh * 0.75); ctx.closePath(); }));
  oval(ctx, c, c.main, 0, cy, bw, bh);
  if (b.belly !== false) patch(ctx, c.light, 0, cy + bh * 0.3, bw * 0.6, bh * 0.6);
  both((side) => oval(ctx, c, b.wing ?? c.dark, side * bw * 0.92, cy + bh * 0.15, bw * 0.28, bh * 0.5, side * 0.2));
  const r = b.eyeR ?? bw * 0.13;
  eyes(ctx, bw * 0.35, cy - bh * 0.3, r, INK);
  beak(ctx, c, cy - bh * 0.08, bw * 0.16, b.beakColor);
  cheeks(ctx, bw * 0.55, cy - bh * 0.05);
  feet(ctx, c, bw * 0.35, 5.5, b.feetColor ?? '#F5A524');
}

/** A fish swimming to the left, floating a little above the ground. */
function fish(ctx: PetCtx, c: Pal, len: number, h: number, fin: Paint, y = 18) {
  shape(ctx, fin, c.line, () => { ctx.moveTo(len * 0.7, y); ctx.lineTo(len * 1.15, y - h * 0.7); ctx.quadraticCurveTo(len * 1.0, y, len * 1.15, y + h * 0.7); ctx.closePath(); });
  shape(ctx, fin, c.line, () => { ctx.moveTo(-len * 0.2, y - h * 0.8); ctx.quadraticCurveTo(len * 0.1, y - h * 1.5, len * 0.4, y - h * 0.85); ctx.closePath(); });
  oval(ctx, c, c.main, 0, y, len, h);
  patch(ctx, c.light, -len * 0.1, y + h * 0.35, len * 0.6, h * 0.4);
  // Seen from the side: one eye near the front.
  ctx.save();
  ctx.translate(-len * 0.55, 0);
  eyes(ctx, 0, y - h * 0.2, h * 0.22, INK);
  ctx.restore();
}

/** Draws `fn` scaled by `k` around the middle of the ground line (smaller animals stay standing). */
function scaled(ctx: PetCtx, k: number, fn: () => void) {
  ctx.save();
  ctx.translate(0, 50);
  ctx.scale(k, k);
  ctx.translate(0, -50);
  fn();
  ctx.restore();
}
/** Calls an original whole-animal drawer with this pet's tones. */
const whole = (drawer: Drawer): Form => (ctx, c) => drawer(ctx, c.main, c.light, c.dark, c.line);

// ---------- 1–9: the first species ----------

const foxEars = (head: number, body: [number, number]): Form => (ctx, c) => earsPointy(ctx, c, c.main, head * 0.5, headY({ head, body }) - head * 0.5, head * 0.8, head * 0.42, '#5A2A12');
const foxBaby: Form = (ctx, c) => {
  const spec = { head: 24, body: [16, 13] as [number, number] };
  mammal(ctx, c, { ...spec, eyeR: 4.6, snout: true, behind: (k) => bushyTail(k, c, c.main, 10, 46, 0.25, 0.55), ears: foxEars(spec.head, spec.body) });
};
const foxYouth: Form = (ctx, c) => {
  const spec = { head: 22, body: [20, 18] as [number, number] };
  mammal(ctx, c, { ...spec, eyeR: 3.9, snout: true, behind: (k) => bushyTail(k, c, c.main, 12, 46, 0.15, 0.8), ears: foxEars(spec.head, spec.body) });
};
const kitsune: Form = (ctx, c) => {
  aura(ctx, '120, 180, 255');
  const spec = { head: 26, body: [25, 24] as [number, number] };
  mammal(ctx, c, {
    ...spec, eyeR: 3.8, snout: true,
    // Three tails fanned out to both sides.
    behind: (k) => {
      bushyTail(k, c, c.main, 8, 40, -0.05, 1.3, '#E8F4FF');
      bushyTail(k, c, c.main, 8, 34, -0.85, 1.3, '#E8F4FF');
      k.save();
      k.scale(-1, 1);
      bushyTail(k, c, c.main, 8, 36, -0.45, 1.3, '#E8F4FF');
      k.restore();
    },
    ears: foxEars(spec.head, spec.body),
    markings: (k, _c, hy) => { shape(k, '#E5484D', null, () => { k.moveTo(0, hy - 18); k.lineTo(3, hy - 11); k.lineTo(0, hy - 8); k.lineTo(-3, hy - 11); k.closePath(); }); },
  });
  flame(ctx, -42, -6, 22, 'rgba(110, 170, 255, 0.85)', '#E6F3FF');
  flame(ctx, -30, -30, 16, 'rgba(110, 170, 255, 0.85)', '#E6F3FF');
};

const owlBaby: Form = (ctx, c) => bird(ctx, c, { body: [22, 22], eyeR: 5 });
const owlYouth: Form = (ctx, c) => bird(ctx, c, { body: [24, 30], tuft: true, eyeR: 4.6 });
const starOwl: Form = (ctx, c) => {
  aura(ctx, '150, 140, 255');
  wingsFeather(ctx, c, lit(ctx, '#2B2F6B'), 4, 50, 28);
  for (const [x, y] of [[-40, -20], [-30, -4], [38, -18], [30, -2], [-44, -8]] as const) star5(ctx, x, y, 2.6, '#FFF3C4');
  whole(owl)(ctx, c);
  shape(ctx, GOLD, null, () => { ctx.arc(0, -36, 6, 0.6, Math.PI * 2 - 0.6); ctx.arc(3, -37, 5, Math.PI * 2 - 0.9, 0.9, true); ctx.closePath(); });
};

const catEars = (head: number, body: [number, number]): Form => (ctx, c) => earsPointy(ctx, c, c.main, head * 0.55, headY({ head, body }) - head * 0.45, head * 0.7, head * 0.42, '#FFB3C1');
const catBaby: Form = (ctx, c) => {
  const spec = { head: 24, body: [15, 12] as [number, number] };
  mammal(ctx, c, { ...spec, eyeR: 4.8, mouth: 'cat', noseColor: '#FF8FA3', behind: (k) => ropeTail(k, c, c.hex, [12, 46, 30, 44, 26, 28], 5), ears: catEars(spec.head, spec.body) });
};
const catYouth: Form = (ctx, c) => {
  const spec = { head: 22, body: [19, 17] as [number, number] };
  mammal(ctx, c, { ...spec, eyeR: 4, mouth: 'cat', noseColor: '#FF8FA3', behind: (k) => ropeTail(k, c, c.hex, [14, 44, 40, 40, 34, 14], 6), ears: catEars(spec.head, spec.body) });
};
const nekomata: Form = (ctx, c) => {
  aura(ctx, '190, 140, 255');
  // Its two tails fork away from the body, each with a ghost flame.
  ropeTail(ctx, c, c.hex, [18, 42, 62, 40, 56, 8], 9);
  ctx.save();
  ctx.scale(-1, 1);
  ropeTail(ctx, c, c.hex, [18, 42, 62, 40, 56, 8], 9);
  flame(ctx, 56, 10, 24, 'rgba(190, 140, 255, 0.9)', '#F3E8FF');
  ctx.restore();
  flame(ctx, 56, 10, 24, 'rgba(190, 140, 255, 0.9)', '#F3E8FF');
  whole(cat)(ctx, c);
  flame(ctx, -40, -24, 12, 'rgba(190, 140, 255, 0.8)', '#F3E8FF');
};

const axolotlLarva: Form = (ctx, c) => {
  shape(ctx, c.light, c.line, () => { ctx.moveTo(10, 36); ctx.quadraticCurveTo(34, 34, 40, 26); ctx.quadraticCurveTo(32, 40, 10, 42); ctx.closePath(); });
  oval(ctx, c, c.main, 0, 38, 20, 11);
  both((side) => { for (const i of [0, 1, 2]) patch(ctx, c.dark, side * (18 + i), 28 + i * 4, 4, 2, side * (i - 1) * 0.5); });
  eyes(ctx, 8, 35, 3.4, INK);
  smile(ctx, c, 41, 3);
};
const axolotlYouth: Form = (ctx, c) => scaled(ctx, 0.8, () => whole(axolotl)(ctx, c));
const waterDragon: Form = (ctx, c) => {
  aura(ctx, '90, 220, 230');
  wingsBat(ctx, c, lit(ctx, '#7FE7E0'), 6, 50, 26);
  whole(axolotl)(ctx, c);
  both((side) => { for (const [i, a] of [[0, -0.9], [1, -0.4]] as const) shape(ctx, GOLD, c.line, () => ellipse(ctx, side * (30 + i * 8), -30 + i * 6, 9, 3.6, side * a)); });
  for (const [x, y] of [[-42, 20], [44, 12], [-36, -36]] as const) shape(ctx, 'rgba(160, 230, 255, 0.8)', null, () => { ctx.moveTo(x, y - 5); ctx.quadraticCurveTo(x + 4, y + 2, x, y + 3); ctx.quadraticCurveTo(x - 4, y + 2, x, y - 5); });
};

const dragonEgg: Form = (ctx, c) => egg(ctx, c, c.main, '#FFE7A3', true, true);
const dragonling: Form = (ctx, c) => {
  const spec = { head: 23, body: [17, 15] as [number, number] };
  const hy = headY(spec);
  mammal(ctx, c, {
    ...spec, eyeR: 4.4, snout: true, noseColor: null,
    behind: (k) => { wingsBat(k, c, c.dark, 24, 36, 16); ropeTail(k, c, c.hex, [12, 46, 30, 46, 34, 34], 6); },
    ears: (k) => hornPair(k, c, '#FFF1C9', 12, hy - 16, 12, 4, 3),
  });
};
const elderDragon: Form = (ctx, c) => {
  aura(ctx, '255, 140, 60');
  whole(dragon)(ctx, c);
  hornPair(ctx, c, GOLD, 20, -26, 22, 4, 10);
  ctx.save();
  ctx.translate(-14, -4);
  ctx.rotate(-Math.PI / 2 - 0.25);
  flame(ctx, 0, 0, 30, '#FF7A1A', '#FFE27A');
  ctx.restore();
};

const bunnyBaby: Form = (ctx, c) => {
  const spec = { head: 24, body: [15, 12] as [number, number] };
  const hy = headY(spec);
  mammal(ctx, c, { ...spec, eyeR: 4.6, noseColor: '#FF8FA3', behind: (k) => oval(k, c, '#FFFDF8', 18, 44, 7, 6), ears: (k) => earsLong(k, c, c.main, 9, hy - 24, 12, 6.5) });
};
const bunnyYouth: Form = (ctx, c) => {
  const spec = { head: 22, body: [19, 17] as [number, number] };
  const hy = headY(spec);
  mammal(ctx, c, { ...spec, eyeR: 3.9, noseColor: '#FF8FA3', behind: (k) => oval(k, c, '#FFFDF8', 22, 42, 8, 7), ears: (k) => earsLong(k, c, c.main, 10, hy - 26, 16, 7.5) });
};
const wolpertinger: Form = (ctx, c) => {
  aura(ctx, '255, 200, 120');
  wingsFeather(ctx, c, lit(ctx, '#B98A5A'), 4, 46, 24);
  whole(bunny)(ctx, c);
  antlers(ctx, '#D9B27C', 14, -40);
};

const penguinEgg: Form = (ctx, c) => egg(ctx, c, lit(ctx, '#F4F1EA'), null, true, true);
const fluffChick: Form = (ctx, c) => {
  const grey = lit(ctx, '#A9AFBA');
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    shape(ctx, grey, c.line, () => ellipse(ctx, Math.cos(a) * 21, 22 + Math.sin(a) * 25, 7, 7));
  }
  patch(ctx, grey, 0, 22, 22, 26);
  patch(ctx, '#FFFDF7', 0, 8, 13, 10);
  eyes(ctx, 6, 6, 3.8, INK);
  beak(ctx, c, 12, 4, '#3A3A44');
  feet(ctx, c, 9, 6, '#3A3A44');
};
const iceEmperor: Form = (ctx, c) => {
  aura(ctx, '150, 220, 255');
  whole(penguin)(ctx, c);
  both((side) => patch(ctx, '#FFC94A', side * 19, -6, 4, 7, side * 0.3));
  for (const [x, h, r] of [[-9, 14, -0.35], [0, 20, 0], [9, 14, 0.35]] as const) crystal(ctx, x, -30, h, 4, 'rgba(190, 235, 255, 0.95)', '#3B82C4', r);
  for (const [x, y] of [[-42, -20], [40, -10], [-36, 24]] as const) sparkle(ctx, x, y, 5, '#E0F7FF', null);
};

const pandaPatches = (k: PetCtx, _c: Pal, hy: number) => both((side) => patch(k, '#2B2B33', side * 10, hy - 1, 6.5, 8.5, side * -0.5));
const pandaBaby: Form = (ctx, c) => {
  const spec = { head: 24, body: [15, 12] as [number, number] };
  mammal(ctx, c, { ...spec, eyeR: 3.6, noseColor: '#2B2B33', feet: false, ears: (k) => earsRound(k, c, '#2B2B33', 17, headY(spec) - 17, 7), markings: pandaPatches });
  feet(ctx, c, 8, 6, '#2B2B33');
};
const pandaYouth: Form = (ctx, c) => {
  const spec = { head: 22, body: [19, 18] as [number, number] };
  mammal(ctx, c, {
    ...spec, eyeR: 3.2, noseColor: '#2B2B33', feet: false, ears: (k) => earsRound(k, c, '#2B2B33', 16, headY(spec) - 15, 7), markings: pandaPatches,
    front: (k) => { curve(k, '#3F7D20', [-22, 46, -24, 20, -26, 4], 5); leaf(k, -26, 8, 12, -0.6, '#6FBF4A'); leaf(k, -24, 18, 10, 0.5, '#6FBF4A'); },
  });
  feet(ctx, c, 10, 7, '#2B2B33');
};
const yinYangPanda: Form = (ctx, c) => {
  aura(ctx, '255, 255, 255', 66, 4, 0.35);
  whole(panda)(ctx, c);
  patch(ctx, '#2B2B33', 0, 30, 9, 9);
  shape(ctx, '#FFFFFF', null, () => { ctx.moveTo(0, 21); ctx.arc(0, 30, 9, -Math.PI / 2, Math.PI / 2); ctx.arc(0, 34.5, 4.5, Math.PI / 2, -Math.PI / 2, true); ctx.arc(0, 25.5, 4.5, Math.PI / 2, -Math.PI / 2); });
  patch(ctx, '#2B2B33', 0, 25.5, 1.4, 1.4);
  patch(ctx, '#FFFFFF', 0, 34.5, 1.4, 1.4);
  for (const [x, y, r] of [[-40, -10, -0.5], [42, -22, 0.6], [38, 12, 0.3]] as const) leaf(ctx, x, y, 12, r, '#7ED957');
};

const tadpole: Form = (ctx, c) => {
  shape(ctx, c.dark, c.line, () => { ctx.moveTo(10, 30); ctx.bezierCurveTo(26, 22, 34, 36, 46, 26); ctx.bezierCurveTo(40, 40, 26, 40, 10, 38); ctx.closePath(); });
  oval(ctx, c, c.main, 0, 34, 16, 13);
  eyes(ctx, 6, 31, 3.4, INK);
  smile(ctx, c, 38, 3);
  for (const [x, y, r] of [[-20, 10, 3], [-26, 0, 2], [-16, -6, 1.6]] as const) shape(ctx, 'rgba(200, 235, 255, 0.5)', 'rgba(200, 235, 255, 0.8)', () => ellipse(ctx, x, y, r, r));
};
const froglet: Form = (ctx, c) => {
  ropeTail(ctx, c, c.hex, [14, 44, 30, 46, 36, 40], 5);
  scaled(ctx, 0.82, () => whole(frog)(ctx, c));
};
const thunderToad: Form = (ctx, c) => {
  aura(ctx, '170, 190, 255');
  whole(frog)(ctx, c);
  for (const [x, y] of [[-14, 18], [10, 26], [-4, 32], [16, 14]] as const) patch(ctx, c.dark, x, y, 2.6, 2.2);
  cloud(ctx, 0, -44, 18, '#8A93A8', '#4B5568');
  shape(ctx, '#FDE047', '#A16207', () => { ctx.moveTo(-2, -38); ctx.lineTo(-8, -26); ctx.lineTo(-2, -26); ctx.lineTo(-6, -16); ctx.lineTo(6, -30); ctx.lineTo(0, -30); ctx.lineTo(4, -38); ctx.closePath(); });
};

// ---------- 10–24 ----------

const caterpillar: Form = (ctx, c) => {
  for (const [i, x] of [[4, 34], [3, 22], [2, 10], [1, -2]] as const) oval(ctx, c, i % 2 ? c.main : c.light, x, 40 - i * 1.5, 10, 10);
  oval(ctx, c, c.main, -16, 30, 14, 13);
  both((side) => curve(ctx, c.line, [-16 + side * 5, 18, -16 + side * 7, 10, -16 + side * 10, 8], 2));
  eyes(ctx, 5, 28, 3.4, INK);
  smile(ctx, c, 34, 3);
};
const cocoon: Form = (ctx, c) => {
  curve(ctx, '#8A6A4A', [0, -50, 2, -34, 0, -24], 2);
  oval(ctx, c, c.main, 0, 8, 17, 34);
  for (const y of [-12, 0, 12, 24]) curve(ctx, c.line, [-15, y, 0, y + 4, 15, y], 1.4);
  eyes(ctx, 6, -8, 3, INK);
};
const butterfly: Form = (ctx, c) => {
  wingsInsect(ctx, c, c.hex, mixHex(c.hex, '#FFFFFF', 0.4), 6, 54);
  oval(ctx, c, '#3A2E4A', 0, 14, 6, 24);
  oval(ctx, c, '#3A2E4A', 0, -14, 9, 9);
  both((side) => curve(ctx, '#3A2E4A', [side * 3, -22, side * 6, -34, side * 12, -38], 2));
  eyes(ctx, 4, -15, 2.4, '#FFFFFF');
};
const fairyMoth: Form = (ctx, c) => {
  aura(ctx, '255, 170, 230');
  wingsInsect(ctx, c, '#F0ABFC', '#A5F3FC', 4, 64);
  for (const [x, y] of [[-28, -16], [28, -16], [-20, 18], [20, 18]] as const) star5(ctx, x, y, 3.4, '#FFFFFF');
  oval(ctx, c, c.main, 0, 16, 7, 22);
  oval(ctx, c, c.main, 0, -12, 11, 11);
  both((side) => { curve(ctx, c.line, [side * 3, -21, side * 7, -34, side * 14, -40], 2); star5(ctx, side * 14, -41, 3, '#FFF3C4'); });
  eyes(ctx, 4.5, -13, 2.8, INK);
  smile(ctx, c, -7, 2.5);
  for (const [x, y] of [[-46, 30], [44, 34], [-6, -46]] as const) sparkle(ctx, x, y, 4, '#FFFFFF', null);
};

const chickEgg: Form = (ctx, c) => egg(ctx, c, lit(ctx, '#F7F1E1'), null, true, false, 22, 27);
const chick: Form = (ctx, c) => bird(ctx, { ...c, main: lit(ctx, '#FFD54F'), light: lit(ctx, '#FFF1B8') }, { body: [20, 21], eyeR: 4.4, wing: lit(ctx, '#FFC93C') });
const comb = (ctx: PetCtx, c: Pal, y: number) => shape(ctx, '#E5484D', c.line, () => { ellipse(ctx, -6, y, 4.5, 6); ellipse(ctx, 0, y - 3, 5, 7); ellipse(ctx, 6, y, 4.5, 6); });
const hen: Form = (ctx, c) => {
  shape(ctx, c.light, c.line, () => { ctx.moveTo(16, 22); ctx.quadraticCurveTo(40, 4, 34, -8); ctx.quadraticCurveTo(30, 10, 18, 12); ctx.closePath(); });
  comb(ctx, c, -30);
  bird(ctx, c, { body: [26, 28], eyeR: 3.6 });
  patch(ctx, '#E5484D', 0, -6, 2.6, 4);
};
const phoenix: Form = (ctx, c) => {
  aura(ctx, '255, 120, 40');
  for (const [x, r] of [[-12, -0.6], [0, 0], [12, 0.6]] as const) { ctx.save(); ctx.translate(x, 34); ctx.rotate(Math.PI + r); flame(ctx, 0, 0, 30, '#FF7A1A', '#FFE27A'); ctx.restore(); }
  wingsFeather(ctx, c, lit(ctx, '#FF8A1F'), 0, 50, 28);
  for (const x of [-6, 0, 6]) flame(ctx, x, -24, 16, '#FF5A1F', '#FFD166');
  bird(ctx, { ...c, main: lit(ctx, '#FF6B1A'), light: lit(ctx, '#FFD166'), dark: lit(ctx, '#C2410C') }, { body: [24, 26], eyeR: 3.6, beakColor: GOLD });
};

const floppyEars = (head: number, body: [number, number]): Form => (ctx, c) => both((side) => oval(ctx, c, c.dark, side * head * 0.95, headY({ head, body }) - head * 0.1, head * 0.3, head * 0.55, side * -0.35));
const puppy: Form = (ctx, c) => {
  const spec = { head: 24, body: [16, 13] as [number, number] };
  mammal(ctx, c, { ...spec, eyeR: 4.6, snout: true, behind: (k) => ropeTail(k, c, c.hex, [12, 44, 24, 38, 26, 30], 5), front: floppyEars(spec.head, spec.body) });
};
const youngDog: Form = (ctx, c) => {
  const spec = { head: 22, body: [20, 18] as [number, number] };
  mammal(ctx, c, { ...spec, eyeR: 3.9, snout: true, behind: (k) => ropeTail(k, c, c.hex, [14, 42, 30, 34, 32, 22], 6), markings: (k, _c, hy) => patch(k, c.dark, 9, hy - 4, 7, 6), front: floppyEars(spec.head, spec.body) });
};
const dog: Form = (ctx, c) => {
  const spec = { head: 24, body: [24, 23] as [number, number] };
  mammal(ctx, c, { ...spec, eyeR: 3.6, snout: true, behind: (k) => ropeTail(k, c, c.hex, [16, 40, 36, 30, 38, 14], 7), markings: (k, _c, hy) => patch(k, c.dark, 10, hy - 5, 8, 7), front: floppyEars(spec.head, spec.body) });
};
const kerberos: Form = (ctx, c) => {
  aura(ctx, '255, 90, 60');
  for (const x of [-26, 26]) flame(ctx, x, 50, 22, '#FF5A1F', '#FFD166');
  ropeTail(ctx, c, c.hex, [16, 40, 38, 28, 40, 10], 7);
  oval(ctx, c, c.main, 0, 28, 28, 22);
  patch(ctx, c.light, 0, 32, 15, 14);
  feet(ctx, c, 13, 7);
  for (const [x, y, s] of [[-24, -6, 0.75], [24, -6, 0.75], [0, -16, 0.9]] as const) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    both((side) => oval(ctx, c, c.dark, side * 20, -2, 7, 12, side * -0.35));
    oval(ctx, c, c.main, 0, 0, 22, 18);
    patch(ctx, c.light, 0, 8, 11, 7);
    eyes(ctx, 8, -2, 3.4, '#7F1D1D');
    nose(ctx, 5, 2.6);
    ctx.restore();
  }
};

const wolfSpec = (head: number, body: [number, number], tail: number) => ({
  head, body, snout: true, eyeR: head * 0.16,
  behind: (k: PetCtx, c: Pal) => bushyTail(k, c, c.main, 10, 44, 0.2, tail, null),
  ears: (k: PetCtx, c: Pal) => earsPointy(k, c, c.main, head * 0.5, headY({ head, body }) - head * 0.5, head * 0.85, head * 0.4, '#3A3A44'),
});
const wolfPup: Form = (ctx, c) => mammal(ctx, c, wolfSpec(24, [16, 13], 0.5));
const youngWolf: Form = (ctx, c) => mammal(ctx, c, wolfSpec(22, [20, 18], 0.75));
/** A fluffy ruff of fur under the chin. */
const ruff = (ctx: PetCtx, c: Pal, fill: Paint, y: number) => {
  for (const [x, dy, r] of [[-16, 2, 7], [16, 2, 7], [-8, 6, 8], [8, 6, 8], [0, 8, 8]] as const) shape(ctx, fill, c.line, () => ellipse(ctx, x, y + dy, r, r * 0.8));
};
const wolf: Form = (ctx, c) => mammal(ctx, c, { ...wolfSpec(24, [24, 23], 0.95), front: (k) => ruff(k, c, c.light, 24) });
const moonWolf: Form = (ctx, c) => {
  aura(ctx, '160, 190, 255');
  shape(ctx, '#F4E7C5', null, () => { ctx.arc(-26, -36, 12, 0, Math.PI * 2); });
  mammal(ctx, c, { ...wolfSpec(24, [24, 23], 1), front: (k) => { ruff(k, c, lit(k, '#2B2F6B'), 24); for (const [x, y] of [[-10, 28], [4, 31], [14, 27]] as const) star5(k, x, y, 2.2, '#FFF3C4'); } });
};

const mane = (ctx: PetCtx, colors: string[], x: number, y: number, len: number) => colors.forEach((color, i) => curve(ctx, color, [x + i * 3, y + i * 4, x + 8 + i * 3, y + len * 0.5 + i * 4, x + 4 + i * 3, y + len + i * 4], 5));
const horseSpec = (head: number, body: [number, number], tailLen: number, colors: string[]) => ({
  head, body, headRy: 1.1, eyeR: head * 0.15, noseColor: null as null, mouth: 'none' as const,
  markings: (k: PetCtx, c: Pal, hy: number) => {
    oval(k, c, c.light, 0, hy + head * 0.55, head * 0.62, head * 0.45);
    both((side) => patch(k, mixed(c.hex, '#000000', 0.55), side * head * 0.22, hy + head * 0.55, head * 0.07, head * 0.1));
    smile(k, c, hy + head * 0.78, head * 0.16);
  },
  behind: (k: PetCtx, c: Pal) => colors.forEach((color, i) => curve(k, color, [16, 34 + i * 3, 34, 30 + i * 4, 30 + i * 2, 30 + tailLen + i * 3], 5)),
  ears: (k: PetCtx, c: Pal) => earsPointy(k, c, c.main, head * 0.45, headY({ head, body }) - head * 0.55, head * 0.6, head * 0.3, null),
  // The mane runs down the left side of the head and neck.
  behindMane: (k: PetCtx) => mane(k, colors, -head * 1.05, headY({ head, body }) - head * 0.75, head * 1.4),
});
const horseForm = (head: number, body: [number, number], tailLen: number, colors: (c: Pal) => string[]): Form => (ctx, c) => {
  const spec = horseSpec(head, body, tailLen, colors(c));
  mammal(ctx, c, { ...spec, front: (k) => spec.behindMane(k) });
};
const foal = horseForm(22, [15, 13], 10, (c) => [mixed(c.hex, '#000000', 0.4)]);
const pony = horseForm(22, [20, 18], 16, (c) => [mixed(c.hex, '#000000', 0.4), mixed(c.hex, '#000000', 0.25)]);
const horse = horseForm(24, [24, 23], 22, (c) => [mixed(c.hex, '#000000', 0.45), mixed(c.hex, '#000000', 0.3), mixed(c.hex, '#000000', 0.45)]);
const pegacorn: Form = (ctx, c) => {
  aura(ctx, '255, 210, 255');
  wingsFeather(ctx, c, lit(ctx, '#FFFFFF'), 6, 52, 26);
  const spec = horseSpec(24, [24, 23], 22, ['#F472B6', '#FBBF24', '#34D399', '#60A5FA']);
  mammal(ctx, c, { ...spec, front: (k) => spec.behindMane(k) });
  const hy = headY(spec);
  shape(ctx, GOLD, '#8A6410', () => { ctx.moveTo(-4, hy - 20); ctx.lineTo(4, hy - 20); ctx.lineTo(1, hy - 42); ctx.closePath(); });
  for (const t of [0.3, 0.55, 0.8]) curve(ctx, '#8A6410', [-3.4 + t * 2, hy - 20 - t * 20, 0, hy - 18 - t * 20, 3.4 - t * 2, hy - 22 - t * 20], 1.2);
};

const shellPlates = (ctx: PetCtx, c: Pal, y: number, w: number, h: number) => {
  for (const [x, yy, r] of [[0, y - h * 0.45, w * 0.22], [-w * 0.5, y - h * 0.2, w * 0.18], [w * 0.5, y - h * 0.2, w * 0.18]] as const) shape(ctx, c.light, c.line, () => ellipse(ctx, x, yy, r, r * 0.75));
};
const turtleEgg: Form = (ctx, c) => egg(ctx, c, lit(ctx, '#EFE6D2'), '#D9CBB0', true, true, 20, 24);
const turtle = (shell: number): Form => (ctx, c) => {
  const green = lit(ctx, '#8BC48A');
  both((side) => oval(ctx, c, green, side * shell * 0.75, 46, 8, 5));
  shape(ctx, c.main, c.line, () => { ctx.moveTo(-shell, 40); ctx.bezierCurveTo(-shell, 40 - shell * 1.25, shell, 40 - shell * 1.25, shell, 40); ctx.closePath(); });
  shellPlates(ctx, c, 40, shell, shell * 1.25);
  oval(ctx, c, green, 0, 40, shell * 0.6, shell * 0.48);
  eyes(ctx, shell * 0.22, 36, shell * 0.12, INK);
  smile(ctx, c, 44, shell * 0.12);
};
const islandTurtle: Form = (ctx, c) => {
  aura(ctx, '120, 220, 180');
  patch(ctx, 'rgba(90, 170, 220, 0.55)', 0, 48, 50, 6);
  turtle(30)(ctx, c);
  shape(ctx, lit(ctx, '#6FBF4A'), c.line, () => { ctx.moveTo(-26, 8); ctx.bezierCurveTo(-18, -6, 18, -6, 26, 8); ctx.quadraticCurveTo(0, 2, -26, 8); });
  curve(ctx, '#7A4A2A', [4, 0, 8, -16, 6, -32], 4);
  for (const r of [-1.9, -1.2, -0.5, 0.2]) leaf(ctx, 6, -32, 16, r, '#3F9A3A');
  patch(ctx, '#C2410C', -8, -2, 4, 3);
  shape(ctx, '#F4E7C5', '#7A4A2A', () => { ctx.moveTo(-14, 2); ctx.lineTo(-14, -6); ctx.lineTo(-8, -11); ctx.lineTo(-2, -6); ctx.lineTo(-2, 2); ctx.closePath(); });
};

const roe: Form = (ctx, c) => {
  for (const [x, y, r] of [[-16, 40, 8], [14, 42, 7], [-4, 26, 7], [18, 26, 6], [-20, 22, 5]] as const) {
    shape(ctx, 'rgba(255, 220, 180, 0.45)', 'rgba(255, 200, 160, 0.9)', () => ellipse(ctx, x, y, r, r));
    patch(ctx, 'rgba(255, 140, 60, 0.8)', x + r * 0.2, y + r * 0.1, r * 0.3, r * 0.3);
  }
  shape(ctx, lit(ctx, '#FFE2C2'), 'rgba(230, 160, 110, 0.95)', () => ellipse(ctx, 0, 34, 12, 12));
  eyes(ctx, 4, 33, 3, INK);
};
const youngCarp: Form = (ctx, c) => fish(ctx, c, 22, 12, c.dark, 26);
const koiSpots = (ctx: PetCtx, y: number) => { for (const [x, yy, r] of [[-6, -6, 6], [8, 2, 5], [16, -4, 4]] as const) patch(ctx, '#FFFFFF', x, y + yy, r, r * 0.8); };
const koi: Form = (ctx, c) => { fish(ctx, c, 32, 15, c.light, 20); koiSpots(ctx, 20); };
const dragonKoi: Form = (ctx, c) => {
  aura(ctx, '255, 200, 90');
  fish(ctx, c, 36, 16, lit(ctx, GOLD), 14);
  koiSpots(ctx, 14);
  hornPair(ctx, c, GOLD, 16, 2, 14, 3, -6);
  ctx.save();
  ctx.translate(-20, 0);
  hornPair(ctx, c, GOLD, 4, 2, 14, 2.6, -8);
  ctx.restore();
  curve(ctx, GOLD, [-34, 20, -46, 26, -48, 40], 2);
  curve(ctx, GOLD, [-34, 18, -48, 12, -50, 0], 2);
};

const snailEggs: Form = (ctx, c) => {
  for (const [x, y, r] of [[-12, 42, 7], [12, 42, 7], [0, 30, 8]] as const) oval(ctx, c, lit(ctx, '#F4EEDF'), x, y, r, r);
  eyes(ctx, 3.5, 29, 2.6, INK);
};
const snail = (shell: number, crystals = false): Form => (ctx, c) => {
  const body = lit(ctx, '#C9D7A8');
  shape(ctx, body, c.line, () => { ctx.moveTo(-shell * 1.2, 50); ctx.quadraticCurveTo(-shell * 1.3, 30, -shell * 0.8, 26); ctx.lineTo(shell, 40); ctx.quadraticCurveTo(shell * 1.3, 50, shell * 0.6, 50); ctx.closePath(); });
  both((side) => curve(ctx, c.line, [-shell * 0.9 + side * 3, 24, -shell * 0.95 + side * 5, 14, -shell * 0.9 + side * 7, 10], 2));
  oval(ctx, c, c.main, shell * 0.25, 50 - shell * 1.05, shell * 0.95, shell * 0.95);
  curve(ctx, c.line, [shell * 0.25, 50 - shell * 1.05, shell * 0.6, 50 - shell * 1.4, shell * 0.75, 50 - shell * 0.95, shell * 0.5, 50 - shell * 0.4, shell * 0.05, 50 - shell * 0.75], 2);
  if (crystals) for (const [x, h, r] of [[-0.2, 1.1, -0.5], [0.3, 1.4, 0], [0.75, 1.1, 0.5]] as const) crystal(ctx, shell * x, 50 - shell * 1.6, shell * h * 0.6, shell * 0.16, 'rgba(160, 235, 255, 0.92)', '#2563EB', r);
  eyes(ctx, 3.5, 30, shell * 0.12, INK);
  ctx.save();
  ctx.translate(-shell * 0.8, 0);
  smile(ctx, c, 36, 3);
  ctx.restore();
};
const crystalSnail: Form = (ctx, c) => { aura(ctx, '120, 210, 255'); snail(26, true)(ctx, c); };

const spikes = (ctx: PetCtx, c: Pal, fill: Paint, cy: number, rx: number, ry: number, n: number, len: number) => {
  shape(ctx, fill, c.line, () => {
    for (let i = 0; i <= n; i += 1) {
      const a = Math.PI + (i / n) * Math.PI;
      const mid = Math.PI + ((i + 0.5) / n) * Math.PI;
      const [x, y] = [Math.cos(a) * rx, cy + Math.sin(a) * ry];
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      if (i < n) ctx.lineTo(Math.cos(mid) * (rx + len), cy + Math.sin(mid) * (ry + len));
    }
    ctx.closePath();
  });
};
const hedgehog = (r: number, len: number, crystalSpikes = false): Form => (ctx, c) => {
  if (crystalSpikes) {
    for (let i = 0; i < 9; i += 1) { const a = Math.PI + 0.2 + (i / 8) * (Math.PI - 0.4); crystal(ctx, Math.cos(a) * r * 0.9, 50 - r + Math.sin(a) * r * 0.85, len * 1.6, 3.6, 'rgba(196, 160, 255, 0.95)', '#5B21B6', a + Math.PI / 2); }
  } else spikes(ctx, c, c.dark, 50 - r * 0.9, r, r * 0.95, 11, len);
  oval(ctx, c, lit(ctx, '#E9D8BF'), -r * 0.15, 50 - r * 0.7, r * 0.8, r * 0.7);
  eyes(ctx, r * 0.25, 50 - r * 0.85, r * 0.13, INK);
  nose(ctx, 50 - r * 0.55, r * 0.1);
  smile(ctx, c, 50 - r * 0.4, r * 0.12);
  cheeks(ctx, r * 0.45, 50 - r * 0.55);
  feet(ctx, c, r * 0.45, 5, lit(ctx, '#E9D8BF'));
};

const bat = (body: number, span: number, earH: number): Form => (ctx, c) => {
  if (span) wingsBat(ctx, c, c.dark, 50 - body * 1.2, span, span * 0.5);
  earsPointy(ctx, c, c.main, body * 0.55, 50 - body * 1.7, earH, body * 0.4, '#FFB3C1');
  oval(ctx, c, c.main, 0, 50 - body, body, body);
  patch(ctx, c.light, 0, 50 - body * 0.7, body * 0.55, body * 0.5);
  eyes(ctx, body * 0.38, 50 - body * 1.15, body * 0.17, INK);
  shape(ctx, '#FFFFFF', null, () => { ctx.moveTo(-3, 50 - body * 0.8); ctx.lineTo(-1.5, 50 - body * 0.65); ctx.lineTo(0, 50 - body * 0.8); ctx.closePath(); });
  feet(ctx, c, body * 0.4, 5, c.dark);
};
const vampire: Form = (ctx, c) => {
  aura(ctx, '220, 40, 60');
  shape(ctx, lit(ctx, '#7F1D1D'), c.line, () => { ctx.moveTo(-20, 0); ctx.lineTo(-34, 50); ctx.lineTo(34, 50); ctx.lineTo(20, 0); ctx.closePath(); });
  bat(22, 56, 18)(ctx, c);
  shape(ctx, lit(ctx, '#2B1A2E'), c.line, () => { ctx.moveTo(-18, 6); ctx.lineTo(-24, -6); ctx.lineTo(-8, 2); ctx.closePath(); ctx.moveTo(18, 6); ctx.lineTo(24, -6); ctx.lineTo(8, 2); ctx.closePath(); });
};

const squirrelTail = (len: number): Form => (ctx, c) => bushyTail(ctx, c, c.main, 12, 46, -0.1, len, null);
const squirrelEars = (head: number, body: [number, number]): Form => (ctx, c) => earsPointy(ctx, c, c.main, head * 0.55, headY({ head, body }) - head * 0.5, head * 0.55, head * 0.3, null);
const squirrelBaby: Form = (ctx, c) => mammal(ctx, c, { head: 24, body: [15, 12], eyeR: 4.6, behind: squirrelTail(0.55), ears: squirrelEars(24, [15, 12]) });
const squirrelYouth: Form = (ctx, c) => mammal(ctx, c, { head: 22, body: [19, 17], eyeR: 3.9, behind: squirrelTail(0.85), ears: squirrelEars(22, [19, 17]) });
const acorn = (ctx: PetCtx, c: Pal, x: number, y: number) => { oval(ctx, c, lit(ctx, '#C98A4B'), x, y + 3, 5, 6); shape(ctx, '#7A4A2A', c.line, () => { ctx.moveTo(x - 6, y); ctx.quadraticCurveTo(x, y - 7, x + 6, y); ctx.closePath(); }); };
const squirrel: Form = (ctx, c) => mammal(ctx, c, { head: 24, body: [23, 22], eyeR: 3.6, behind: squirrelTail(1.1), ears: squirrelEars(24, [23, 22]), front: (k) => acorn(k, c, 0, 30) });
const cloudSquirrel: Form = (ctx, c) => {
  aura(ctx, '170, 220, 255');
  cloud(ctx, 0, 48, 34, '#F4F8FF', '#A9B9D6');
  for (const [x, y, s] of [[26, 20, 16], [36, -2, 18], [30, -24, 14]] as const) cloud(ctx, x, y, s, '#FFFFFF', '#A9B9D6');
  scaled(ctx, 0.9, () => mammal(ctx, c, { head: 24, body: [22, 21], eyeR: 3.6, ears: squirrelEars(24, [22, 21]) }));
};

const hamster = (head: number, cheeks2 = 0): Form => (ctx, c) => {
  const body: [number, number] = [head * 0.95, head * 0.75];
  mammal(ctx, c, {
    head, body, eyeR: head * 0.17, noseColor: '#FF8FA3',
    ears: (k) => earsRound(k, c, c.main, head * 0.7, headY({ head, body }) - head * 0.65, head * 0.25, '#FFB3C1'),
    markings: cheeks2 ? (k, _c, hy) => both((side) => oval(k, c, c.light, side * head * 0.75, hy + head * 0.25, head * 0.35 * cheeks2, head * 0.3 * cheeks2)) : undefined,
  });
};
const hamsterAdult: Form = (ctx, c) => {
  hamster(26, 1)(ctx, c);
  oval(ctx, c, lit(ctx, '#3A3A44'), 0, 32, 4, 7, 0.4);
  patch(ctx, '#E5E7EB', 1, 30, 1.4, 4, 0.4);
};
const hamsterKnight: Form = (ctx, c) => {
  aura(ctx, '255, 214, 102');
  hamster(26, 1)(ctx, c);
  const hy = headY({ head: 26, body: [24.7, 19.5] });
  shape(ctx, lit(ctx, '#CBD5E1'), '#475569', () => { ctx.moveTo(-24, hy - 4); ctx.bezierCurveTo(-24, hy - 34, 24, hy - 34, 24, hy - 4); ctx.lineTo(16, hy - 4); ctx.lineTo(16, hy - 12); ctx.lineTo(-16, hy - 12); ctx.lineTo(-16, hy - 4); ctx.closePath(); });
  curve(ctx, '#E5484D', [0, hy - 28, 10, hy - 44, 22, hy - 40], 6);
  shape(ctx, lit(ctx, '#2563EB'), '#1E3A8A', () => ellipse(ctx, -22, 34, 12, 14));
  star5(ctx, -22, 34, 6, GOLD);
  curve(ctx, '#94A3B8', [22, 46, 26, 28, 30, 12], 3);
};

const grub: Form = (ctx, c) => {
  shape(ctx, lit(ctx, '#FFF4D6'), c.line, () => { ctx.arc(0, 30, 20, 0.4, Math.PI * 1.6); ctx.arc(-4, 26, 8, Math.PI * 1.4, 0.2, true); ctx.closePath(); });
  for (const a of [0.9, 1.5, 2.1, 2.7, 3.3]) curve(ctx, c.line, [Math.cos(a) * 12, 30 + Math.sin(a) * 12, Math.cos(a) * 16, 30 + Math.sin(a) * 16, Math.cos(a) * 20, 30 + Math.sin(a) * 20], 1.2);
  eyes(ctx, 3, 26, 2.4, INK);
};
const pupa: Form = (ctx, c) => {
  oval(ctx, c, lit(ctx, '#F2E3B8'), 0, 18, 15, 30);
  both((side) => shape(ctx, 'rgba(255, 255, 255, 0.4)', c.line, () => ellipse(ctx, side * 10, 18, 7, 18, side * 0.2)));
  for (const y of [28, 36, 44]) curve(ctx, c.line, [-12, y, 0, y + 3, 12, y], 1.2);
  eyes(ctx, 5, 0, 2.8, INK);
};
const beeBody = (ctx: PetCtx, c: Pal, r: number, y: number) => {
  oval(ctx, c, lit(ctx, '#FBBF24'), 0, y, r, r * 1.1);
  for (const dy of [-0.2, 0.25, 0.65]) shape(ctx, '#2B2B33', null, () => ellipse(ctx, 0, y + r * dy, r * 0.95 * Math.cos(dy * 0.9), r * 0.16));
};
const bee: Form = (ctx, c) => {
  wingsInsect(ctx, c, 'rgba(220, 240, 255, 0.8)', 'rgba(220, 240, 255, 0.8)', 0, 46);
  beeBody(ctx, c, 20, 26);
  both((side) => curve(ctx, '#2B2B33', [side * 4, 4, side * 8, -6, side * 12, -8], 2));
  eyes(ctx, 7, 14, 3.4, INK);
  smile(ctx, c, 20, 3);
  shape(ctx, '#2B2B33', null, () => { ctx.moveTo(-3, 49); ctx.lineTo(3, 49); ctx.lineTo(0, 55); ctx.closePath(); });
};
const queenBee: Form = (ctx, c) => {
  aura(ctx, '255, 200, 60');
  wingsInsect(ctx, c, 'rgba(255, 245, 210, 0.85)', 'rgba(255, 245, 210, 0.85)', -2, 60);
  beeBody(ctx, c, 24, 22);
  eyes(ctx, 8, 8, 3.6, INK);
  smile(ctx, c, 15, 3.2);
  shape(ctx, GOLD, '#8A6410', () => { ctx.moveTo(-10, -12); ctx.lineTo(-11, -22); ctx.lineTo(-5, -16); ctx.lineTo(0, -24); ctx.lineTo(5, -16); ctx.lineTo(11, -22); ctx.lineTo(10, -12); ctx.closePath(); });
  shape(ctx, '#F59E0B', null, () => { ctx.moveTo(-20, 34); ctx.quadraticCurveTo(-22, 46, -18, 48); ctx.quadraticCurveTo(-14, 46, -16, 34); });
};

const octoEgg: Form = (ctx, c) => {
  shape(ctx, 'rgba(255, 240, 230, 0.55)', c.line, () => ellipse(ctx, 0, 26, 20, 24));
  scaled(ctx, 0.45, () => { ctx.translate(0, -30); octopus(4, 4)(ctx, c); });
};
const octopus = (n: number, len: number): Form => (ctx, c) => {
  for (let i = 0; i < n; i += 1) {
    const x = -18 + (36 * i) / (n - 1);
    ropeTail(ctx, c, c.hex, [x * 0.6, 30, x, 40, x * 1.2 + (i % 2 ? 4 : -4), 40 + len], 6);
  }
  oval(ctx, c, c.main, 0, 14, 22, 24);
  eyes(ctx, 8, 14, 3.8, INK);
  smile(ctx, c, 22, 3);
  cheeks(ctx, 14, 20);
};
const kraken: Form = (ctx, c) => {
  aura(ctx, '40, 120, 200');
  for (let i = 0; i < 8; i += 1) {
    const a = Math.PI * (0.05 + (i / 7) * 0.9);
    ropeTail(ctx, c, c.hex, [0, 20, Math.cos(a) * 30, 20 + Math.sin(a) * 30, Math.cos(a) * 46, 18 + Math.sin(a) * 26 - (i % 2) * 12], 8);
  }
  oval(ctx, c, c.main, 0, 0, 28, 30);
  for (const [x, y] of [[-10, -18], [10, -20], [0, -8]] as const) patch(ctx, 'rgba(120, 255, 230, 0.6)', x, y, 3, 3);
  eyes(ctx, 10, 2, 4.4, '#0F3B4A');
};

const polyp: Form = (ctx, c) => {
  curve(ctx, c.line, [0, 50, 2, 36, 0, 24], 6);
  curve(ctx, c.hex, [0, 50, 2, 36, 0, 24], 3.4);
  oval(ctx, c, c.main, 0, 20, 10, 8);
  for (let i = 0; i < 6; i += 1) curve(ctx, c.hex, [0, 14, -12 + i * 5, 2, -14 + i * 5.6, -6], 2);
  eyes(ctx, 3.4, 20, 2.2, INK);
};
const ephyra: Form = (ctx, c) => {
  shape(ctx, c.main, c.line, () => { for (let i = 0; i < 16; i += 1) { const a = (i / 16) * Math.PI * 2; const r = i % 2 ? 12 : 22; if (i) ctx.lineTo(Math.cos(a) * r, 16 + Math.sin(a) * r); else ctx.moveTo(r, 16); } ctx.closePath(); });
  eyes(ctx, 5, 14, 2.8, INK);
  smile(ctx, c, 20, 2.6);
};
const jelly = (galaxy: boolean): Form => (ctx, c) => {
  for (let i = 0; i < 5; i += 1) curve(ctx, galaxy ? '#C4B5FD' : c.hex, [-12 + i * 6, 10, -16 + i * 7, 30, -10 + i * 6, 48], 2.4);
  const bell = galaxy ? lit(ctx, '#3B2A7A') : c.main;
  shape(ctx, bell, c.line, () => { ctx.moveTo(-26, 10); ctx.bezierCurveTo(-26, -30, 26, -30, 26, 10); ctx.quadraticCurveTo(18, 14, 13, 10); ctx.quadraticCurveTo(6, 15, 0, 10); ctx.quadraticCurveTo(-6, 15, -13, 10); ctx.quadraticCurveTo(-18, 14, -26, 10); ctx.closePath(); });
  if (galaxy) for (const [x, y, r] of [[-12, -10, 2], [8, -16, 1.6], [14, -4, 2.2], [-4, 0, 1.4]] as const) star5(ctx, x, y, r * 1.6, '#FFF3C4');
  patch(ctx, 'rgba(255, 255, 255, 0.35)', -10, -12, 7, 4, -0.5);
  eyes(ctx, 8, -2, 3.2, galaxy ? '#0B0820' : INK);
  smile(ctx, c, 4, 3);
};
const starJelly: Form = (ctx, c) => { aura(ctx, '170, 140, 255'); jelly(true)(ctx, c); };

// ---------- 25–39 ----------

const seahorse = (k: number, leafy: boolean): Form => (ctx, c) => scaled(ctx, k, () => {
  if (leafy) for (const [x, y, r] of [[14, -20, 0.6], [18, 0, 1.2], [16, 20, 1.6], [-14, 8, -1.2], [-12, -26, -0.6]] as const) leaf(ctx, x, y, 16, r, '#7ED957');
  shape(ctx, c.main, c.line, () => {
    ctx.moveTo(-6, -30);
    ctx.bezierCurveTo(12, -40, 18, -16, 8, -4);
    ctx.bezierCurveTo(20, 8, 18, 30, 4, 38);
    ctx.bezierCurveTo(-4, 44, 6, 52, 12, 46);
    ctx.bezierCurveTo(6, 56, -12, 48, -6, 36);
    ctx.bezierCurveTo(4, 26, 2, 10, -8, 0);
    ctx.bezierCurveTo(-12, -6, -12, -14, -6, -18);
    ctx.lineTo(-24, -20);
    ctx.lineTo(-24, -26);
    ctx.closePath();
  });
  for (const y of [6, 14, 22]) curve(ctx, c.line, [-2, y, 6, y + 2, 12, y], 1.2);
  shape(ctx, c.light, c.line, () => { ctx.moveTo(12, -14); ctx.quadraticCurveTo(24, -10, 16, 2); ctx.closePath(); });
  ctx.save();
  ctx.translate(-2, 0);
  eyes(ctx, 0, -24, 3.2, INK);
  ctx.restore();
});
const seaDragon: Form = (ctx, c) => { aura(ctx, '120, 220, 140'); seahorse(1.15, true)(ctx, c); };

const zoea: Form = (ctx, c) => {
  shape(ctx, 'rgba(255, 200, 180, 0.7)', c.line, () => { ctx.moveTo(0, 6); ctx.lineTo(4, 22); ctx.lineTo(-4, 22); ctx.closePath(); });
  oval(ctx, c, lit(ctx, '#FFD6C8'), 0, 32, 14, 12);
  curve(ctx, c.line, [8, 40, 18, 46, 26, 44], 2);
  eyes(ctx, 5, 30, 3.6, INK);
};
const crab = (w: number, claw: number, crystalClaw = false): Form => (ctx, c) => {
  both((side) => { for (const i of [0, 1, 2]) curve(ctx, c.line, [side * w * 0.6, 40, side * (w + 6 + i * 2), 36 + i * 5, side * (w + 8 + i * 3), 48], 3); });
  both((side) => {
    curve(ctx, c.line, [side * w * 0.7, 30, side * (w + 4), 22, side * (w + 8), 12], 4);
    const x = side * (w + 10);
    if (crystalClaw && side === 1) crystal(ctx, x, 14, claw * 2.2, claw * 0.7, 'rgba(160, 235, 255, 0.95)', '#2563EB', 0.3);
    else shape(ctx, c.main, c.line, () => { ctx.moveTo(x, 12); ctx.arc(x, 4, claw, Math.PI * 0.5, Math.PI * 2.1); ctx.lineTo(x, 4); ctx.closePath(); });
  });
  oval(ctx, c, c.main, 0, 36, w, w * 0.62);
  both((side) => { curve(ctx, c.line, [side * 6, 26, side * 7, 18, side * 8, 14], 2.4); });
  ctx.save();
  ctx.translate(0, -16);
  eyes(ctx, 8, 30, 3.4, INK);
  ctx.restore();
  smile(ctx, c, 38, 4);
};
const titanCrab: Form = (ctx, c) => { aura(ctx, '120, 200, 255'); crab(28, 11, true)(ctx, c); for (const [x, y] of [[-12, 28], [10, 26]] as const) patch(ctx, '#E5E7EB', x, y, 3, 2.4); };

const snakeEgg: Form = (ctx, c) => egg(ctx, c, lit(ctx, '#F4EEDF'), null, true, true, 18, 26);
const coils = (n: number, w: number): Form => (ctx, c) => {
  for (let i = 0; i < n; i += 1) oval(ctx, c, i % 2 ? c.main : c.dark, 0, 44 - i * 9, w - i * 3, 8);
};
const snake = (n: number, w: number, head: number): Form => (ctx, c) => {
  coils(n, w)(ctx, c);
  const hy = 44 - n * 9 - head * 0.5;
  oval(ctx, c, c.main, 0, hy, head * 1.1, head * 0.85);
  eyes(ctx, head * 0.4, hy - 2, head * 0.17, INK);
  curve(ctx, '#E5484D', [0, hy + head * 0.6, 0, hy + head * 0.9, -3, hy + head * 1.1], 1.6);
  cheeks(ctx, head * 0.7, hy + 4);
};
const featherSerpent: Form = (ctx, c) => {
  aura(ctx, '120, 230, 160');
  wingsFeather(ctx, c, lit(ctx, '#34D399'), 6, 50, 30);
  for (const [x, color] of [[-8, '#F43F5E'], [0, '#FBBF24'], [8, '#22D3EE']] as const) leaf(ctx, x, -14, 16, x * 0.04, color);
  snake(4, 22, 18)(ctx, c);
};

const chameleon = (k: number, rainbow: boolean): Form => (ctx, c) => scaled(ctx, k, () => {
  ropeTail(ctx, c, rainbow ? '#A855F7' : c.hex, [16, 34, 34, 34, 32, 22, 30, 10, 24, 18], 6);
  const body = rainbow ? (() => { const g = ctx.createRadialGradient(-10, 0, 4, 0, 20, 40) as { addColorStop(o: number, s: string): void }; ['#F43F5E', '#FBBF24', '#34D399', '#60A5FA', '#A855F7'].forEach((col, i) => g.addColorStop(i / 4, col)); return g; })() : c.main;
  oval(ctx, c, body, 2, 32, 22, 14);
  shape(ctx, body, c.line, () => { ctx.moveTo(-26, 26); ctx.quadraticCurveTo(-26, 4, -6, 10); ctx.lineTo(-6, 30); ctx.closePath(); });
  shape(ctx, body, c.line, () => { ctx.moveTo(-18, 8); ctx.lineTo(-10, -4); ctx.lineTo(-6, 10); ctx.closePath(); });
  both((side) => oval(ctx, c, c.dark, 2 + side * 12, 44, 4, 5));
  oval(ctx, c, c.light, -14, 18, 6, 6);
  ctx.save();
  ctx.translate(-14, 0);
  eyes(ctx, 0, 18, 3, INK);
  ctx.restore();
  smile(ctx, c, 26, 3);
});
const rainbowChameleon: Form = (ctx, c) => { aura(ctx, '255, 255, 255', 60, 10, 0.3); chameleon(1.15, true)(ctx, c); };

const slothMask = (k: PetCtx, _c: Pal, hy: number) => { both((side) => patch(k, '#5C4433', side * 9, hy, 7, 4.5, side * 0.35)); patch(k, '#EFE2CC', 0, hy + 8, 9, 6); };
const sloth = (head: number, body: [number, number], arms = true): Form => (ctx, c) => mammal(ctx, c, {
  head, body, eyeR: head * 0.15, noseColor: '#3B2A1E', markings: slothMask,
  front: arms ? (k) => both((side) => oval(k, c, c.main, side * body[0] * 0.8, 50 - body[1] * 0.9, 5, 13, side * 0.3)) : undefined,
});
const forestKeeper: Form = (ctx, c) => {
  aura(ctx, '120, 210, 110');
  sloth(25, [24, 23])(ctx, c);
  for (const [x, y, rx] of [[-14, 18, 8], [12, 28, 7], [-4, 38, 6]] as const) patch(ctx, '#5FA35A', x, y, rx, rx * 0.6);
  const hy = headY({ head: 25, body: [24, 23] });
  for (const [x, color] of [[-12, '#F472B6'], [0, '#FBBF24'], [12, '#F472B6']] as const) flower(ctx, x, hy - 22, 3.2, color);
  curve(ctx, '#3F7D20', [0, hy - 24, 2, hy - 32, 0, hy - 40], 2);
  leaf(ctx, 0, hy - 38, 9, 0.5, '#6FBF4A');
};

const raccoonMask = (k: PetCtx, _c: Pal, hy: number) => shape(k, '#2B2B33', null, () => { k.moveTo(-20, hy - 2); k.quadraticCurveTo(0, hy - 12, 20, hy - 2); k.quadraticCurveTo(10, hy + 8, 0, hy + 2); k.quadraticCurveTo(-10, hy + 8, -20, hy - 2); });
const ringTail = (len: number): Form => (ctx, c) => {
  ctx.save();
  ctx.translate(12, 44);
  ctx.rotate(-0.6);
  for (let i = 0; i < 5; i += 1) oval(ctx, c, i % 2 ? '#2B2B33' : c.main, i * 6 * len, 0, 6 * len, 7 * len);
  ctx.restore();
};
const raccoon = (head: number, body: [number, number], tail: number): Form => (ctx, c) => mammal(ctx, c, {
  head, body, eyeR: head * 0.16, snout: true, markings: raccoonMask, behind: ringTail(tail),
  ears: (k) => earsPointy(k, c, c.main, head * 0.55, headY({ head, body }) - head * 0.45, head * 0.5, head * 0.32, '#2B2B33'),
});
const masterThief: Form = (ctx, c) => {
  aura(ctx, '255, 214, 102');
  shape(ctx, lit(ctx, '#5B21B6'), c.line, () => { ctx.moveTo(-18, 0); ctx.lineTo(-36, 50); ctx.lineTo(36, 50); ctx.lineTo(18, 0); ctx.closePath(); });
  raccoon(24, [23, 22], 1.1)(ctx, c);
  oval(ctx, c, lit(ctx, '#C9A36A'), -30, 36, 11, 12);
  curve(ctx, '#7A4A2A', [-36, 26, -30, 22, -24, 26], 2);
  shape(ctx, GOLD, '#8A6410', () => ellipse(ctx, -30, 38, 4, 4));
};

const sparrow = (r: number): Form => (ctx, c) => bird(ctx, c, { body: [r, r * 1.05], eyeR: r * 0.17, wing: c.dark });
const thunderbird: Form = (ctx, c) => {
  aura(ctx, '150, 170, 255');
  wingsFeather(ctx, c, lit(ctx, '#3B4A8C'), 0, 52, 30);
  both((side) => shape(ctx, '#FDE047', '#A16207', () => { const x = side * 40; ctx.moveTo(x, -26); ctx.lineTo(x - side * 6, -12); ctx.lineTo(x, -12); ctx.lineTo(x - side * 4, 2); ctx.lineTo(x + side * 6, -16); ctx.lineTo(x, -16); ctx.closePath(); }));
  bird(ctx, c, { body: [24, 26], eyeR: 3.8, wing: c.dark, beakColor: '#FDE047' });
};

const parrot = (r: number, tail: number, rainbow: boolean): Form => (ctx, c) => {
  const colors = rainbow ? ['#F43F5E', '#FBBF24', '#34D399', '#3B82F6'] : [c.hex, mixed(c.hex, '#000000', 0.25)];
  colors.forEach((color, i) => shape(ctx, lit(ctx, color), c.line, () => ellipse(ctx, 6 + i * 3, 50 - r + r * 0.9 + tail * 0.4, 4, tail, 0.25 - i * 0.12)));
  bird(ctx, rainbow ? { ...c, main: lit(ctx, '#EF4444'), light: lit(ctx, '#FDE68A'), dark: lit(ctx, '#2563EB') } : c, { body: [r, r * 1.1], eyeR: r * 0.15, beakColor: '#2B2B33', tuft: rainbow });
};
const rainbowMacaw: Form = (ctx, c) => { aura(ctx, '255, 200, 120'); wingsFeather(ctx, c, lit(ctx, '#3B82F6'), 8, 48, 24); parrot(24, 22, true)(ctx, c); };

const spore: Form = (ctx, c) => {
  aura(ctx, '200, 255, 160', 34, 30, 0.5);
  oval(ctx, c, c.light, 0, 34, 14, 14);
  for (const [x, y] of [[-6, 28], [6, 40], [8, 28]] as const) patch(ctx, c.dark, x, y, 1.6, 1.6);
  eyes(ctx, 5, 33, 2.8, INK);
};
const mushroom = (cap: number, stem: number, glow: boolean): Form => (ctx, c) => {
  const stemY = 50 - stem;
  oval(ctx, c, lit(ctx, '#F4EEDF'), 0, 50 - stem * 0.5, cap * 0.45, stem * 0.55);
  shape(ctx, c.main, c.line, () => { ctx.moveTo(-cap, stemY); ctx.bezierCurveTo(-cap, stemY - cap * 1.2, cap, stemY - cap * 1.2, cap, stemY); ctx.quadraticCurveTo(0, stemY + cap * 0.2, -cap, stemY); });
  for (const [x, y, r] of [[-0.45, -0.45, 0.16], [0.25, -0.7, 0.13], [0.5, -0.3, 0.12], [-0.1, -0.2, 0.1]] as const) patch(ctx, glow ? '#D9F99D' : '#FFFDF5', cap * x, stemY + cap * y, cap * r, cap * r * 0.8);
  eyes(ctx, cap * 0.18, 50 - stem * 0.5, cap * 0.1, INK);
  smile(ctx, c, 50 - stem * 0.3, cap * 0.1);
};
const mycelKing: Form = (ctx, c) => {
  aura(ctx, '200, 255, 120');
  for (const x of [-30, -18, 18, 30]) curve(ctx, 'rgba(220, 255, 170, 0.7)', [x * 0.4, 46, x * 0.8, 48, x, 50], 1.6);
  scaled(ctx, 0.5, () => { ctx.translate(-56, 0); mushroom(20, 20, true)(ctx, c); ctx.translate(112, 0); mushroom(18, 16, true)(ctx, c); });
  mushroom(32, 34, true)(ctx, c);
  for (const [x, y] of [[-14, -38], [0, -44], [14, -38]] as const) { oval(ctx, c, lit(ctx, '#F4EEDF'), x, y + 4, 2, 4); oval(ctx, c, lit(ctx, '#A3E635'), x, y, 6, 4); }
};

const slime = (r: number, crown: boolean): Form => (ctx, c) => {
  shape(ctx, c.main, c.line, () => { ctx.moveTo(-r, 50); ctx.bezierCurveTo(-r * 1.05, 50 - r * 1.5, r * 1.05, 50 - r * 1.5, r, 50); ctx.closePath(); });
  patch(ctx, 'rgba(255, 255, 255, 0.45)', -r * 0.4, 50 - r * 0.85, r * 0.18, r * 0.12, -0.5);
  for (const [x, y, s] of [[0.4, 0.3, 0.08], [-0.2, 0.2, 0.06]] as const) shape(ctx, 'rgba(255, 255, 255, 0.35)', null, () => ellipse(ctx, r * x, 50 - r * y, r * s, r * s));
  eyes(ctx, r * 0.3, 50 - r * 0.6, r * 0.13, INK);
  smile(ctx, c, 50 - r * 0.38, r * 0.15);
  if (crown) {
    shape(ctx, GOLD, '#8A6410', () => { const y = 50 - r * 1.08; ctx.moveTo(-12, y + 4); ctx.lineTo(-13, y - 9); ctx.lineTo(-6, y - 2); ctx.lineTo(0, y - 13); ctx.lineTo(6, y - 2); ctx.lineTo(13, y - 9); ctx.lineTo(12, y + 4); ctx.closePath(); });
    shape(ctx, '#E5484D', '#7F1D1D', () => ellipse(ctx, 0, 50 - r * 0.25, 4, 5));
  }
};
const drop: Form = (ctx, c) => {
  shape(ctx, c.main, c.line, () => { ctx.moveTo(0, 6); ctx.bezierCurveTo(8, 22, 20, 30, 18, 40); ctx.bezierCurveTo(16, 52, -16, 52, -18, 40); ctx.bezierCurveTo(-20, 30, -8, 22, 0, 6); });
  patch(ctx, 'rgba(255, 255, 255, 0.45)', -8, 30, 3, 5, 0.3);
  eyes(ctx, 6, 38, 3, INK);
};

const ghost = (r: number, lantern: boolean): Form => (ctx, c) => {
  const body = lit(ctx, '#F4F6FF');
  shape(ctx, body, c.line, () => {
    ctx.moveTo(-r, 40);
    ctx.bezierCurveTo(-r, 40 - r * 2.2, r, 40 - r * 2.2, r, 40);
    for (let i = 0; i < 4; i += 1) ctx.quadraticCurveTo(r - r * 0.25 - i * r * 0.5, 50, r - r * 0.5 - i * r * 0.5, 40);
    ctx.closePath();
  });
  eyes(ctx, r * 0.32, 40 - r * 1.1, r * 0.16, '#3B3550');
  shape(ctx, '#3B3550', null, () => ellipse(ctx, 0, 40 - r * 0.7, r * 0.12, r * 0.15));
  cheeks(ctx, r * 0.55, 40 - r * 0.8);
  if (lantern) {
    const x = r * 1.35;
    const y = 40 - r * 0.9;
    curve(ctx, '#5B4A3A', [r * 0.8, 40 - r * 1.2, x, y - 14, x, y - 4], 2.4);
    const glow = ctx.createRadialGradient(x, y + 14, 2, x, y + 14, 24);
    glow.addColorStop(0, 'rgba(160, 255, 170, 0.6)');
    glow.addColorStop(1, 'rgba(160, 255, 170, 0)');
    shape(ctx, glow, null, () => ellipse(ctx, x, y + 14, 24, 24));
    shape(ctx, lit(ctx, '#3F3A35'), '#1F1A15', () => { ctx.moveTo(x - 9, y - 4); ctx.lineTo(x + 9, y - 4); ctx.lineTo(x + 11, y + 26); ctx.lineTo(x - 11, y + 26); ctx.closePath(); });
    shape(ctx, 'rgba(200, 255, 210, 0.35)', null, () => { ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.lineTo(x + 8, y + 22); ctx.lineTo(x - 8, y + 22); ctx.closePath(); });
    flame(ctx, x, y + 22, 16, '#7EE787', '#E8FFE8');
  }
};
const wisp: Form = (ctx) => {
  aura(ctx, '140, 255, 200', 36, 30, 0.55);
  flame(ctx, 0, 48, 34, 'rgba(140, 255, 200, 0.85)', '#F0FFF7');
  eyes(ctx, 4, 34, 2.6, '#14532D');
};
const lanternGhost: Form = (ctx, c) => { aura(ctx, '140, 255, 160'); ghost(26, true)(ctx, c); };

const pebble: Form = (ctx, c) => { oval(ctx, c, c.main, 0, 38, 18, 12); patch(ctx, c.light, -6, 33, 6, 3, -0.3); eyes(ctx, 6, 36, 2.8, INK); smile(ctx, c, 41, 3); };
const stones: Form = (ctx, c) => {
  oval(ctx, c, c.dark, 0, 40, 22, 11);
  both((side) => oval(ctx, c, c.dark, side * 24, 30, 6, 9, side * 0.4));
  oval(ctx, c, c.main, 0, 20, 17, 13);
  eyes(ctx, 6, 18, 3, INK);
  smile(ctx, c, 24, 3);
};
const golem = (crystals: boolean): Form => (ctx, c) => {
  both((side) => oval(ctx, c, c.dark, side * 30, 24, 9, 18, side * 0.25));
  shape(ctx, c.main, c.line, () => { ctx.moveTo(-24, 50); ctx.lineTo(-28, 14); ctx.lineTo(-18, -4); ctx.lineTo(18, -4); ctx.lineTo(28, 14); ctx.lineTo(24, 50); ctx.closePath(); });
  shape(ctx, c.main, c.line, () => { ctx.moveTo(-14, -2); ctx.lineTo(-16, -22); ctx.lineTo(-6, -30); ctx.lineTo(10, -28); ctx.lineTo(16, -18); ctx.lineTo(14, -2); ctx.closePath(); });
  for (const [x, y] of [[-12, 30], [10, 20], [-4, 40]] as const) patch(ctx, '#5FA35A', x, y, 5, 3);
  eyes(ctx, 6, -16, 3.2, crystals ? '#0E7490' : INK);
  if (crystals) {
    patch(ctx, 'rgba(120, 230, 255, 0.85)', 0, 18, 6, 6);
    for (const [x, y, r] of [[-24, 4, -0.6], [-18, -2, -0.2], [22, 2, 0.5], [26, 10, 0.9]] as const) crystal(ctx, x, y, 18, 4, 'rgba(160, 235, 255, 0.95)', '#2563EB', r);
  }
};
const crystalGolem: Form = (ctx, c) => { aura(ctx, '120, 210, 255'); golem(true)(ctx, c); };

const salamanderEgg: Form = (ctx, c) => {
  shape(ctx, 'rgba(255, 230, 200, 0.55)', c.line, () => ellipse(ctx, 0, 30, 20, 20));
  scaled(ctx, 0.5, () => { ctx.translate(0, -20); salamander(0.8, false)(ctx, c); });
};
const salamander = (k: number, spots: boolean): Form => (ctx, c) => scaled(ctx, k, () => {
  ropeTail(ctx, c, c.hex, [14, 40, 34, 44, 44, 34], 8);
  oval(ctx, c, c.main, 0, 38, 24, 11);
  both((side) => { oval(ctx, c, c.main, side * 14, 46, 5, 4); });
  oval(ctx, c, c.main, -22, 28, 14, 11);
  if (spots) for (const [x, y] of [[-26, 24], [-14, 24], [-4, 34], [10, 36], [20, 38]] as const) patch(ctx, '#FBBF24', x, y, 3, 2.4);
  ctx.save();
  ctx.translate(-22, 0);
  eyes(ctx, 5, 26, 3, INK);
  smile(ctx, c, 31, 3);
  ctx.restore();
});
const flameElemental: Form = (ctx, c) => {
  aura(ctx, '255, 120, 40');
  for (const [x, s] of [[-24, 26], [24, 26], [-12, 40], [12, 40], [0, 54]] as const) flame(ctx, x, 46, s, '#FF5A1F', '#FFD166');
  salamander(1, false)(ctx, { ...c, main: lit(ctx, '#FF8A1F'), light: lit(ctx, '#FFE27A'), dark: lit(ctx, '#C2410C'), hex: '#FF8A1F' });
};

const whale = (len: number, h: number, sky: boolean): Form => (ctx, c) => {
  const y = 50 - h - 4;
  shape(ctx, c.main, c.line, () => { ctx.moveTo(len * 0.7, y); ctx.quadraticCurveTo(len * 1.1, y - h * 0.6, len * 1.35, y - h * 0.9); ctx.quadraticCurveTo(len * 1.15, y - h * 0.2, len * 1.4, y - h * 0.1); ctx.quadraticCurveTo(len * 1.1, y + h * 0.1, len * 0.7, y + h * 0.3); ctx.closePath(); });
  oval(ctx, c, c.main, 0, y, len, h);
  patch(ctx, c.light, -len * 0.15, y + h * 0.45, len * 0.65, h * 0.4);
  ctx.save();
  ctx.translate(-len * 0.5, 0);
  eyes(ctx, 0, y - h * 0.1, h * 0.17, INK);
  ctx.restore();
  smile(ctx, c, y + h * 0.25, h * 0.2);
  if (!sky) for (const [dx, dy] of [[-6, -16], [0, -22], [6, -16]] as const) curve(ctx, 'rgba(160, 220, 255, 0.85)', [-len * 0.2, y - h, -len * 0.2 + dx * 0.5, y - h + dy * 0.6, -len * 0.2 + dx, y - h + dy], 2.4);
};
const skyWhale: Form = (ctx, c) => {
  aura(ctx, '170, 210, 255');
  for (const [x, y, s] of [[-30, 44, 20], [28, 46, 22], [0, 50, 16]] as const) cloud(ctx, x, y, s, '#FFFFFF', '#A9B9D6');
  whale(36, 18, true)(ctx, c);
  for (const [x, y] of [[-36, -26], [30, -32], [10, -40], [-10, -36]] as const) star5(ctx, x, y, 3, '#FFF3C4');
};

const bearSpec = (head: number, body: [number, number]) => ({
  head, body, eyeR: head * 0.15, snout: true,
  ears: (k: PetCtx, c: Pal) => earsRound(k, c, c.main, head * 0.78, headY({ head, body }) - head * 0.62, head * 0.3, mixed(c.hex, '#000000', 0.3)),
});
const starBear: Form = (ctx, c) => {
  aura(ctx, '140, 160, 255');
  mammal(ctx, { ...c, main: lit(ctx, '#2B2F6B'), light: lit(ctx, '#5B63B0'), dark: lit(ctx, '#1A1D45') }, bearSpec(25, [25, 24]));
  const pts: [number, number][] = [[-16, 20], [-6, 30], [6, 26], [14, 36], [4, 42]];
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = 'rgba(255, 243, 196, 0.7)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  for (const [x, y] of pts) star5(ctx, x, y, 2.6, '#FFF3C4');
};

// ---------- Lines ----------

interface Line { names: readonly [string, string, string, string]; forms: readonly [Form, Form, Form, Form] }

/** Every species: its four forms from baby to crown form, each with its own name. */
const LINES: Record<PetData['species'], Line> = {
  fox: { names: ['Fuchswelpe', 'Jungfuchs', 'Rotfuchs', 'Kitsune'], forms: [foxBaby, foxYouth, whole(fox), kitsune] },
  owl: { names: ['Federknäuel', 'Jungeule', 'Uhu', 'Sterneneule'], forms: [owlBaby, owlYouth, whole(owl), starOwl] },
  cat: { names: ['Kätzchen', 'Jungkatze', 'Kater', 'Nekomata'], forms: [catBaby, catYouth, whole(cat), nekomata] },
  axolotl: { names: ['Larve', 'Junges Axolotl', 'Axolotl', 'Wasserdrache'], forms: [axolotlLarva, axolotlYouth, whole(axolotl), waterDragon] },
  dragon: { names: ['Drachenei', 'Drachenküken', 'Drache', 'Urdrache'], forms: [dragonEgg, dragonling, whole(dragon), elderDragon] },
  bunny: { names: ['Häschen', 'Junghase', 'Hase', 'Wolpertinger'], forms: [bunnyBaby, bunnyYouth, whole(bunny), wolpertinger] },
  penguin: { names: ['Pinguin-Ei', 'Flauschküken', 'Pinguin', 'Eiskaiser'], forms: [penguinEgg, fluffChick, whole(penguin), iceEmperor] },
  panda: { names: ['Pandababy', 'Jungpanda', 'Panda', 'Yin-Yang-Panda'], forms: [pandaBaby, pandaYouth, whole(panda), yinYangPanda] },
  frog: { names: ['Kaulquappe', 'Jungfrosch', 'Frosch', 'Donnerkröte'], forms: [tadpole, froglet, whole(frog), thunderToad] },
  butterfly: { names: ['Raupe', 'Kokon', 'Schmetterling', 'Feenfalter'], forms: [caterpillar, cocoon, butterfly, fairyMoth] },
  chicken: { names: ['Ei', 'Küken', 'Huhn', 'Phönix'], forms: [chickEgg, chick, hen, phoenix] },
  dog: { names: ['Welpe', 'Junghund', 'Hund', 'Kerberos'], forms: [puppy, youngDog, dog, kerberos] },
  wolf: { names: ['Wolfswelpe', 'Jungwolf', 'Wolf', 'Mondwolf'], forms: [wolfPup, youngWolf, wolf, moonWolf] },
  horse: { names: ['Fohlen', 'Pony', 'Pferd', 'Pegasus-Einhorn'], forms: [foal, pony, horse, pegacorn] },
  turtle: { names: ['Schildkrötenei', 'Babyschildkröte', 'Schildkröte', 'Inselschildkröte'], forms: [turtleEgg, turtle(20), turtle(28), islandTurtle] },
  koi: { names: ['Fischlaich', 'Jungkarpfen', 'Koi', 'Drachenkoi'], forms: [roe, youngCarp, koi, dragonKoi] },
  snail: { names: ['Schneckenei', 'Jungschnecke', 'Schnecke', 'Kristallschnecke'], forms: [snailEggs, snail(18), snail(25), crystalSnail] },
  hedgehog: { names: ['Igelbaby', 'Jungigel', 'Igel', 'Kristalligel'], forms: [hedgehog(20, 6), hedgehog(25, 8), hedgehog(29, 10), (ctx, c) => { aura(ctx, '190, 150, 255'); hedgehog(29, 10, true)(ctx, c); }] },
  bat: { names: ['Fledermausbaby', 'Jungfledermaus', 'Fledermaus', 'Vampirfürst'], forms: [bat(18, 0, 16), bat(19, 40, 16), bat(21, 54, 18), vampire] },
  squirrel: { names: ['Eichhörnchenbaby', 'Jungeichhorn', 'Eichhörnchen', 'Wolkenhörnchen'], forms: [squirrelBaby, squirrelYouth, squirrel, cloudSquirrel] },
  hamster: { names: ['Hamsterbaby', 'Junghamster', 'Hamster', 'Hamsterritter'], forms: [hamster(20), hamster(23, 0.8), hamsterAdult, hamsterKnight] },
  bee: { names: ['Bienenlarve', 'Puppe', 'Biene', 'Bienenkönigin'], forms: [grub, pupa, bee, queenBee] },
  octopus: { names: ['Krakenei', 'Baby-Krake', 'Oktopus', 'Kraken'], forms: [octoEgg, octopus(4, 4), octopus(8, 8), kraken] },
  jellyfish: { names: ['Polyp', 'Ephyra', 'Qualle', 'Sternenqualle'], forms: [polyp, ephyra, jelly(false), starJelly] },
  seahorse: { names: ['Seepferdchen-Fohlen', 'Jungseepferdchen', 'Seepferdchen', 'Fetzenfisch-Drache'], forms: [seahorse(0.6, false), seahorse(0.8, false), seahorse(1, false), seaDragon] },
  crab: { names: ['Krabbenlarve', 'Jungkrabbe', 'Krabbe', 'Titanenkrabbe'], forms: [zoea, crab(16, 7), crab(24, 9), titanCrab] },
  snake: { names: ['Schlangenei', 'Jungschlange', 'Schlange', 'Federschlange'], forms: [snakeEgg, snake(2, 18, 15), snake(4, 24, 18), featherSerpent] },
  chameleon: { names: ['Chamäleonbaby', 'Jungchamäleon', 'Chamäleon', 'Regenbogen-Chamäleon'], forms: [chameleon(0.6, false), chameleon(0.8, false), chameleon(1, false), rainbowChameleon] },
  sloth: { names: ['Faultierbaby', 'Jungfaultier', 'Faultier', 'Waldhüter'], forms: [sloth(24, [15, 12], false), sloth(22, [20, 18]), sloth(25, [24, 23]), forestKeeper] },
  raccoon: { names: ['Waschbärbaby', 'Jungwaschbär', 'Waschbär', 'Meisterdieb'], forms: [raccoon(24, [15, 12], 0.55), raccoon(22, [20, 18], 0.8), raccoon(24, [23, 22], 1.05), masterThief] },
  sparrow: { names: ['Spatzenküken', 'Jungspatz', 'Spatz', 'Donnervogel'], forms: [sparrow(17), sparrow(21), sparrow(25), thunderbird] },
  parrot: { names: ['Papageienküken', 'Jungpapagei', 'Papagei', 'Regenbogen-Ara'], forms: [parrot(17, 8, false), parrot(21, 14, false), parrot(25, 20, false), rainbowMacaw] },
  mushroom: { names: ['Spore', 'Pilzling', 'Pilz', 'Myzelkönig'], forms: [spore, mushroom(18, 18, false), mushroom(28, 30, false), mycelKing] },
  slime: { names: ['Schleimtropfen', 'Kleiner Schleim', 'Schleim', 'Königsschleim'], forms: [drop, slime(20, false), slime(28, false), (ctx, c) => { aura(ctx, '255, 214, 102'); slime(34, true)(ctx, c); }] },
  ghost: { names: ['Irrlicht', 'Kleines Gespenst', 'Gespenst', 'Laternengeist'], forms: [wisp, ghost(18, false), ghost(25, false), lanternGhost] },
  golem: { names: ['Kiesel', 'Steinchen', 'Golem', 'Kristallgolem'], forms: [pebble, stones, golem(false), crystalGolem] },
  salamander: { names: ['Salamanderei', 'Junger Salamander', 'Feuersalamander', 'Flammenelementar'], forms: [salamanderEgg, salamander(0.75, false), salamander(1, true), flameElemental] },
  whale: { names: ['Walbaby', 'Jungwal', 'Wal', 'Himmelswal'], forms: [whale(22, 12, false), whale(28, 15, false), whale(34, 18, false), skyWhale] },
  bear: { names: ['Bärenjunges', 'Jungbär', 'Braunbär', 'Sternbär'], forms: [(ctx, c) => mammal(ctx, c, bearSpec(24, [16, 13])), (ctx, c) => mammal(ctx, c, bearSpec(22, [20, 18])), (ctx, c) => mammal(ctx, c, bearSpec(25, [25, 24])), starBear] },
};

/** The name of each form per species (baby, youth, adult, crown form). */
export const PET_FORM_NAMES = Object.fromEntries(Object.entries(LINES).map(([species, line]) => [species, line.names])) as Record<PetData['species'], Line['names']>;

const hex2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
/** Like `mixed`, as #rrggbb (the light helpers mix it further). */
function mixHex(a: string, b: string, t: number): string {
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x.map((v, i) => hex2(v + (y[i] - v) * t)).join('')}`;
}

/**
 * Draws the companion standing on (x, y + size), `size` = half its height, in its form (1–4) of its species' line.
 * Sad (a missed day), it droops its lids, cries a tear and turns a little grey.
 */
export function drawPet(ctx: PetCtx, pet: PetData, x: number, y: number, size: number, stage = 1, isHungry = false) {
  const form = Math.min(4, Math.max(1, Math.round(stage)));
  const hex = isHungry ? mixHex(pet.color, '#7C7F88', 0.35) : pet.color;
  const k = size / 50;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
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
  const c: Pal = {
    main: lit(ctx, hex),
    light: lit(ctx, pet.species === 'dragon' ? '#FFE7A3' : mixHex(hex, '#FFFFFF', 0.55)),
    dark: lit(ctx, mixHex(hex, '#000000', 0.28)),
    line: mixed(hex, '#000000', 0.62),
    hex,
  };
  (LINES[pet.species] ?? LINES.fox).forms[form - 1](ctx, c);
  hungry = false;
  ctx.restore();
}

// ---------- Food ----------

/** The food icon: a red bowl heaped with kibble and a paw print, `size` wide, centred on (x, y). Dashboard and emoji. */
export function drawFoodBowl(ctx: PetCtx, x: number, y: number, size: number) {
  const k = size / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  const line = '#4A1A12';
  // Kibble heaped over the rim, light from the upper left like the pets.
  for (const [px, py, r] of [[-26, -6, 11], [-8, -14, 12], [12, -12, 12], [28, -4, 10], [-14, 2, 10], [6, 0, 11], [20, 6, 9]] as const) {
    shape(ctx, lit(ctx, '#B5703A'), '#5A3418', () => ellipse(ctx, px, py, r, r * 0.82));
    patch0(ctx, 'rgba(255, 230, 190, 0.55)', px - r * 0.35, py - r * 0.35, r * 0.3, r * 0.22);
  }
  shape(ctx, lit(ctx, '#E5484D'), line, () => {
    ctx.moveTo(-46, 4);
    ctx.lineTo(46, 4);
    ctx.bezierCurveTo(44, 30, 30, 40, 0, 40);
    ctx.bezierCurveTo(-30, 40, -44, 30, -46, 4);
    ctx.closePath();
  });
  shape(ctx, '#F87171', line, () => ellipse(ctx, 0, 4, 46, 6));
  // Paw print on the bowl.
  shape(ctx, '#FFF1EC', null, () => ellipse(ctx, 0, 26, 7, 6));
  for (const [px, py] of [[-9, 16], [-3, 13], [3, 13], [9, 16]] as const) shape(ctx, '#FFF1EC', null, () => ellipse(ctx, px, py, 2.6, 3));
  ctx.restore();
}
function patch0(ctx: PetCtx, fill: string, x: number, y: number, rx: number, ry: number) {
  shape(ctx, fill, null, () => ellipse(ctx, x, y, rx, ry));
}
