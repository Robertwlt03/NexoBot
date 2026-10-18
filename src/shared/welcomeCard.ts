// Welcome image card ("Willkommenskarte"): model, limits, templates, validation and ONE renderer.
// Shared by the dashboard (browser canvas) and the bot (@napi-rs/canvas), so keep this file import-free.

export const CARD_WIDTH = 1024;
export const CARD_HEIGHT = 450;
export const CARD_MAX_LAYERS = 25;
export const CARD_MAX_TEXT = 200;
export const CARD_MAX_URL = 2000;

/** Bundled fonts (assets/fonts/<key>-<weight>.woff2, SIL OFL). Registered under `family` in browser and bot. */
export const CARD_FONTS = {
  inter: { label: 'Inter', family: 'NexoCard Inter' },
  unbounded: { label: 'Unbounded', family: 'NexoCard Unbounded' },
  caveat: { label: 'Caveat (Handschrift)', family: 'NexoCard Caveat' },
} as const;
export type CardFont = keyof typeof CARD_FONTS;
export const CARD_FONT_KEYS = Object.keys(CARD_FONTS) as CardFont[];
export const CARD_FONT_WEIGHTS = [400, 700] as const;
export type CardFontWeight = (typeof CARD_FONT_WEIGHTS)[number];

export const CARD_PLACEHOLDERS = ['{user.name}', '{username}', '{server}', '{memberCount}'];

export interface CardBackground {
  type: 'color' | 'gradient' | 'image';
  color: string;
  color2: string;
  /** Gradient direction in degrees, 0 = left → right, 90 = top → bottom. */
  angle: number;
  imageUrl: string | null;
  /** Darkens the background, 0–80 %. */
  dim: number;
}

/** x/y = top-left corner, size = edge length. */
export interface AvatarLayer { id: string; type: 'avatar'; x: number; y: number; size: number; shape: 'circle' | 'rounded' | 'square'; borderWidth: number; borderColor: string }
/** x = anchor for `align`, y = baseline of the first line. maxWidth > 0 shrinks the text until it fits. */
export interface TextLayer {
  id: string; type: 'text'; x: number; y: number; text: string; font: CardFont; size: number; weight: CardFontWeight;
  color: string; align: 'left' | 'center' | 'right'; maxWidth: number; shadow: boolean;
}
/** Opacity values are percent (0–100). */
export interface RectLayer { id: string; type: 'rect'; x: number; y: number; w: number; h: number; radius: number; color: string; opacity: number }
/** x/y = centre. */
export interface CircleLayer { id: string; type: 'circle'; x: number; y: number; r: number; color: string; opacity: number }
export interface LineLayer { id: string; type: 'line'; x1: number; y1: number; x2: number; y2: number; width: number; color: string; opacity: number }
export interface ImageLayer { id: string; type: 'image'; x: number; y: number; w: number; h: number; url: string; radius: number; opacity: number }

export type CardLayer = AvatarLayer | TextLayer | RectLayer | CircleLayer | LineLayer | ImageLayer;
export type CardLayerType = CardLayer['type'];

export interface WelcomeCard {
  enabled: boolean;
  width: typeof CARD_WIDTH;
  height: typeof CARD_HEIGHT;
  background: CardBackground;
  layers: CardLayer[];
}

export const CARD_LAYER_LABELS: Record<CardLayerType, string> = {
  avatar: 'Avatar', text: 'Text', rect: 'Rechteck', circle: 'Kreis', line: 'Linie', image: 'Bild',
};

// ---------- Templates ----------

export interface CardTemplate { id: string; label: string; background: CardBackground; layers: CardLayer[] }

export const CARD_TEMPLATES: CardTemplate[] = [
  {
    id: 'nexo',
    label: 'Nexo',
    background: { type: 'gradient', color: '#1A1033', color2: '#5B3CC4', angle: 20, imageUrl: null, dim: 0 },
    layers: [
      { id: 'deco1', type: 'circle', x: 930, y: 60, r: 150, color: '#FFFFFF', opacity: 8 },
      { id: 'deco2', type: 'circle', x: 990, y: 430, r: 90, color: '#FFFFFF', opacity: 6 },
      { id: 'avatar', type: 'avatar', x: 70, y: 105, size: 240, shape: 'circle', borderWidth: 8, borderColor: '#FFFFFF' },
      { id: 'title', type: 'text', x: 360, y: 175, text: 'WILLKOMMEN', font: 'unbounded', size: 50, weight: 700, color: '#FFFFFF', align: 'left', maxWidth: 620, shadow: true },
      { id: 'name', type: 'text', x: 360, y: 260, text: '{user.name}', font: 'inter', size: 64, weight: 700, color: '#FFFFFF', align: 'left', maxWidth: 620, shadow: true },
      { id: 'sub', type: 'text', x: 360, y: 318, text: 'Mitglied #{memberCount} auf {server}', font: 'inter', size: 28, weight: 400, color: '#D8CCFF', align: 'left', maxWidth: 620, shadow: false },
    ],
  },
  {
    id: 'minimal',
    label: 'Minimal',
    background: { type: 'color', color: '#F5F5F7', color2: '#FFFFFF', angle: 0, imageUrl: null, dim: 0 },
    layers: [
      { id: 'avatar', type: 'avatar', x: 432, y: 50, size: 160, shape: 'circle', borderWidth: 0, borderColor: '#FFFFFF' },
      { id: 'name', type: 'text', x: 512, y: 290, text: '{user.name}', font: 'inter', size: 56, weight: 700, color: '#111111', align: 'center', maxWidth: 900, shadow: false },
      { id: 'sub', type: 'text', x: 512, y: 340, text: 'ist {server} beigetreten', font: 'inter', size: 28, weight: 400, color: '#555555', align: 'center', maxWidth: 900, shadow: false },
      { id: 'line', type: 'line', x1: 452, y1: 385, x2: 572, y2: 385, width: 4, color: '#7C5CFF', opacity: 100 },
    ],
  },
  {
    id: 'neon',
    label: 'Neon',
    background: { type: 'gradient', color: '#07071A', color2: '#2A0845', angle: 90, imageUrl: null, dim: 0 },
    layers: [
      { id: 'glow', type: 'circle', x: 512, y: 140, r: 125, color: '#00F0FF', opacity: 22 },
      { id: 'avatar', type: 'avatar', x: 412, y: 40, size: 200, shape: 'circle', borderWidth: 6, borderColor: '#00F0FF' },
      { id: 'title', type: 'text', x: 512, y: 312, text: 'WILLKOMMEN', font: 'unbounded', size: 44, weight: 700, color: '#FF2BD6', align: 'center', maxWidth: 900, shadow: true },
      { id: 'name', type: 'text', x: 512, y: 385, text: '{user.name}', font: 'caveat', size: 72, weight: 700, color: '#00F0FF', align: 'center', maxWidth: 900, shadow: true },
      { id: 'line', type: 'line', x1: 352, y1: 418, x2: 672, y2: 418, width: 3, color: '#FF2BD6', opacity: 100 },
    ],
  },
];

/** A fresh default card (disabled, "Nexo" template). */
export function defaultCard(): WelcomeCard {
  const template = CARD_TEMPLATES[0];
  return structuredClone({ enabled: false, width: CARD_WIDTH, height: CARD_HEIGHT, background: template.background, layers: template.layers });
}

// ---------- Placeholders ----------

export interface CardVars { userName: string; username: string; server: string; memberCount: string }

export function fillPlaceholders(text: string, vars: CardVars): string {
  return text
    .split('{user.name}').join(vars.userName)
    .split('{username}').join(vars.username)
    .split('{server}').join(vars.server)
    .split('{memberCount}').join(vars.memberCount);
}

// ---------- Validation ----------

/** Thrown with a German message the dashboard shows as is. */
export class CardValidationError extends Error {}

const fail = (message: string): never => { throw new CardValidationError(message); };

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${field}: ungültige Daten.`);
  return value as Record<string, unknown>;
}

function num(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(`${field}: Zahl zwischen ${min} und ${max} erwartet.`);
  return Math.round(value as number);
}

function hex(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) fail(`${field}: Farbe im Format #RRGGBB erwartet.`);
  return (value as string).toUpperCase();
}

function oneOf<T extends string | number>(value: unknown, field: string, options: readonly T[]): T {
  if (!options.includes(value as T)) fail(`${field}: ungültiger Wert.`);
  return value as T;
}

function flag(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') fail(`${field}: Ja/Nein erwartet.`);
  return value as boolean;
}

function httpUrl(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > CARD_MAX_URL) fail(`${field}: gültige http(s)-Adresse erwartet.`);
  const text = (value as string).trim();
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('protocol');
  } catch {
    fail(`${field}: gültige http(s)-Adresse erwartet.`);
  }
  return text;
}

const X = (value: unknown, field: string) => num(value, field, -CARD_WIDTH, CARD_WIDTH * 2);
const Y = (value: unknown, field: string) => num(value, field, -CARD_HEIGHT, CARD_HEIGHT * 2);
const opacity = (value: unknown, field: string) => num(value, field, 0, 100);

function parseLayer(raw: unknown, field: string): CardLayer {
  const input = record(raw, field);
  const id = typeof input.id === 'string' && /^[\w-]{1,32}$/.test(input.id) ? input.id : fail(`${field}: ungültige ID.`);
  const type = oneOf(input.type, `${field}: Typ`, Object.keys(CARD_LAYER_LABELS) as CardLayerType[]);
  const f = `${field} (${CARD_LAYER_LABELS[type]})`;
  switch (type) {
    case 'avatar':
      return {
        id, type, x: X(input.x, `${f}: X`), y: Y(input.y, `${f}: Y`), size: num(input.size, `${f}: Größe`, 16, 1024),
        shape: oneOf(input.shape, `${f}: Form`, ['circle', 'rounded', 'square'] as const),
        borderWidth: num(input.borderWidth, `${f}: Rahmenbreite`, 0, 40), borderColor: hex(input.borderColor, `${f}: Rahmenfarbe`),
      };
    case 'text': {
      if (typeof input.text !== 'string' || input.text.length > CARD_MAX_TEXT) fail(`${f}: Text mit höchstens ${CARD_MAX_TEXT} Zeichen erwartet.`);
      return {
        id, type, x: X(input.x, `${f}: X`), y: Y(input.y, `${f}: Y`), text: input.text as string,
        font: oneOf(input.font, `${f}: Schrift`, CARD_FONT_KEYS), size: num(input.size, `${f}: Schriftgröße`, 8, 200),
        weight: oneOf(input.weight, `${f}: Stärke`, CARD_FONT_WEIGHTS), color: hex(input.color, `${f}: Farbe`),
        align: oneOf(input.align, `${f}: Ausrichtung`, ['left', 'center', 'right'] as const),
        maxWidth: num(input.maxWidth, `${f}: Max. Breite`, 0, CARD_WIDTH * 2), shadow: flag(input.shadow, `${f}: Schatten`),
      };
    }
    case 'rect':
      return {
        id, type, x: X(input.x, `${f}: X`), y: Y(input.y, `${f}: Y`), w: num(input.w, `${f}: Breite`, 1, CARD_WIDTH * 2),
        h: num(input.h, `${f}: Höhe`, 1, CARD_WIDTH * 2), radius: num(input.radius, `${f}: Ecken`, 0, 1024),
        color: hex(input.color, `${f}: Farbe`), opacity: opacity(input.opacity, `${f}: Deckkraft`),
      };
    case 'circle':
      return {
        id, type, x: X(input.x, `${f}: X`), y: Y(input.y, `${f}: Y`), r: num(input.r, `${f}: Radius`, 1, 1024),
        color: hex(input.color, `${f}: Farbe`), opacity: opacity(input.opacity, `${f}: Deckkraft`),
      };
    case 'line':
      return {
        id, type, x1: X(input.x1, `${f}: X1`), y1: Y(input.y1, `${f}: Y1`), x2: X(input.x2, `${f}: X2`), y2: Y(input.y2, `${f}: Y2`),
        width: num(input.width, `${f}: Stärke`, 1, 100), color: hex(input.color, `${f}: Farbe`), opacity: opacity(input.opacity, `${f}: Deckkraft`),
      };
    case 'image':
      return {
        id, type, x: X(input.x, `${f}: X`), y: Y(input.y, `${f}: Y`), w: num(input.w, `${f}: Breite`, 1, CARD_WIDTH * 2),
        h: num(input.h, `${f}: Höhe`, 1, CARD_WIDTH * 2), url: httpUrl(input.url, `${f}: Bild-URL`),
        radius: num(input.radius, `${f}: Ecken`, 0, 1024), opacity: opacity(input.opacity, `${f}: Deckkraft`),
      };
  }
}

/** Full check of a card from the dashboard; throws CardValidationError with a German message. */
export function validateCard(raw: unknown, label = 'Karte'): WelcomeCard {
  const input = record(raw, label);
  if (input.width !== CARD_WIDTH || input.height !== CARD_HEIGHT) fail(`${label}: Format muss ${CARD_WIDTH}×${CARD_HEIGHT} sein.`);
  const bg = record(input.background, `${label}: Hintergrund`);
  const type = oneOf(bg.type, `${label}: Hintergrundtyp`, ['color', 'gradient', 'image'] as const);
  const background: CardBackground = {
    type,
    color: hex(bg.color, `${label}: Hintergrundfarbe`),
    color2: hex(bg.color2, `${label}: Zweite Farbe`),
    angle: num(bg.angle, `${label}: Winkel`, 0, 360),
    imageUrl: bg.imageUrl === null || bg.imageUrl === '' || bg.imageUrl === undefined ? null : httpUrl(bg.imageUrl, `${label}: Hintergrundbild`),
    dim: num(bg.dim, `${label}: Abdunkeln`, 0, 80),
  };
  if (type === 'image' && !background.imageUrl) fail(`${label}: Bitte gib eine Bild-URL für den Hintergrund an.`);
  if (!Array.isArray(input.layers)) fail(`${label}: Ebenen erwartet.`);
  const rawLayers = input.layers as unknown[];
  if (rawLayers.length > CARD_MAX_LAYERS) fail(`${label}: höchstens ${CARD_MAX_LAYERS} Ebenen.`);
  const layers = rawLayers.map((layer, index) => parseLayer(layer, `${label}: Ebene ${index + 1}`));
  if (new Set(layers.map((layer) => layer.id)).size !== layers.length) fail(`${label}: doppelte Ebenen-ID.`);
  return { enabled: flag(input.enabled, `${label}: Aktiv`), width: CARD_WIDTH, height: CARD_HEIGHT, background, layers };
}

/** Lenient read of a stored card: the card when valid, otherwise null. */
export function safeCard(raw: unknown): WelcomeCard | null {
  try {
    return validateCard(raw);
  } catch {
    return null;
  }
}

// ---------- Rendering ----------

export interface CardImage { width: number; height: number }

/** The part of CanvasRenderingContext2D the renderer uses (browser canvas and @napi-rs/canvas both fit). */
export interface CardContext<I> {
  fillStyle: string | object;
  strokeStyle: string | object;
  lineWidth: number;
  lineCap: string;
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
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void;
  fill(): void;
  stroke(): void;
  clip(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): { addColorStop(offset: number, color: string): void };
  drawImage(image: I, dx: number, dy: number, dw: number, dh: number): void;
}

/** Pre-loaded images: the member avatar and every background/image-layer URL that loaded. */
export interface CardAssets<I> {
  avatar: I | null;
  images: Map<string, I>;
}

export const cardFont = (layer: Pick<TextLayer, 'font' | 'weight'>, size: number) => `${layer.weight} ${size}px "${CARD_FONTS[layer.font].family}"`;

/** Lines and the effective font size of a text layer (shrunk to maxWidth). */
export function layoutText<I>(ctx: CardContext<I>, layer: TextLayer, vars: CardVars): { lines: string[]; size: number; width: number } {
  const lines = fillPlaceholders(layer.text, vars).split('\n');
  ctx.font = cardFont(layer, layer.size);
  let width = Math.max(0, ...lines.map((line) => ctx.measureText(line).width));
  let size = layer.size;
  if (layer.maxWidth > 0 && width > layer.maxWidth) {
    size = Math.max(8, Math.floor(layer.size * layer.maxWidth / width));
    ctx.font = cardFont(layer, size);
    width = Math.max(0, ...lines.map((line) => ctx.measureText(line).width));
  }
  return { lines, size, width };
}

export const TEXT_LINE_HEIGHT = 1.2;

function roundedRect<I>(ctx: CardContext<I>, x: number, y: number, w: number, h: number, radius: number) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws the image so it covers the box (crop via the caller's clip). */
function drawCover<I extends CardImage>(ctx: CardContext<I>, image: I, x: number, y: number, w: number, h: number) {
  if (!image.width || !image.height) return;
  const scale = Math.max(w / image.width, h / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function avatarPath<I>(ctx: CardContext<I>, layer: AvatarLayer, grow: number) {
  const { x, y, size, shape } = layer;
  if (shape === 'circle') {
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 + grow, 0, Math.PI * 2);
    ctx.closePath();
  } else {
    roundedRect(ctx, x - grow, y - grow, size + grow * 2, size + grow * 2, shape === 'rounded' ? size * 0.2 + grow : 0);
  }
}

function drawBackground<I extends CardImage>(ctx: CardContext<I>, bg: CardBackground, assets: CardAssets<I>) {
  const W = CARD_WIDTH;
  const H = CARD_HEIGHT;
  if (bg.type === 'gradient') {
    const a = (bg.angle * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const half = (Math.abs(W * cos) + Math.abs(H * sin)) / 2;
    const gradient = ctx.createLinearGradient(W / 2 - cos * half, H / 2 - sin * half, W / 2 + cos * half, H / 2 + sin * half);
    gradient.addColorStop(0, bg.color);
    gradient.addColorStop(1, bg.color2);
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = bg.color;
  }
  ctx.fillRect(0, 0, W, H);
  const image = bg.type === 'image' && bg.imageUrl ? assets.images.get(bg.imageUrl) : undefined;
  if (image) drawCover(ctx, image, 0, 0, W, H);
  if (bg.dim > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${bg.dim / 100})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawLayer<I extends CardImage>(ctx: CardContext<I>, layer: CardLayer, assets: CardAssets<I>, vars: CardVars) {
  switch (layer.type) {
    case 'avatar': {
      ctx.save();
      avatarPath(ctx, layer, 0);
      ctx.clip();
      if (assets.avatar) drawCover(ctx, assets.avatar, layer.x, layer.y, layer.size, layer.size);
      else { ctx.fillStyle = '#5865F2'; ctx.fillRect(layer.x, layer.y, layer.size, layer.size); }
      ctx.restore();
      if (layer.borderWidth > 0) {
        avatarPath(ctx, layer, layer.borderWidth / 2);
        ctx.lineWidth = layer.borderWidth;
        ctx.strokeStyle = layer.borderColor;
        ctx.stroke();
      }
      return;
    }
    case 'text': {
      const { lines, size } = layoutText(ctx, layer, vars);
      ctx.fillStyle = layer.color;
      ctx.textAlign = layer.align;
      ctx.textBaseline = 'alphabetic';
      if (layer.shadow) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
        ctx.shadowBlur = Math.round(size * 0.18);
        ctx.shadowOffsetY = Math.round(size * 0.06);
      }
      lines.forEach((line, index) => ctx.fillText(line, layer.x, layer.y + index * size * TEXT_LINE_HEIGHT));
      return;
    }
    case 'rect':
      ctx.globalAlpha = layer.opacity / 100;
      ctx.fillStyle = layer.color;
      roundedRect(ctx, layer.x, layer.y, layer.w, layer.h, layer.radius);
      ctx.fill();
      return;
    case 'circle':
      ctx.globalAlpha = layer.opacity / 100;
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      ctx.arc(layer.x, layer.y, layer.r, 0, Math.PI * 2);
      ctx.fill();
      return;
    case 'line':
      ctx.globalAlpha = layer.opacity / 100;
      ctx.strokeStyle = layer.color;
      ctx.lineWidth = layer.width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(layer.x1, layer.y1);
      ctx.lineTo(layer.x2, layer.y2);
      ctx.stroke();
      return;
    case 'image': {
      const image = assets.images.get(layer.url);
      if (!image) return;
      ctx.globalAlpha = layer.opacity / 100;
      roundedRect(ctx, layer.x, layer.y, layer.w, layer.h, layer.radius);
      ctx.clip();
      drawCover(ctx, image, layer.x, layer.y, layer.w, layer.h);
      return;
    }
  }
}

/** Draws the whole card at 1024×450 onto `ctx`. Missing images are skipped (avatar gets a placeholder). */
export function renderCard<I extends CardImage>(ctx: CardContext<NoInfer<I>>, card: WelcomeCard, assets: CardAssets<I>, vars: CardVars): void {
  ctx.save();
  drawBackground(ctx, card.background, assets);
  ctx.restore();
  for (const layer of card.layers) {
    ctx.save();
    drawLayer(ctx, layer, assets, vars);
    ctx.restore();
  }
}

/** Every remote image URL the card needs (background + image layers). */
export function cardImageUrls(card: WelcomeCard): string[] {
  const urls = card.layers.flatMap((layer) => (layer.type === 'image' ? [layer.url] : []));
  if (card.background.type === 'image' && card.background.imageUrl) urls.push(card.background.imageUrl);
  return [...new Set(urls)];
}

export const cardHasAvatar = (card: WelcomeCard) => card.layers.some((layer) => layer.type === 'avatar');
