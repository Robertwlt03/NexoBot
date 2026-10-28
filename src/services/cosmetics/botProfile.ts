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
import { brush } from './brush.js';

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

/** Where the event icons are painted (x, y, size): large and calm in the background, right of the text. */
const ICON_SPOTS: readonly [number, number, number][] = [
  [470, 262, 70], [612, 172, 56], [716, 286, 84], [858, 200, 66], [560, 330, 44], [905, 318, 48],
];
/** The test banner's fireflies (x, y on its 680×240 page, radius), placed on this banner's visible 17:6 area. */
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

/**
 * 960×384 banner (Discord's 5:2) in the look of the dashboard and the test bot's banner: walnut washed behind the
 * text, the burnt vine, a frame brushed on in the event colour, "Nexo" in cream with the event name and discount
 * brushed on, the dashboard's event icons painted onto the wood and the test banner's fireflies glowing above. The
 * profile shows it about 17:6, cutting ~24px off the top and bottom, and puts the avatar over the lower left; so all
 * text sits above y≈200 and nothing touches the cut edges.
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
  // The frame and the event's words brushed on in the theme colour, the same recipe as the test banner.
  const pixels = ctx.getImageData(0, 0, W, H);
  const paint = brush(W, H, rng);
  paint.frame(pixels.data, tint, 24);
  const words = createCanvas(W, H).getContext('2d');
  words.textBaseline = 'alphabetic';
  words.font = `700 64px "${PROFILE_FONTS.unbounded}"`;
  const nexoEnd = 60 + words.measureText('Nexo').width;
  if (event.discount > 0) {
    words.font = `700 54px "${PROFILE_FONTS.caveat}"`;
    words.fillText(`−${event.discount} %`, nexoEnd + 30, 112);
  }
  // Long names get a smaller size instead of being squeezed.
  let size = 60;
  words.font = `700 ${size}px "${PROFILE_FONTS.caveat}"`;
  while (words.measureText(event.name).width > W * 0.5 && size > 34) words.font = `700 ${(size -= 2)}px "${PROFILE_FONTS.caveat}"`;
  words.fillText(event.name, 62, 186);
  paint.through(pixels.data, words.getImageData(0, 0, W, H).data, tint);
  // The dashboard's event icons, painted onto the wood in their own colours.
  const icons = createCanvas(W, H).getContext('2d');
  for (const [x, y, size] of ICON_SPOTS) {
    icons.save();
    icons.translate(x, y);
    icons.rotate((rng() - 0.5) * 0.5);
    icons.drawImage(icon, -size / 2, -size / 2, size, size);
    icons.restore();
  }
  paint.through(pixels.data, icons.getImageData(0, 0, W, H).data);
  ctx.putImageData(pixels, 0, 0);
  // The fireflies glow above the paint, as in the test banner.
  const sx = W / 680;
  for (const [x, y, r] of FIREFLIES) firefly(ctx, x * sx, 24 + y * ((H - 48) / 240), r * 1.5 * sx, 0.7 + rng() * 0.3);
  // "Nexo" in the dashboard's cream, as in the test banner.
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 64px "${PROFILE_FONTS.unbounded}"`;
  ctx.shadowColor = 'rgba(22,17,12,0.9)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#F3EBE0';
  ctx.fillText('Nexo', 60, 124);
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
