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
