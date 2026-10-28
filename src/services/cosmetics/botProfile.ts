// Nexo dresses up for events: while a shop event runs, the bot's per-server profile gets an event banner and bio
// (Discord's per-server bot profile, guild.members.editMe); afterwards both are reset to the global profile.
// Checked every 30 minutes; a server is only touched when its look has to change.

import cron from 'node-cron';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, type Image, type SKRSContext2D } from '@napi-rs/canvas';
import { Events, type Client } from 'discord.js';
import type { BadgeGlyph } from '../../shared/cosmetics.js';
import { PROFILE_FONTS, createRng, drawGlyph, seedFrom } from '../../shared/profileCard.js';
import type { ShopEvent } from '../../web/dto/profile.js';
import { logger } from '../../utils/logger.js';
import '../welcomeCardRenderer.js'; // registers the card fonts
import { loadStoredEvents, runningEvents } from './events.js';
import { cosmeticsPool } from './db.js';

/** Colours (ground, highlight) and the symbol scattered over the banner, per built-in event. */
const LOOKS: Record<string, { colors: [string, string]; glyph: BadgeGlyph }> = {
  'new-year': { colors: ['#172554', '#F5C451'], glyph: 'star' },
  valentine: { colors: ['#881337', '#FDA4AF'], glyph: 'heart' },
  carnival: { colors: ['#4C1D95', '#FBBF24'], glyph: 'mask' },
  easter: { colors: ['#14532D', '#FDE68A'], glyph: 'egg' },
  'summer-sale': { colors: ['#075985', '#FDE047'], glyph: 'sun' },
  autumn: { colors: ['#7C2D12', '#FBBF24'], glyph: 'leaf' },
  halloween: { colors: ['#3B0764', '#FB923C'], glyph: 'pumpkin' },
  'black-friday': { colors: ['#0A0A0A', '#F5C451'], glyph: 'diamond' },
  christmas: { colors: ['#14532D', '#E0F2FE'], glyph: 'snowflake' },
};
const CUSTOM_LOOK = { colors: ['#1F2937', '#8FB36B'] as [string, string], glyph: 'star' as BadgeGlyph };

export const lookFor = (event: ShopEvent) => LOOKS[event.id] ?? CUSTOM_LOOK;

/** Bio text for the event (Discord allows 190 characters). Pure, for tests. */
export function eventBio(event: ShopEvent): string {
  const deal = event.discount > 0 ? ` – ${event.discount} % im Shop` : '';
  return `🎉 ${event.name} läuft${deal}! Gemeinschaftsziel, Tagesaufgaben und Event-Artikel: /profil aufgaben und /profil shop`.slice(0, 190);
}

/** The dashboard's walnut (assets/wood/CREDITS.md); the Dockerfile copies it next to dist. Null if it is missing. */
let walnut: Promise<Image | null> | undefined;
const WALNUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../dashboard/src/assets/wood/walnut.webp');
const walnutImage = () => (walnut ??= Promise.resolve().then(() => loadImage(readFileSync(WALNUT)))
  .catch((error: unknown) => {
    logger.warn('Holz für das Event-Banner fehlt:', (error as Error).message);
    return null;
  }));

/** A frame brushed onto the wood in the event colour: a ragged coat, then single bristle strokes over it. */
function paintFrame(ctx: SKRSContext2D, W: number, H: number, color: string, rng: () => number) {
  // Thicker at the top and bottom: the profile cuts ~24px off there.
  const band = { top: 46, bottom: 46, side: 24 };
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  // The coat: an even ring with a ragged inner edge.
  ctx.globalAlpha = 0.48;
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

/**
 * 960×384 banner (Discord's 5:2) in the dashboard's look: walnut with a frame brushed on in the event colour, the
 * event's symbols and its name. The profile shows it about 17:6, cutting ~24px off the top and bottom, and puts the
 * avatar over the lower left; so the text sits in the upper left and the symbols keep clear of the cut edges.
 */
export async function renderEventBanner(event: ShopEvent): Promise<Buffer> {
  const W = 960;
  const H = 384;
  const { colors: [ground, highlight], glyph } = lookFor(event);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const wood = await walnutImage();
  if (wood) {
    // Cover: fill the height, centre the slab.
    const scale = H / wood.height;
    ctx.drawImage(wood, (W - wood.width * scale) / 2, 0, wood.width * scale, H);
  } else {
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, W, H);
  }
  // Washed toward the dashboard's page colour behind the text, like the page headers.
  const wash = ctx.createLinearGradient(0, 0, W, 0);
  wash.addColorStop(0, 'rgba(22,17,12,0.62)');
  wash.addColorStop(0.55, 'rgba(22,17,12,0.25)');
  wash.addColorStop(1, 'rgba(22,17,12,0.1)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);
  const rng = createRng(seedFrom(event.id));
  for (let i = 0; i < 26; i += 1) {
    ctx.globalAlpha = 0.2 + rng() * 0.35;
    // Right half only, so the name on the left stays clear.
    drawGlyph(ctx as never, glyph, W * 0.6 + rng() * W * 0.34, 60 + rng() * (H - 120), 22 + rng() * 46, highlight, (rng() - 0.5) * 0.8);
  }
  ctx.globalAlpha = 1;
  paintFrame(ctx, W, H, highlight, rng);
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(16,11,7,0.85)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#F3EBE0';
  // Long names get a smaller size instead of being squeezed.
  const nameFont = (size: number) => `700 ${size}px "${PROFILE_FONTS.unbounded}"`;
  let size = 56;
  ctx.font = nameFont(size);
  while (ctx.measureText(event.name).width > W * 0.56 && size > 32) ctx.font = nameFont((size -= 2));
  ctx.fillText(event.name, 64, 132);
  if (event.discount > 0) {
    ctx.font = `700 32px "${PROFILE_FONTS.inter}"`;
    ctx.fillStyle = highlight;
    ctx.fillText(`−${event.discount} % im Nexo-Shop`, 66, 184);
  }
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
