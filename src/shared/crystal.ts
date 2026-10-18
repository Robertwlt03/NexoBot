// The Kristalle currency icon: a faceted, elongated crystal in Nexo lavender, lit from the top left.
// One geometry for every surface: the dashboard draws it as SVG, the profile and level-up cards on canvas.
// Import-free (shared by the bot and the dashboard).

/** Geometry is defined in a 24×24 box. */
export const CRYSTAL_BOX = 24;

type Point = readonly [number, number];
export interface CrystalFacet { points: readonly Point[]; fill: string; opacity?: number }

const T: Point = [12, 1];      // top tip
const L: Point = [5, 8.5];     // left shoulder
const R: Point = [19, 8.5];    // right shoulder
const C: Point = [12, 10.5];   // front ridge, top
const LB: Point = [6.5, 16.5]; // left hip
const RB: Point = [17.5, 16.5];// right hip
const CB: Point = [12, 18.5];  // front ridge, bottom
const B: Point = [12, 23];     // bottom tip

/** Back to front; lighter facets face the light. */
export const CRYSTAL_FACETS: readonly CrystalFacet[] = [
  { points: [T, L, C], fill: '#ddd6ff' },
  { points: [T, C, R], fill: '#bcb0ff' },
  { points: [L, LB, CB, C], fill: '#a99bff' },
  { points: [C, CB, RB, R], fill: '#7f6ef0' },
  { points: [LB, B, CB], fill: '#6a5ae0' },
  { points: [CB, B, RB], fill: '#4f41c2' },
  // Glint on the lit body facet.
  { points: [[7.6, 10.6], [8.9, 11.1], [8.9, 15.2], [7.6, 14.7]], fill: '#ffffff', opacity: 0.5 },
];

/** Outline that keeps the silhouette readable on dark and light backgrounds. */
export const CRYSTAL_OUTLINE: readonly Point[] = [T, R, RB, B, LB, L];
export const CRYSTAL_OUTLINE_COLOR = 'rgba(255,255,255,0.22)';

/** Minimal 2D context (browser canvas and @napi-rs/canvas both fit). */
export interface CrystalContext {
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  lineJoin: string;
  globalAlpha: number;
  save(): void;
  restore(): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
}

function tracePath(ctx: CrystalContext, points: readonly Point[], ox: number, oy: number, scale: number) {
  ctx.beginPath();
  points.forEach(([px, py], index) => {
    const x = ox + px * scale;
    const y = oy + py * scale;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

/** Draws the crystal centred on (cx, cy), `size` px tall. */
export function drawCrystal(ctx: CrystalContext, cx: number, cy: number, size: number) {
  const scale = size / CRYSTAL_BOX;
  const ox = cx - size / 2;
  const oy = cy - size / 2;
  ctx.save();
  for (const facet of CRYSTAL_FACETS) {
    tracePath(ctx, facet.points, ox, oy, scale);
    ctx.globalAlpha = facet.opacity ?? 1;
    ctx.fillStyle = facet.fill;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  tracePath(ctx, CRYSTAL_OUTLINE, ox, oy, scale);
  ctx.strokeStyle = CRYSTAL_OUTLINE_COLOR;
  ctx.lineWidth = Math.max(0.75, scale * 0.6);
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}
