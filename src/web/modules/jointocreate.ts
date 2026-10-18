// Join-to-Create: trigger channel with name template, user limit and bitrate (same storage/logic as /jointocreate).

import express from 'express';
import { PermissionFlagsBits } from 'discord.js';
import type { Guild } from 'discord.js';
import type { DashboardModule } from './index.js';
import type { JoinToCreateState, JoinToCreateTriggerSettings } from '../dto/jointocreate.js';
import { locals } from '../dashboard.js';
import { HttpError, body, channel, int, str } from '../http.js';
import { requireBotPermissions } from '../moduleSupport.js';
import {
  createJoinToCreateTrigger, getConfiguration, logConfigurationChange, removeJoinToCreateTrigger, updateChannelConfig,
  validateChannelNameTemplate,
} from '../../services/joinToCreateService.js';
import type { NexoClient } from '../../types/index.js';
import type { JoinToCreateChannelOptions } from '../../utils/database.js';

async function readState(client: NexoClient, guild: Guild): Promise<JoinToCreateState> {
  const config = await getConfiguration(client, guild.id);
  return {
    triggers: config.triggerChannels.map((channelId) => {
      const options: Partial<JoinToCreateChannelOptions> = config.channelOptions?.[channelId] ?? {};
      const found = guild.channels.cache.get(channelId);
      return {
        channelId,
        exists: Boolean(found),
        categoryId: found?.parentId ?? null,
        nameTemplate: options.nameTemplate || config.channelNameTemplate || 'Raum von {username}',
        userLimit: options.userLimit ?? config.userLimit ?? 0,
        bitrateKbps: Math.round((options.bitrate ?? config.bitrate ?? 64000) / 1000),
      };
    }),
    activeChannels: Object.keys(config.temporaryChannels ?? {}).length,
  };
}

/** Same rules as the command/service validators; template errors keep the service's German text. */
async function parseSettings(raw: Record<string, unknown>): Promise<JoinToCreateTriggerSettings> {
  const nameTemplate = str(raw.nameTemplate, 'Namensvorlage', { min: 1, max: 100 });
  await validateChannelNameTemplate(nameTemplate);
  return {
    nameTemplate,
    userLimit: int(raw.userLimit, 'Nutzerlimit', 0, 99),
    bitrateKbps: int(raw.bitrateKbps, 'Bitrate (kbps)', 8, 384),
  };
}

function requireManageChannels(guild: Guild) {
  requireBotPermissions(guild, [PermissionFlagsBits.ManageChannels]);
}

export const jointocreateModule: DashboardModule = {
  id: 'jointocreate',
  router: (client) => {
    const router = express.Router();

    router.get('/', async (_req, res) => {
      res.json(await readState(client, locals(res).guild));
    });

    router.post('/', async (req, res) => {
      const { guild, member } = locals(res);
      const input = body(req.body);
      const settings = await parseSettings(input);
      const categoryId = channel(guild, input.categoryId, 'Kategorie', 'category');
      requireManageChannels(guild);
      await createJoinToCreateTrigger(client, guild, member.id, {
        categoryId, nameTemplate: settings.nameTemplate, userLimit: settings.userLimit, bitrate: settings.bitrateKbps,
      });
      res.json(await readState(client, guild));
    });

    router.put('/:channelId', async (req, res) => {
      const { guild, member } = locals(res);
      const settings = await parseSettings(body(req.body));
      const { channelId } = req.params;
      await updateChannelConfig(client, guild.id, channelId, {
        nameTemplate: settings.nameTemplate, userLimit: settings.userLimit, bitrate: settings.bitrateKbps * 1000,
      });
      await logConfigurationChange(client, guild.id, member.id, 'Join-to-Create über das Dashboard aktualisiert', { channelId, ...settings });
      res.json(await readState(client, guild));
    });

    router.post('/:channelId/delete', async (req, res) => {
      const { guild, member } = locals(res);
      const { channelId } = req.params;
      const state = await readState(client, guild);
      if (!state.triggers.some((trigger) => trigger.channelId === channelId)) throw new HttpError(404, 'Dieser Kanal ist kein Join-to-Create-Kanal.');
      if (guild.channels.cache.has(channelId)) requireManageChannels(guild);
      await removeJoinToCreateTrigger(client, guild, channelId, member.id);
      res.json(await readState(client, guild));
    });

    return router;
  },
};
