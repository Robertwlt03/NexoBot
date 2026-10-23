// The amber drop (fossil tree resin with a leaf caught inside) that is engraved on every Bernis coin
// (shared/coins.ts). Import-free (shared by the bot and the dashboard).

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
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradientLike;
}
