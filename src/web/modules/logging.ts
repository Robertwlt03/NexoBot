// Logging: master switch, log channels, event toggles and ignore lists (same storage as /logging and its dashboard).

import express from 'express';
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import type { Guild } from 'discord.js';
import type { DashboardModule } from './index.js';
import { LOG_DESTINATIONS, type LogDestination, type LoggingEventCategory, type LoggingSettings } from '../dto/logging.js';
import { locals } from '../dashboard.js';
import { HttpError, badRequest, body, bool, channel, idList } from '../http.js';
import { getGuildConfig } from '../../services/config/guildConfig.js';
import {
  EVENT_TITLES, EVENT_TYPES, getIgnoreList, resolveLogChannel, setLogChannel, setLoggingEnabled, toggleEventLogging,
  updateIgnoreList,
} from '../../services/loggingService.js';
import { DASHBOARD_CATEGORIES, DASHBOARD_CATEGORY_LABELS } from '../../utils/logging/loggingUi.js';
import type { GuildConfig, NexoClient } from '../../types/index.js';

const ALL_EVENTS: string[] = Object.values(EVENT_TYPES);
const DESTINATION_OF: Record<string, LogDestination> = { application: 'applications', report: 'reports' };

const CATEGORIES: LoggingEventCategory[] = DASHBOARD_CATEGORIES.map((key) => ({
  key,
  label: DASHBOARD_CATEGORY_LABELS[key] ?? key,
  destination: DESTINATION_OF[key] ?? 'audit',
  events: ALL_EVENTS.filter((type) => type.startsWith(`${key}.`)).map((type) => ({ type, label: EVENT_TITLES[type] ?? type })),
}));

/** Same rule as isEventEnabled, without the master switch. */
export function eventEnabled(config: GuildConfig, type: string): boolean {
  const events = config.logging?.enabledEvents ?? {};
  return events[type] !== false && events[`${type.split('.')[0]}.*`] !== false;
}

/**
 * A log channel as logEvent can use it: a normal text channel where Nexo may view, send and embed
 * (same check as /logging channel). Returns null for "none".
 */
export function logChannel(guild: Guild, value: unknown, field: string): string | null {
  const id = channel(guild, value, field);
  if (!id) return null;
  const found = guild.channels.cache.get(id);
  if (!found || found.type !== ChannelType.GuildText) {
    throw badRequest(`${field}: Bitte wähle einen normalen Textkanal (kein Ankündigungskanal).`);
  }
  const me = guild.members.me;
  if (!me || !found.permissionsFor(me).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
    throw badRequest(`${field}: Nexo braucht in #${found.name} „Kanal ansehen“, „Nachrichten senden“ und „Links einbetten“.`);
  }
  return id;
}

/** The logging service functions report failures as `false`. */
export function saved(ok: boolean): void {
  if (!ok) throw new HttpError(500, 'Speichern fehlgeschlagen. Bitte versuch es erneut.');
}

async function userNames(client: NexoClient, guild: Guild, ids: string[]): Promise<Record<string, string>> {
  const entries = await Promise.all(ids.slice(0, 50).map(async (id) => {
    const user = guild.members.cache.get(id)?.user ?? client.users.cache.get(id) ?? await client.users.fetch(id).catch(() => null);
    return [id, user ? user.username : id] as const;
  }));
  return Object.fromEntries(entries);
}

async function readSettings(client: NexoClient, guild: Guild): Promise<LoggingSettings> {
  const config = await getGuildConfig(client, guild.id);
  const ignore = getIgnoreList(config);
  const users = [...(ignore.users ?? [])];
  return {
    enabled: Boolean(config.logging?.enabled),
    channels: Object.fromEntries(LOG_DESTINATIONS.map((dest) => [dest, resolveLogChannel(config, dest)])) as Record<LogDestination, string | null>,
    events: Object.fromEntries(ALL_EVENTS.map((type) => [type, eventEnabled(config, type)])),
    ignore: { users, channels: [...(ignore.channels ?? [])] },
    userNames: await userNames(client, guild, users),
    categories: CATEGORIES,
  };
}

const DESTINATION_LABELS: Record<LogDestination, string> = { audit: 'Audit-Log', applications: 'Bewerbungen', reports: 'Meldungen' };

export const loggingModule: DashboardModule = {
  id: 'logging',
  router: (client) => {
    const router = express.Router();

    router.get('/', async (_req, res) => {
      res.json(await readSettings(client, locals(res).guild));
    });

    router.put('/', async (req, res) => {
      const { guild } = locals(res);
      const input = body(req.body);
      const current = await readSettings(client, guild);

      // ---- validate everything first ----
      const enabled = bool(input.enabled, 'Logging');
      const channelsInput = body(input.channels);
      const channels = {} as Record<LogDestination, string | null>;
      for (const dest of LOG_DESTINATIONS) {
        const next = channelsInput[dest] || null;
        channels[dest] = next === current.channels[dest] ? current.channels[dest] : logChannel(guild, next, `Kanal ${DESTINATION_LABELS[dest]}`);
      }
      const eventsInput = body(input.events);
      const events = Object.fromEntries(ALL_EVENTS.map((type) => [type, bool(eventsInput[type], EVENT_TITLES[type] ?? type)]));
      const ignoreInput = body(input.ignore);
      if (!Array.isArray(ignoreInput.users) || ignoreInput.users.length > 100) throw badRequest('Ignorierte Nutzer: höchstens 100 Einträge.');
      const users = [...new Set(ignoreInput.users.map((id) => {
        if (typeof id !== 'string' || !/^\d{17,20}$/.test(id)) throw badRequest(`Ignorierte Nutzer: „${String(id)}“ ist keine gültige Nutzer-ID.`);
        return id;
      }))];
      const ignoredChannels = idList(guild, ignoreInput.channels, 'Ignorierte Kanäle', 'channel', 100);

      // ---- save through the logging service (same functions as /logging) ----
      let channelChanged = false;
      for (const dest of LOG_DESTINATIONS) {
        if (channels[dest] !== current.channels[dest]) {
          saved(await setLogChannel(client, guild.id, dest, channels[dest]));
          channelChanged = true;
        }
      }

      if (ALL_EVENTS.some((type) => events[type] !== current.events[type])) {
        // Category wildcards: on when any event of the category is on, off when all are off.
        const on = ALL_EVENTS.filter((type) => events[type]);
        const off = ALL_EVENTS.filter((type) => !events[type]);
        for (const category of CATEGORIES) {
          (category.events.some((event) => events[event.type]) ? on : off).unshift(`${category.key}.*`);
        }
        // Wildcards first: `x.*` = true switches the whole category on, the single "off" events follow.
        saved(await toggleEventLogging(client, guild.id, on, true));
        saved(await toggleEventLogging(client, guild.id, off, false));
      }

      const diffs: { action: string; type: string; id: string }[] = [
        ...users.filter((id) => !current.ignore.users.includes(id)).map((id) => ({ action: 'add', type: 'user', id })),
        ...current.ignore.users.filter((id) => !users.includes(id)).map((id) => ({ action: 'remove', type: 'user', id })),
        ...ignoredChannels.filter((id) => !current.ignore.channels.includes(id)).map((id) => ({ action: 'add', type: 'channel', id })),
        ...current.ignore.channels.filter((id) => !ignoredChannels.includes(id)).map((id) => ({ action: 'remove', type: 'channel', id })),
      ];
      for (const diff of diffs) {
        saved(await updateIgnoreList(client, guild.id, diff));
      }

      // Setting a channel switches logging on (like /logging channel); the explicit switch wins.
      if (channelChanged || enabled !== current.enabled) {
        saved(await setLoggingEnabled(client, guild.id, enabled));
      }

      res.json(await readSettings(client, guild));
    });

    return router;
  },
};
