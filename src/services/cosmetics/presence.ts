// Nexo's custom status rotates every few minutes between short, current lines: the running event and its deal,
// the season, quests and games – so the member list always says something about what is going on.

import { ActivityType, Events, type Client } from 'discord.js';
import type { ShopEvent } from '../../web/dto/profile.js';
import { logger } from '../../utils/logger.js';
import { seasonItems } from '../../shared/season.js';
import { loadStoredEvents, runningEvents } from './events.js';
import { currentSeason } from './season.js';

const ROTATE_MS = 5 * 60_000;

/** The status lines to rotate through (Discord shows up to 128 characters). Pure, for tests. */
export function statusLines(event: ShopEvent | null, season: string, guilds: number): string[] {
  return [
    ...(event ? [`🎉 ${event.name} läuft${event.discount > 0 ? ` · −${event.discount} % im Shop` : ''}`] : []),
    '📋 Neue Tagesaufgaben warten · /profil aufgaben',
    `🏆 Saison ${seasonItems(season).name} · /profil aufgaben`,
    '🎲 Vier gewinnt, Tic-Tac-Toe, Quiz · /fun spiel',
    `🌰 Auf ${guilds.toLocaleString('de-DE')} ${guilds === 1 ? 'Server' : 'Servern'} unterwegs`,
  ].map((line) => line.slice(0, 128));
}

export function startPresenceRotation(client: Client): void {
  let index = 0;
  const rotate = async () => {
    if (!client.isReady()) return;
    try {
      const event = runningEvents(new Date(), await loadStoredEvents())[0] ?? null;
      const lines = statusLines(event, currentSeason(), client.guilds.cache.size);
      // While an event runs, every other status is the event.
      const line = event && index % 2 === 0 ? lines[0] : lines[index % lines.length];
      index += 1;
      client.user.setPresence({ status: 'online', activities: [{ name: 'Custom Status', state: line, type: ActivityType.Custom }] });
    } catch (error) {
      logger.warn('Bot-Status konnte nicht gewechselt werden:', (error as Error).message);
    }
  };
  const start = () => {
    void rotate();
    setInterval(() => { void rotate(); }, ROTATE_MS).unref();
  };
  if (client.isReady()) start();
  else client.once(Events.ClientReady, start);
}
