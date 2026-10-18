// Welcome, goodbye and auto role (same storage as /welcome and the greet dashboard).

import express from 'express';
import type { Guild } from 'discord.js';
import type { DashboardModule } from './index.js';
import type { WelcomeMessageSettings, WelcomeSettings } from '../dto/welcome.js';
import { locals } from '../dashboard.js';
import { badRequest, body, bool, channel, hexColor, int, role, str, url } from '../http.js';
import { getWelcomeConfig, updateWelcomeConfig, type WelcomeConfig, type WelcomeEmbedConfig } from '../../utils/database.js';
import { getGuildConfig } from '../../services/config/guildConfig.js';
import { getColor } from '../../config/bot.js';
import type { NexoClient } from '../../types/index.js';

function toHex(color: unknown, fallback: string): string {
  if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) return color.toUpperCase();
  if (typeof color === 'number') return `#${color.toString(16).padStart(6, '0').toUpperCase()}`;
  return fallback;
}

function embedImage(embed: WelcomeEmbedConfig | undefined): string | null {
  const image = (embed as { image?: unknown } | undefined)?.image;
  if (typeof image === 'string') return image;
  if (image && typeof image === 'object' && 'url' in image && typeof image.url === 'string') return image.url;
  return null;
}

async function readSettings(client: NexoClient, guildId: string): Promise<WelcomeSettings> {
  const [config, guildConfig] = await Promise.all([getWelcomeConfig(client, guildId), getGuildConfig(client, guildId)]);
  return {
    welcome: {
      enabled: config.enabled,
      channelId: config.channelId,
      message: config.welcomeMessage,
      ping: config.welcomePing,
      imageUrl: config.welcomeImage ?? embedImage(config.welcomeEmbed),
      embedTitle: config.welcomeEmbed?.title ?? '🎉 Willkommen!',
      embedFooter: config.welcomeEmbed?.footer ?? 'Willkommen auf {server}!',
      embedColor: toHex(config.welcomeEmbed?.color, toHex(getColor('success'), '#57F287')),
    },
    goodbye: {
      enabled: config.goodbyeEnabled,
      channelId: config.goodbyeChannelId,
      message: config.leaveMessage,
      ping: config.goodbyePing,
      imageUrl: embedImage(config.leaveEmbed),
      embedTitle: config.leaveEmbed?.title ?? '👋 Auf Wiedersehen',
      embedFooter: config.leaveEmbed?.footer ?? 'Tschüss von {server}!',
      embedColor: toHex(config.leaveEmbed?.color, toHex(getColor('error'), '#ED4245')),
    },
    autoRole: { roleId: config.roleIds[0] ?? null, delaySeconds: config.autoRoleDelay ?? 0 },
    verificationActive: Boolean(guildConfig.verification?.enabled || guildConfig.verification?.autoVerify?.enabled),
  };
}

function parseMessage(guild: Guild, raw: unknown, label: string): WelcomeMessageSettings {
  const input = body(raw);
  const result: WelcomeMessageSettings = {
    enabled: bool(input.enabled, `${label}: Aktiv`),
    channelId: channel(guild, input.channelId, `${label}: Kanal`),
    message: str(input.message, `${label}: Nachricht`, { min: 1, max: 2000 }),
    ping: bool(input.ping, `${label}: Erwähnen`),
    imageUrl: url(input.imageUrl, `${label}: Bild`),
    embedTitle: str(input.embedTitle, `${label}: Titel`, { max: 256 }),
    embedFooter: str(input.embedFooter, `${label}: Fußzeile`, { max: 2048 }),
    embedColor: hexColor(input.embedColor, `${label}: Farbe`),
  };
  if (result.enabled && !result.channelId) throw badRequest(`${label}: Bitte wähle einen Kanal aus.`);
  return result;
}

export const welcomeModule: DashboardModule = {
  id: 'welcome',
  router: (client) => {
    const router = express.Router();

    router.get('/', async (_req, res) => {
      res.json(await readSettings(client, locals(res).guild.id));
    });

    router.put('/', async (req, res) => {
      const { guild } = locals(res);
      const input = body(req.body);
      const welcome = parseMessage(guild, input.welcome, 'Willkommen');
      const goodbye = parseMessage(guild, input.goodbye, 'Abschied');
      const autoRole = body(input.autoRole);
      const autoRoleId = role(guild, autoRole.roleId, 'Auto-Rolle', { assignable: true });
      const delaySeconds = int(autoRole.delaySeconds, 'Verzögerung', 0, 3600);

      const current = await readSettings(client, guild.id);
      if (autoRoleId && current.verificationActive) {
        throw badRequest('Auto-Rolle und Verifizierung schließen sich aus. Deaktiviere zuerst die Verifizierung.');
      }

      const existing = await getWelcomeConfig(client, guild.id);
      const updates: Partial<WelcomeConfig> = {
        enabled: welcome.enabled,
        channelId: welcome.channelId,
        welcomeMessage: welcome.message,
        welcomePing: welcome.ping,
        welcomeImage: welcome.imageUrl,
        welcomeEmbed: { ...existing.welcomeEmbed, title: welcome.embedTitle, footer: welcome.embedFooter, color: welcome.embedColor },
        goodbyeEnabled: goodbye.enabled,
        goodbyeChannelId: goodbye.channelId,
        leaveMessage: goodbye.message,
        goodbyePing: goodbye.ping,
        leaveEmbed: { ...existing.leaveEmbed, title: goodbye.embedTitle, footer: goodbye.embedFooter, color: goodbye.embedColor, image: goodbye.imageUrl ?? undefined },
        roleIds: autoRoleId ? [autoRoleId] : [],
        autoRoleDelay: delaySeconds,
      };
      await updateWelcomeConfig(client, guild.id, updates);
      res.json(await readSettings(client, guild.id));
    });

    return router;
  },
};
