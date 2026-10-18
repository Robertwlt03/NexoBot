// The Kristalle currency icon in the Nexo look: a faceted crystal in the brand gradient (lavender → cyan), wrapped
// by the tilted orbit ring of the Nexo logo (back half behind the crystal, front half in front, with its little moon)
// and — at larger sizes — the robot's dark visor with two glowing eyes on its face.
// One geometry for every surface: the dashboard draws it as SVG, the profile and level-up cards on canvas.
// Import-free (shared by the bot and the dashboard).

/** Geometry is defined in a 24×24 box. */
export const CRYSTAL_BOX = 24;

export type Point = readonly [number, number];
export interface CrystalFacet { points: readonly Point[]; fill: string; opacity?: number }

const T: Point = [12, 1.5];    // top tip
const L: Point = [5.5, 8.5];   // left shoulder
const R: Point = [18.5, 8.5];  // right shoulder
const C: Point = [12, 10.2];   // front ridge, top
const LB: Point = [7, 16.6];   // left hip
const RB: Point = [17, 16.6];  // right hip
const CB: Point = [12, 18.4];  // front ridge, bottom
const B: Point = [12, 22.5];   // bottom tip

/** Back to front; lit from the top left, the brand gradient runs from lavender (top) to cyan (bottom right). */
export const CRYSTAL_FACETS: readonly CrystalFacet[] = [
  { points: [T, L, C], fill: '#e6e0ff' },
  { points: [T, C, R], fill: '#c7bbff' },
  { points: [L, LB, CB, C], fill: '#a99bff' },
  { points: [C, CB, RB, R], fill: '#7c5cff' },
  { points: [LB, B, CB], fill: '#6d78f2' },
  { points: [CB, B, RB], fill: '#3aa6dc' },
  // Glint on the lit body facet.
  { points: [[7.9, 10.4], [9, 10.8], [9, 11.9], [7.9, 11.5]], fill: '#ffffff', opacity: 0.55 },
];

/** Outline that keeps the silhouette readable on dark and light backgrounds. */
export const CRYSTAL_OUTLINE: readonly Point[] = [T, R, RB, B, LB, L];
export const CRYSTAL_OUTLINE_COLOR = 'rgba(255,255,255,0.25)';

// ---------- Nexo details ----------

/** Orbit ring (as in the logo): centre, radii and tilt. */
const RING = { cx: 12, cy: 14.2, rx: 11, ry: 3.1, tilt: (-12 * Math.PI) / 180 };
/** Ring stroke runs from lavender (left) to cyan (right), like the logo's orbit. */
export const RING_COLORS = ['#c9bdff', '#67e8f9'] as const;
export const RING_WIDTH = 1.15;

function ringPoint(angle: number): Point {
  const x = RING.rx * Math.cos(angle);
  const y = RING.ry * Math.sin(angle);
  return [RING.cx + x * Math.cos(RING.tilt) - y * Math.sin(RING.tilt), RING.cy + x * Math.sin(RING.tilt) + y * Math.cos(RING.tilt)];
}

/** The ring half behind the crystal (upper arc) or in front of it (lower arc), as a polyline. */
export function ringHalf(half: 'back' | 'front', samples = 24): Point[] {
  const start = half === 'back' ? Math.PI : 0;
  return Array.from({ length: samples + 1 }, (_, i) => ringPoint(start + (Math.PI * i) / samples));
}

/** The little moon riding on the front of the ring. */
export const MOON = { at: ringPoint(0.32 * Math.PI), r: 1.05, fill: '#ffffff' } as const;

/** The robot's visor (capsule) with two eyes, on the crystal's face. */
export const VISOR = { x: 7.9, y: 11.5, w: 8.2, h: 3.2, fill: '#1a1440' } as const;
export const EYES = { points: [[10.3, 13.1], [13.7, 13.1]] as const, r: 0.85, fill: '#67e8f9' } as const;

/** Which details fit at a given pixel size: tiny = plain crystal, small = + ring, full = + moon, visor and eyes. */
export type CrystalDetail = 'tiny' | 'small' | 'full';
export function crystalDetail(size: number): CrystalDetail {
  if (size < 14) return 'tiny';
  if (size < 26) return 'small';
  return 'full';
}

// ---------- Canvas ----------

interface CanvasGradientLike { addColorStop(offset: number, color: string): void }
/** Minimal 2D context (browser canvas and @napi-rs/canvas both fit). */
export interface CrystalContext {
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  lineJoin: string;
  lineCap: string;
  globalAlpha: number;
  save(): void;
  restore(): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradientLike;
}

function trace(ctx: CrystalContext, points: readonly Point[], ox: number, oy: number, k: number, close: boolean) {
  ctx.beginPath();
  points.forEach(([px, py], index) => {
    if (index === 0) ctx.moveTo(ox + px * k, oy + py * k);
    else ctx.lineTo(ox + px * k, oy + py * k);
  });
  if (close) ctx.closePath();
}

function strokeRing(ctx: CrystalContext, half: 'back' | 'front', ox: number, oy: number, k: number) {
  const gradient = ctx.createLinearGradient(ox + 1 * k, 0, ox + 23 * k, 0);
  gradient.addColorStop(0, RING_COLORS[0]);
  gradient.addColorStop(1, RING_COLORS[1]);
  trace(ctx, ringHalf(half), ox, oy, k, false);
  ctx.strokeStyle = gradient;
  ctx.lineWidth = RING_WIDTH * k;
  ctx.lineCap = 'round';
  ctx.globalAlpha = half === 'back' ? 0.55 : 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Draws the crystal centred on (cx, cy), `size` px tall; detail follows the size. */
export function drawCrystal(ctx: CrystalContext, cx: number, cy: number, size: number) {
  const k = size / CRYSTAL_BOX;
  const ox = cx - size / 2;
  const oy = cy - size / 2;
  const detail = crystalDetail(size);
  ctx.save();
  ctx.lineJoin = 'round';
  if (detail !== 'tiny') strokeRing(ctx, 'back', ox, oy, k);
  for (const facet of CRYSTAL_FACETS) {
    if (detail === 'tiny' && facet.opacity !== undefined) continue;
    trace(ctx, facet.points, ox, oy, k, true);
    ctx.globalAlpha = facet.opacity ?? 1;
    ctx.fillStyle = facet.fill;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  trace(ctx, CRYSTAL_OUTLINE, ox, oy, k, true);
  ctx.strokeStyle = CRYSTAL_OUTLINE_COLOR;
  ctx.lineWidth = Math.max(0.75, k * 0.6);
  ctx.stroke();
  if (detail === 'full') {
    const { x, y, w, h } = VISOR;
    const r = h / 2;
    ctx.beginPath();
    ctx.arc(ox + (x + r) * k, oy + (y + r) * k, r * k, Math.PI / 2, (Math.PI * 3) / 2);
    ctx.arc(ox + (x + w - r) * k, oy + (y + r) * k, r * k, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = VISOR.fill;
    ctx.fill();
    for (const [ex, ey] of EYES.points) {
      ctx.beginPath();
      ctx.arc(ox + ex * k, oy + ey * k, EYES.r * k, 0, Math.PI * 2);
      ctx.fillStyle = EYES.fill;
      ctx.fill();
    }
  }
  if (detail !== 'tiny') strokeRing(ctx, 'front', ox, oy, k);
  if (detail === 'full') {
    ctx.beginPath();
    ctx.arc(ox + MOON.at[0] * k, oy + MOON.at[1] * k, MOON.r * k, 0, Math.PI * 2);
    ctx.fillStyle = MOON.fill;
    ctx.fill();
  }
  ctx.restore();
}
