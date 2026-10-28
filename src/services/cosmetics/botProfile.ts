// Nexo dresses up for events: while a shop event runs, the bot's per-server profile gets an event banner and bio
// (Discord's per-server bot profile, guild.members.editMe); afterwards both are reset to the global profile.
// Checked every 30 minutes; a server is only touched when its look has to change.

import cron from 'node-cron';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, type Image, type SKRSContext2D } from '@napi-rs/canvas';
import { Events, type Client } from 'discord.js';
import { EVENT_TINT, eventIconSvg, eventTheme } from '../../shared/eventIcons.js';
import { PROFILE_FONTS, createRng, seedFrom } from '../../shared/profileCard.js';
import type { ShopEvent } from '../../web/dto/profile.js';
import { logger } from '../../utils/logger.js';
import '../welcomeCardRenderer.js'; // registers the card fonts
import { loadStoredEvents, runningEvents } from './events.js';
import { cosmeticsPool } from './db.js';

/** Bio text for the event (Discord allows 190 characters). Pure, for tests. */
export function eventBio(event: ShopEvent): string {
  const deal = event.discount > 0 ? ` – ${event.discount} % im Shop` : '';
  return `🎉 ${event.name} läuft${deal}! Gemeinschaftsziel, Tagesaufgaben und Event-Artikel: /profil aufgaben und /profil shop`.slice(0, 190);
}

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const loaded = new Map<string, Promise<Image | null>>();
/** An image from the repo (the Dockerfile copies these next to dist), loaded once; null if it is missing. */
function asset(file: string): Promise<Image | null> {
  let image = loaded.get(file);
  if (!image) {
    image = Promise.resolve().then(() => loadImage(readFileSync(path.join(ROOT, file)))).catch((error: unknown) => {
      logger.warn(`Bild für das Event-Banner fehlt (${file}):`, (error as Error).message);
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

/** A frame brushed onto the wood in the event colour: a ragged coat, then single bristle strokes over it. */
function paintFrame(ctx: SKRSContext2D, W: number, H: number, color: string, rng: () => number) {
  // Thicker at the top and bottom: the profile cuts ~24px off there.
  const band = { top: 42, bottom: 42, side: 20 };
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  // The coat: an even ring with a ragged inner edge.
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  const inner: [number, number][] = [];
  for (let x = band.side; x <= W - band.side; x += 18) inner.push([x, band.top * (0.7 + rng() * 0.5)]);
  for (let y = band.top; y <= H - band.bottom; y += 18) inner.push([W - band.side * (0.7 + rng() * 0.5), y]);
  for (let x = W - band.side; x >= band.side; x -= 18) inner.push([x, H - band.bottom * (0.7 + rng() * 0.5)]);
  for (let y = H - band.bottom; y >= band.top; y -= 18) inner.push([band.side * (0.7 + rng() * 0.5), y]);
  inner.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill('evenodd');
  // Bristles along each edge, with gaps where the brush ran dry.
  const stroke = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.globalAlpha = 0.25 + rng() * 0.5;
    ctx.lineWidth = 2 + rng() * 6;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + x2) / 2 + (rng() - 0.5) * 6, (y1 + y2) / 2 + (rng() - 0.5) * 6, x2, y2);
    ctx.stroke();
  };
  for (let i = 0; i < 110; i += 1) {
    const from = -20 + rng() * W * 0.6;
    const to = Math.min(W + 20, from + 120 + rng() * W * 0.6);
    stroke(from, rng() * band.top, to, rng() * band.top);
    stroke(W - from, H - rng() * band.bottom, W - to, H - rng() * band.bottom);
  }
  for (let i = 0; i < 45; i += 1) {
    const from = -20 + rng() * H * 0.6;
    const to = Math.min(H + 20, from + 60 + rng() * H * 0.6);
    stroke(rng() * band.side, from, rng() * band.side, to);
    stroke(W - rng() * band.side, H - from, W - rng() * band.side, H - to);
  }
  ctx.restore();
}

/** Text brushed on in `color`: the letters with thin dry streaks scraped out of them, so the wood shows through. */
function paintText(ctx: SKRSContext2D, text: string, x: number, y: number, font: string, color: string, rng: () => number) {
  const { width, height } = ctx.canvas;
  const layer = createCanvas(width, height);
  const paint = layer.getContext('2d');
  paint.font = font;
  paint.textBaseline = 'alphabetic';
  paint.fillStyle = color;
  paint.fillText(text, x, y);
  paint.globalCompositeOperation = 'destination-out';
  paint.strokeStyle = '#000';
  const top = y - parseInt(font.match(/(\d+)px/)?.[1] ?? '40', 10);
  for (let i = 0; i < 26; i += 1) {
    paint.globalAlpha = 0.25 + rng() * 0.5;
    paint.lineWidth = 0.8 + rng() * 1.6;
    const sy = top + rng() * (y - top + 12);
    paint.beginPath();
    paint.moveTo(x - 10 + rng() * 40, sy);
    paint.lineTo(x + paint.measureText(text).width * (0.4 + rng() * 0.7), sy + (rng() - 0.5) * 4);
    paint.stroke();
  }
  ctx.save();
  ctx.shadowColor = 'rgba(16,11,7,0.7)';
  ctx.shadowBlur = 10;
  ctx.globalAlpha = 0.95;
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
}

/** Where the event icons sit (x, y, size), right of the text and below the vine, like the fireflies of the test banner. */
const ICON_SPOTS: readonly [number, number, number][] = [
  [470, 250, 44], [590, 304, 36], [700, 232, 54], [822, 292, 40], [904, 214, 32], [548, 182, 30], [760, 332, 28], [655, 150, 28],
];

/**
 * 960×384 banner (Discord's 5:2) in the look of the dashboard and the test bot's banner: walnut washed behind the
 * text, the burnt vine, a frame brushed on in the event colour, "Nexo" in cream with the event name and discount
 * brushed on, and the event's icons from the dashboard. The profile shows it about 17:6, cutting ~24px off the top
 * and bottom, and puts the avatar over the lower left; so all text sits above y≈200 and nothing touches the cut edges.
 */
export async function renderEventBanner(event: ShopEvent): Promise<Buffer> {
  const W = 960;
  const H = 384;
  const theme = eventTheme(event);
  const tint = EVENT_TINT[theme];
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const [wood, vine, icon] = await Promise.all([asset(WALNUT), asset(VINE), loadImage(Buffer.from(eventIconSvg(theme)))]);
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
  if (vine) ctx.drawImage(vine, W - vine.width, 0);
  const rng = createRng(seedFrom(event.id));
  ctx.save();
  ctx.shadowColor = 'rgba(16,11,7,0.6)';
  ctx.shadowBlur = 8;
  for (const [x, y, size] of ICON_SPOTS) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rng() - 0.5) * 0.5);
    ctx.drawImage(icon, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
  ctx.restore();
  paintFrame(ctx, W, H, tint, rng);
  // "Nexo" as in the test banner, the event brushed on beside and below it.
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 64px "${PROFILE_FONTS.unbounded}"`;
  ctx.shadowColor = 'rgba(22,17,12,0.9)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#F3EBE0';
  ctx.fillText('Nexo', 60, 124);
  const nexoEnd = 60 + ctx.measureText('Nexo').width;
  ctx.restore();
  if (event.discount > 0) paintText(ctx, `−${event.discount} %`, nexoEnd + 30, 112, `700 54px "${PROFILE_FONTS.caveat}"`, tint, rng);
  // Long names get a smaller size instead of being squeezed.
  let size = 60;
  const nameFont = () => `700 ${size}px "${PROFILE_FONTS.caveat}"`;
  ctx.font = nameFont();
  while (ctx.measureText(event.name).width > W * 0.5 && size > 34) {
    size -= 2;
    ctx.font = nameFont();
  }
  paintText(ctx, event.name, 62, 186, nameFont(), tint, rng);
  return canvas.toBuffer('image/png');
}

/** What each server currently shows: the event id, or '' for the normal profile (unknown after a restart). */
const applied = new Map<string, string>();

export async function syncBotProfiles(client: Client): Promise<void> {
  if (!cosmeticsPool() || !client.isReady()) return;
  const event = runningEvents(new Date(), await loadStoredEvents())[0] ?? null;
  const want = event?.id ?? '';
  const banner = event ? await renderEventBanner(event) : null;
  for (const guild of client.guilds.cache.values()) {
    // After a restart we do not know the look: a per-server banner means an event look is still on.
    const current = applied.get(guild.id) ?? (guild.members.me?.banner ? '?' : '');
    if (current === want) {
      applied.set(guild.id, want);
      continue;
    }
    try {
      await guild.members.editMe(event ? { banner, bio: eventBio(event) } : { banner: null, bio: null });
      applied.set(guild.id, want);
      await new Promise((resolve) => { setTimeout(resolve, 1500); });
    } catch (error) {
      logger.warn(`Event-Profil auf ${guild.name} nicht gesetzt:`, (error as Error).message);
      applied.set(guild.id, want);
    }
  }
}

export function startBotProfiles(client: Client): void {
  const run = () => { syncBotProfiles(client).catch((error: unknown) => logger.warn('Event-Profil fehlgeschlagen:', (error as Error).message)); };
  if (client.isReady()) run();
  else client.once(Events.ClientReady, run);
  cron.schedule('*/30 * * * *', run, { timezone: 'Europe/Berlin' });
}
