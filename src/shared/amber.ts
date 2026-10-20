// The Bernis currency icon: a drop of amber (fossil tree resin) with a leaf caught inside and a glint of light.
// One geometry for every surface: the dashboard draws it as SVG, the profile and level-up cards on canvas.
// Import-free (shared by the bot and the dashboard).

/** Geometry is defined in a 24×24 box. */
export const AMBER_BOX = 24;

export type PathCmd =
  | readonly ['M', number, number]
  | readonly ['L', number, number]
  | readonly ['C', number, number, number, number, number, number]
  | readonly ['Z'];
export type AmberPath = readonly PathCmd[];

/** Resin drop: pointed top, round belly. */
export const AMBER_DROP: AmberPath = [
  ['M', 12, 2.2],
  ['C', 12, 2.2, 19.6, 9.9, 19.6, 14.6],
  ['C', 19.6, 18.9, 16.2, 22, 12, 22],
  ['C', 7.8, 22, 4.4, 18.9, 4.4, 14.6],
  ['C', 4.4, 9.9, 12, 2.2, 12, 2.2],
  ['Z'],
];
/** The leaf caught in the resin, and its middle vein. */
export const AMBER_LEAF: AmberPath = [
  ['M', 8.6, 18.4],
  ['C', 9.1, 14.7, 12, 12.4, 15.6, 12.5],
  ['C', 15.3, 16, 12.5, 18.3, 8.6, 18.4],
  ['Z'],
];
export const AMBER_VEIN: AmberPath = [['M', 9.2, 17.9], ['C', 11, 16.3, 12.9, 14.6, 14.9, 13.1]];
/** Light on the upper left of the drop. */
export const AMBER_GLINT: AmberPath = [
  ['M', 7.6, 13.6],
  ['C', 7.7, 11.2, 9.4, 8.7, 11.1, 6.6],
  ['C', 10.5, 9.1, 9.3, 11.4, 7.6, 13.6],
  ['Z'],
];
/** A tiny air bubble. */
export const AMBER_BUBBLE = { x: 15.4, y: 18, r: 0.6 } as const;

/** Resin colours: lit centre → deep edge; leaf and outline in burnt brown. */
export const AMBER_COLORS = {
  light: '#ffd889',
  mid: '#f2a531',
  deep: '#b5600f',
  leaf: '#6b3510',
  vein: '#ffd27a',
  outline: '#7a3a0c',
} as const;
/** Radial light of the resin, in box units: centre, radius. */
export const AMBER_LIGHT = { x: 10.2, y: 13.2, r: 11.5 } as const;

/** SVG path data of one of the shapes above. */
export function amberSvgPath(path: AmberPath): string {
  return path.map((cmd) => cmd.join(' ')).join(' ');
}

/**
 * Detail by rendered size: tiny (< 12 px) = drop + leaf, small (< 24 px) = + glint, full = + vein and bubble.
 */
export type AmberDetail = 'tiny' | 'small' | 'full';
export function amberDetail(size: number): AmberDetail {
  if (size < 12) return 'tiny';
  if (size < 24) return 'small';
  return 'full';
}

// ---------- Canvas ----------

interface CanvasGradientLike { addColorStop(offset: number, color: string): void }
/** Minimal 2D context (browser canvas and @napi-rs/canvas both fit). */
export interface AmberContext {
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
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): CanvasGradientLike;
}

function trace(ctx: AmberContext, path: AmberPath, ox: number, oy: number, k: number) {
  ctx.beginPath();
  for (const cmd of path) {
    if (cmd[0] === 'M') ctx.moveTo(ox + cmd[1] * k, oy + cmd[2] * k);
    else if (cmd[0] === 'L') ctx.lineTo(ox + cmd[1] * k, oy + cmd[2] * k);
    else if (cmd[0] === 'C') ctx.bezierCurveTo(ox + cmd[1] * k, oy + cmd[2] * k, ox + cmd[3] * k, oy + cmd[4] * k, ox + cmd[5] * k, oy + cmd[6] * k);
    else ctx.closePath();
  }
}

/** Draws the amber drop centred on (cx, cy), `size` px tall; detail follows the size unless given. */
export function drawAmber(ctx: AmberContext, cx: number, cy: number, size: number, detail: AmberDetail = amberDetail(size)) {
  const k = size / AMBER_BOX;
  const ox = cx - size / 2;
  const oy = cy - size / 2;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const light = ctx.createRadialGradient(ox + AMBER_LIGHT.x * k, oy + AMBER_LIGHT.y * k, 0, ox + AMBER_LIGHT.x * k, oy + AMBER_LIGHT.y * k, AMBER_LIGHT.r * k);
  light.addColorStop(0, AMBER_COLORS.light);
  light.addColorStop(0.5, AMBER_COLORS.mid);
  light.addColorStop(1, AMBER_COLORS.deep);
  trace(ctx, AMBER_DROP, ox, oy, k);
  ctx.fillStyle = light;
  ctx.fill();

  trace(ctx, AMBER_LEAF, ox, oy, k);
  ctx.fillStyle = AMBER_COLORS.leaf;
  ctx.globalAlpha = 0.6;
  ctx.fill();
  ctx.globalAlpha = 1;

  if (detail === 'full') {
    trace(ctx, AMBER_VEIN, ox, oy, k);
    ctx.strokeStyle = AMBER_COLORS.vein;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = Math.max(0.5, 0.4 * k);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ox + AMBER_BUBBLE.x * k, oy + AMBER_BUBBLE.y * k, AMBER_BUBBLE.r * k, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (detail !== 'tiny') {
    trace(ctx, AMBER_GLINT, ox, oy, k);
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  trace(ctx, AMBER_DROP, ox, oy, k);
  ctx.strokeStyle = AMBER_COLORS.outline;
  ctx.lineWidth = Math.max(0.75, 0.6 * k);
  ctx.stroke();
  ctx.restore();
}
