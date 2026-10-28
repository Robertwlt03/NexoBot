// Nexo dresses up for events: while a shop event runs, the bot's per-server profile gets an event banner and bio
// (Discord's per-server bot profile, guild.members.editMe); afterwards both are reset to the global profile.
// Checked every 30 minutes; a server is only touched when its look has to change.

import cron from 'node-cron';
import { Events, type Client } from 'discord.js';
import { EVENT_TINT, eventTheme } from '../../shared/eventIcons.js';
import type { ShopEvent } from '../../web/dto/profile.js';
import { logger } from '../../utils/logger.js';
import { loadStoredEvents, runningEvents } from './events.js';
import { cosmeticsPool } from './db.js';
import { renderProfileBanner } from './profileArt.js';

/** Bio text for the event (Discord allows 190 characters). Pure, for tests. */
export function eventBio(event: ShopEvent): string {
  const deal = event.discount > 0 ? ` – ${event.discount} % im Shop` : '';
  return `🎉 ${event.name} läuft${deal}! Gemeinschaftsziel, Tagesaufgaben und Event-Artikel: /profil aufgaben und /profil shop`.slice(0, 190);
}

/** The event's per-server banner: the profile banner with the event's colour, discount, name and icons. */
export function renderEventBanner(event: ShopEvent): Promise<Buffer> {
  const theme = eventTheme(event);
  return renderProfileBanner({
    format: 'server', seed: event.id, tint: EVENT_TINT[theme], icon: theme, title: event.name,
    tag: event.discount > 0 ? `−${event.discount} %` : undefined,
  });
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
