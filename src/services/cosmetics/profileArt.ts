// Nexo's own pictures for Discord, all from one recipe: the profile banner, the test bot's banner and avatar, and the
// event banners the bot puts on its server profile. Walnut from the dashboard, the burnt vine, fireflies, and paint
// brushed onto the wood (brush.ts). `npm run brand:assets` writes them all to assets/brand/profile/.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, type Image, type SKRSContext2D } from '@napi-rs/canvas';
import { eventIconSvg, type EventTheme } from '../../shared/eventIcons.js';
import { PROFILE_FONTS, createRng, seedFrom } from '../../shared/profileCard.js';
import { logger } from '../../utils/logger.js';
import '../welcomeCardRenderer.js'; // registers the card fonts
import { brush } from './brush.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const loaded = new Map<string, Promise<Image | null>>();
/** An image from the repo (the Dockerfile copies these next to dist), loaded once; null if it is missing. */
function asset(file: string): Promise<Image | null> {
  let image = loaded.get(file);
  if (!image) {
    image = Promise.resolve().then(() => loadImage(readFileSync(path.join(ROOT, file)))).catch((error: unknown) => {
      logger.warn(`Bild für das Profil-Banner fehlt (${file}):`, (error as Error).message);
      return null;
    });
    loaded.set(file, image);
  }
  return image;
}
/** The dashboard's walnut (assets/wood/CREDITS.md). */
const WALNUT = 'dashboard/src/assets/wood/walnut.webp';
/** The vine burnt into the dashboard's page headers (components/Engraving.tsx), rendered once to a transparent PNG. */
// ponytail: a snapshot of Engraving.tsx; render it again if the vine there changes.
const VINE = 'assets/brand/vine.png';
const NEXO_LOGO = 'assets/brand/nexo-logo-1024.png';

/**
 * Banner sizes. 'app': the banner uploaded in the Developer Portal (17:6, shown whole). 'server': the per-server
 * profile banner the bot sets itself (5:2); Discord shows it about 17:6 and cuts `crop` px off the top and bottom.
 */
export const BANNER_FORMATS = {
  app: { width: 1360, height: 480, crop: 0 },
  server: { width: 960, height: 384, crop: 24 },
} as const;

/** Layout in design units: the server banner's 960×384, of which y 24–360 is visible. */
const VISIBLE_TOP = 24;
const VISIBLE_HEIGHT = 336;
/** Where the event icons are painted (x, y, size): large and calm in the background, right of the text. */
const ICON_SPOTS: readonly [number, number, number][] = [
  [470, 262, 70], [612, 172, 56], [716, 286, 84], [858, 200, 66], [560, 330, 44], [905, 318, 48],
];
/** Fireflies (x, y on a 680×240 page, radius), as on the first test banner. */
const FIREFLIES: readonly [number, number, number][] = [
  [612, 64, 3.2], [566, 112, 2.2], [500, 30, 2.6], [452, 128, 1.8], [640, 150, 2.4], [395, 92, 2], [530, 178, 1.6],
  [300, 40, 1.6], [252, 118, 2], [588, 206, 1.4], [430, 196, 1.3], [660, 104, 1.8], [220, 64, 1.2],
];

/** A warm glowing dot: a wide faint halo, a brighter glow and a pale core. */
function firefly(ctx: SKRSContext2D, x: number, y: number, r: number, opacity: number) {
  const glow = (radius: number, stops: [number, string][]) => {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    for (const [at, colour] of stops) gradient.addColorStop(at, colour);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  };
  ctx.save();
  ctx.globalAlpha = opacity;
  glow(r * 8, [[0, 'rgba(200,205,100,0.2)'], [1, 'rgba(200,205,100,0)']]);
  glow(r * 3.5, [[0, 'rgba(240,220,120,0.6)'], [1, 'rgba(240,220,120,0)']]);
  glow(r * 1.2, [[0, '#fffbe0'], [0.55, '#f0dc7a'], [1, 'rgba(240,220,122,0)']]);
  ctx.restore();
}

export interface BannerOptions {
  format: keyof typeof BANNER_FORMATS;
  /** Seed for the brush and the scattering, so a banner looks the same every time. */
  seed: string;
  /** Paint colour of the frame and the brushed words; without one the wood stays unpainted. */
  tint?: string;
  /** Brushed beside "Nexo" (the discount, or "TEST"). */
  tag?: string;
  /** Brushed below "Nexo" (the event name). */
  title?: string;
  /** Event icons painted onto the wood. */
  icon?: EventTheme;
}

/**
 * A profile banner: walnut washed behind the text (the dashboard's page headers), the burnt vine, "Nexo" in cream,
 * fireflies, and with a tint a frame, tag and title brushed on, plus painted event icons. All text sits above the
 * avatar, which Discord lays over the lower left.
 */
export async function renderProfileBanner(options: BannerOptions): Promise<Buffer> {
  const { width: W, height: H, crop } = BANNER_FORMATS[options.format];
  const s = (H - 2 * crop) / VISIBLE_HEIGHT;
  const design = (target: SKRSContext2D) => target.setTransform(s, 0, 0, s, 0, crop - VISIBLE_TOP * s);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const [wood, vine, icon] = await Promise.all([
    asset(WALNUT), asset(VINE), options.icon ? loadImage(Buffer.from(eventIconSvg(options.icon))) : null,
  ]);
  if (wood) {
    // Cover: fill the height, centre the slab.
    const scale = H / wood.height;
    ctx.drawImage(wood, (W - wood.width * scale) / 2, 0, wood.width * scale, H);
  } else {
    ctx.fillStyle = '#2e1f14';
    ctx.fillRect(0, 0, W, H);
  }
  // Washed toward the dashboard's page colour over the text column, the wood shows on the right (Backdrop.tsx).
  const wash = ctx.createLinearGradient(0, 0, W, 0);
  wash.addColorStop(0, 'rgba(22,17,12,0.62)');
  wash.addColorStop(0.35, 'rgba(22,17,12,0.48)');
  wash.addColorStop(0.7, 'rgba(22,17,12,0.1)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);
  design(ctx);
  if (vine) ctx.drawImage(vine, 960 - vine.width, 0);
  ctx.resetTransform();

  const rng = createRng(seedFrom(options.seed));
  if (options.tint) {
    const pixels = ctx.getImageData(0, 0, W, H);
    const paint = brush(W, H, rng);
    paint.frame(pixels.data, options.tint, crop);
    const words = createCanvas(W, H).getContext('2d');
    design(words);
    words.textBaseline = 'alphabetic';
    words.font = `700 64px "${PROFILE_FONTS.unbounded}"`;
    const nexoEnd = 60 + words.measureText('Nexo').width;
    if (options.tag) {
      words.font = `700 58px "${PROFILE_FONTS.caveat}"`;
      words.fillText(options.tag, nexoEnd + 30, 112);
    }
    if (options.title) {
      // Long names get a smaller size instead of being squeezed.
      let size = 60;
      words.font = `700 ${size}px "${PROFILE_FONTS.caveat}"`;
      while (words.measureText(options.title).width > 480 && size > 34) words.font = `700 ${(size -= 2)}px "${PROFILE_FONTS.caveat}"`;
      words.fillText(options.title, 62, 186);
    }
    paint.through(pixels.data, words.getImageData(0, 0, W, H).data, options.tint);
    if (icon) {
      // The dashboard's event icons, painted onto the wood in their own colours.
      const icons = createCanvas(W, H).getContext('2d');
      design(icons);
      for (const [x, y, size] of ICON_SPOTS) {
        icons.save();
        icons.translate(x, y);
        icons.rotate((rng() - 0.5) * 0.5);
        icons.drawImage(icon, -size / 2, -size / 2, size, size);
        icons.restore();
      }
      paint.through(pixels.data, icons.getImageData(0, 0, W, H).data);
    }
    ctx.putImageData(pixels, 0, 0);
  }
  design(ctx);
  // The fireflies glow above the paint.
  for (const [x, y, r] of FIREFLIES) firefly(ctx, x * (960 / 680), VISIBLE_TOP + y * (VISIBLE_HEIGHT / 240), r * 2.1, 0.7 + rng() * 0.3);
  // "Nexo" in the dashboard's cream.
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 64px "${PROFILE_FONTS.unbounded}"`;
  ctx.shadowColor = 'rgba(22,17,12,0.9)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#F3EBE0';
  ctx.fillText('Nexo', 60, 124);
  return canvas.toBuffer('image/png');
}

/**
 * The test bot's avatar: the Nexo logo with its slice's rim brushed in `tint` and "TEST" brushed on the wood below
 * the robot, parallel to the sticker's lower edge (which rises 7.1° to the right, centred at x 542 on the 1024 logo).
 */
export async function renderTestAvatar(tint = '#FFC400'): Promise<Buffer> {
  const logo = await asset(NEXO_LOGO);
  if (!logo) throw new Error(`${NEXO_LOGO} fehlt`);
  const S = logo.width;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(logo, 0, 0);
  const pixels = ctx.getImageData(0, 0, S, S);
  const rng = createRng(seedFrom('test-avatar'));
  const paint = brush(S, S, rng);
  paint.rim(pixels.data, tint, S / 2, S / 2, S * 0.49);
  const words = createCanvas(S, S).getContext('2d');
  const tilt = (-7.1 * Math.PI) / 180;
  words.font = `700 ${Math.round(S * 0.12)}px "${PROFILE_FONTS.caveat}"`;
  words.textAlign = 'center';
  words.textBaseline = 'middle';
  const gap = S * 0.05 + S * 0.04;
  words.translate((542 / 1024) * S - gap * Math.sin(tilt), (753 / 1024) * S + gap * Math.cos(tilt));
  words.rotate(tilt);
  words.fillText('TEST', 0, 0);
  paint.through(pixels.data, words.getImageData(0, 0, S, S).data, tint);
  ctx.putImageData(pixels, 0, 0);
  return canvas.toBuffer('image/png');
}
