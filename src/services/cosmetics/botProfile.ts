// Nexo dresses up for events: while a shop event runs, the bot's per-server profile gets an event banner and bio
// (Discord's per-server bot profile, guild.members.editMe); afterwards both are reset to the global profile.
// Checked every 30 minutes; a server is only touched when its look has to change.

import cron from 'node-cron';
import { createCanvas } from '@napi-rs/canvas';
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

/**
 * 960×384 banner (Discord's 5:2): the event colours, scattered symbols and the event name. The profile shows it about
 * 17:6, cutting ~24px off the top and bottom, and puts the avatar over the lower left; so the text sits in the upper
 * left and the symbols keep clear of the cut edges.
 */
export function renderEventBanner(event: ShopEvent): Buffer {
  const W = 960;
  const H = 384;
  const { colors: [ground, highlight], glyph } = lookFor(event);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, W, H);
  gradient.addColorStop(0, ground);
  gradient.addColorStop(1, '#09090C');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
  const rng = createRng(seedFrom(event.id));
  for (let i = 0; i < 26; i += 1) {
    ctx.globalAlpha = 0.18 + rng() * 0.35;
    // Right half only, so the name on the left stays clear.
    drawGlyph(ctx as never, glyph, W * 0.6 + rng() * W * 0.36, 48 + rng() * (H - 96), 22 + rng() * 46, highlight, (rng() - 0.5) * 0.8);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'alphabetic';
  // Long names get a smaller size instead of being squeezed.
  const nameFont = (size: number) => `700 ${size}px "${PROFILE_FONTS.unbounded}"`;
  let size = 56;
  ctx.font = nameFont(size);
  while (ctx.measureText(event.name).width > W * 0.56 && size > 32) ctx.font = nameFont((size -= 2));
  ctx.fillText(event.name, 56, 128);
  if (event.discount > 0) {
    ctx.font = `700 32px "${PROFILE_FONTS.inter}"`;
    ctx.fillStyle = highlight;
    ctx.fillText(`−${event.discount} % im Nexo-Shop`, 58, 180);
  }
  return canvas.toBuffer('image/png');
}

/** What each server currently shows: the event id, or '' for the normal profile (unknown after a restart). */
const applied = new Map<string, string>();

export async function syncBotProfiles(client: Client): Promise<void> {
  if (!cosmeticsPool() || !client.isReady()) return;
  const event = runningEvents(new Date(), await loadStoredEvents())[0] ?? null;
  const want = event?.id ?? '';
  const banner = event ? renderEventBanner(event) : null;
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
