// The Kristalle currency icon in the Nexo look: a faceted crystal in the brand gradient (lavender → cyan) with the
// robot's face built into its facets — a visor that bends over the front ridge (lit left half, shaded right half)
// and two eyes that glow from inside — wrapped by the tilted orbit ring of the Nexo logo with its little moon.
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
];
/** Glint on the lit top facet (only when there is room for it). */
export const CRYSTAL_GLINT: CrystalFacet = { points: [[8.3, 6.6], [10.7, 3.8], [11.15, 4.25], [8.85, 7]], fill: '#ffffff', opacity: 0.6 };

/** Outline that keeps the silhouette readable on dark and light backgrounds. */
export const CRYSTAL_OUTLINE: readonly Point[] = [T, R, RB, B, LB, L];
export const CRYSTAL_OUTLINE_COLOR = 'rgba(255,255,255,0.25)';

// ---------- Face (part of the facets) ----------

/**
 * The visor bends over the front ridge like the facets do: each half lies on its body facet (inset from the
 * silhouette), the lit left half lighter than the shaded right half, both dipping slightly at the ridge.
 */
export const VISOR_HALVES: readonly CrystalFacet[] = [
  { points: [[6.95, 11.55], [12, 12.05], [12, 15.45], [7.55, 14.95]], fill: '#2b2268' },
  { points: [[12, 12.05], [17.05, 11.55], [16.45, 14.95], [12, 15.45]], fill: '#161140' },
];
/** Thin light catching the visor's upper edge (stronger on the lit side). */
export const VISOR_RIM: readonly { from: Point; to: Point; color: string; opacity: number }[] = [
  { from: [7.15, 11.6], to: [12, 12.08], color: '#cfc6ff', opacity: 0.75 },
  { from: [12, 12.08], to: [16.85, 11.6], color: '#a99bff', opacity: 0.35 },
];
/** Eyes sit in the middle of each visor half; the one on the shaded side is a touch dimmer. */
export const EYES: readonly { at: Point; r: number; core: string; glowOpacity: number }[] = [
  { at: [9.55, 13.45], r: 1.05, core: '#8ff3ff', glowOpacity: 0.65 },
  { at: [14.45, 13.45], r: 1.0, core: '#67e8f9', glowOpacity: 0.5 },
];
export const EYE_GLOW = '#22d3ee';

// ---------- Orbit ring (as in the logo) ----------

const RING = { cx: 12, cy: 14.6, rx: 11, ry: 3.1, tilt: (-12 * Math.PI) / 180 };
/** Ring stroke runs from lavender (left) to cyan (right), like the logo's orbit. */
export const RING_COLORS = ['#c9bdff', '#67e8f9'] as const;
export const RING_WIDTH = 1.1;
/** Small icons draw the ring bolder so it survives at text size. */
export const RING_WIDTH_SMALL = 1.7;

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
export const MOON = { at: ringPoint(0.3 * Math.PI), r: 1.05, fill: '#ffffff' } as const;

/**
 * Detail by pixel size: tiny = crystal only; small = crystal with face (visor, eyes) and orbit ring, as in text;
 * full = + glint, rim light, eye glow and the moon.
 */
export type CrystalDetail = 'tiny' | 'small' | 'full';
export function crystalDetail(size: number): CrystalDetail {
  if (size < 12) return 'tiny';
  if (size < 24) return 'small';
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
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): CanvasGradientLike;
}

/** Hex colour with alpha for gradient stops. */
function alpha(hex: string, a: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function trace(ctx: CrystalContext, points: readonly Point[], ox: number, oy: number, k: number, close: boolean) {
  ctx.beginPath();
  points.forEach(([px, py], index) => {
    if (index === 0) ctx.moveTo(ox + px * k, oy + py * k);
    else ctx.lineTo(ox + px * k, oy + py * k);
  });
  if (close) ctx.closePath();
}

function fillFacet(ctx: CrystalContext, facet: CrystalFacet, ox: number, oy: number, k: number) {
  trace(ctx, facet.points, ox, oy, k, true);
  ctx.globalAlpha = facet.opacity ?? 1;
  ctx.fillStyle = facet.fill;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function strokeRing(ctx: CrystalContext, half: 'back' | 'front', ox: number, oy: number, k: number, width: number) {
  const gradient = ctx.createLinearGradient(ox + 1 * k, 0, ox + 23 * k, 0);
  gradient.addColorStop(0, RING_COLORS[0]);
  gradient.addColorStop(1, RING_COLORS[1]);
  trace(ctx, ringHalf(half), ox, oy, k, false);
  ctx.strokeStyle = gradient;
  ctx.lineWidth = width * k;
  ctx.lineCap = 'round';
  ctx.globalAlpha = half === 'back' ? 0.55 : 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function circle(ctx: CrystalContext, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

/** Draws the crystal centred on (cx, cy), `size` px tall; detail follows the size unless given. */
export function drawCrystal(ctx: CrystalContext, cx: number, cy: number, size: number, detail: CrystalDetail = crystalDetail(size)) {
  const k = size / CRYSTAL_BOX;
  const ox = cx - size / 2;
  const oy = cy - size / 2;
  const full = detail === 'full';
  ctx.save();
  ctx.lineJoin = 'round';
  const ringWidth = full ? RING_WIDTH : RING_WIDTH_SMALL;
  if (detail !== 'tiny') strokeRing(ctx, 'back', ox, oy, k, ringWidth);
  for (const facet of CRYSTAL_FACETS) fillFacet(ctx, facet, ox, oy, k);
  if (full) fillFacet(ctx, CRYSTAL_GLINT, ox, oy, k);
  trace(ctx, CRYSTAL_OUTLINE, ox, oy, k, true);
  ctx.strokeStyle = CRYSTAL_OUTLINE_COLOR;
  ctx.lineWidth = Math.max(0.75, k * 0.6);
  ctx.stroke();

  if (detail !== 'tiny') {
    for (const half of VISOR_HALVES) fillFacet(ctx, half, ox, oy, k);
    if (full) {
      for (const rim of VISOR_RIM) {
        ctx.beginPath();
        ctx.moveTo(ox + rim.from[0] * k, oy + rim.from[1] * k);
        ctx.lineTo(ox + rim.to[0] * k, oy + rim.to[1] * k);
        ctx.strokeStyle = rim.color;
        ctx.globalAlpha = rim.opacity;
        ctx.lineWidth = Math.max(0.6, 0.35 * k);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    for (const eye of EYES) {
      const ex = ox + eye.at[0] * k;
      const ey = oy + eye.at[1] * k;
      if (full) {
        const glow = ctx.createRadialGradient(ex, ey, 0, ex, ey, eye.r * 2.6 * k);
        glow.addColorStop(0, alpha(EYE_GLOW, eye.glowOpacity));
        glow.addColorStop(1, alpha(EYE_GLOW, 0));
        circle(ctx, ex, ey, eye.r * 2.6 * k);
        ctx.fillStyle = glow;
        ctx.fill();
      }
      // Small sizes: a slightly bigger core so the eyes still read as two lights.
      circle(ctx, ex, ey, eye.r * (full ? 1 : 1.25) * k);
      ctx.fillStyle = eye.core;
      ctx.fill();
      if (full) {
        circle(ctx, ex - eye.r * 0.35 * k, ey - eye.r * 0.35 * k, eye.r * 0.38 * k);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  if (detail !== 'tiny') strokeRing(ctx, 'front', ox, oy, k, ringWidth);
  if (full) {
    circle(ctx, ox + MOON.at[0] * k, oy + MOON.at[1] * k, MOON.r * k);
    ctx.fillStyle = MOON.fill;
    ctx.fill();
  }
  ctx.restore();
}
