// Server stats: counter channels for members/bots (same storage/logic as /serverstats).

import express from 'express';
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import type { Guild } from 'discord.js';
import type { Response } from 'express';
import type { DashboardModule } from './index.js';
import type { CounterType, ServerStatsState } from '../dto/serverstats.js';
import { COUNTER_TYPES } from '../dto/serverstats.js';
import { locals } from '../dashboard.js';
import { HttpError, badRequest, body, channel } from '../http.js';
import { requireBotPermissions } from '../moduleSupport.js';
import {
  changeServerCounterType, createServerCounter, getServerCounters, performDeletionByCounterId,
} from '../../services/serverstats/serverstats.js';
import type { NexoClient } from '../../types/index.js';

async function readState(client: NexoClient, guild: Guild): Promise<ServerStatsState> {
  const counters = await getServerCounters(client, guild.id);
  return {
    counters: counters.map((counter) => {
      const found = guild.channels.cache.get(counter.channelId);
      return {
        id: counter.id,
        type: counter.type,
        channelId: counter.channelId,
        channelName: found?.name ?? null,
        voice: found?.type === ChannelType.GuildVoice,
        createdAt: counter.createdAt,
      };
    }),
  };
}

function counterType(value: unknown): CounterType {
  const found = COUNTER_TYPES.find((type) => type.value === value);
  if (!found) throw badRequest('Typ: Bitte wähle einen gültigen Zählertyp.');
  return found.value;
}

/** Like the command: the member needs „Kanäle verwalten“, Nexo too. */
function requireManageChannels(res: Response) {
  const { guild, member } = locals(res);
  if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    throw new HttpError(403, 'Du brauchst die Berechtigung „Kanäle verwalten“, um Zähler zu verwalten.');
  }
  requireBotPermissions(guild, [PermissionFlagsBits.ManageChannels]);
}

export const serverstatsModule: DashboardModule = {
  id: 'serverstats',
  router: (client) => {
    const router = express.Router();

    router.get('/', async (_req, res) => {
      res.json(await readState(client, locals(res).guild));
    });

    router.post('/', async (req, res) => {
      const { guild, member } = locals(res);
      const input = body(req.body);
      const type = counterType(input.type);
      if (input.channelType !== 'voice' && input.channelType !== 'text') throw badRequest('Kanaltyp: Sprach- oder Textkanal erwartet.');
      const categoryId = channel(guild, input.categoryId, 'Kategorie', 'category');
      if (!categoryId) throw badRequest('Bitte wähle eine gültige Kategorie für den Zählerkanal.');
      requireManageChannels(res);
      const result = await createServerCounter(client, guild, {
        type, channelType: input.channelType as string, categoryId, createdBy: member.user.tag,
      });
      res.json({ ...(await readState(client, guild)), nameUpdated: result.nameUpdated });
    });

    router.put('/:counterId', async (req, res) => {
      const { guild } = locals(res);
      const type = counterType(body(req.body).type);
      requireManageChannels(res);
      const result = await changeServerCounterType(client, guild, req.params.counterId, type);
      res.json({ ...(await readState(client, guild)), nameUpdated: result.nameUpdated });
    });

    router.post('/:counterId/delete', async (req, res) => {
      const { guild } = locals(res);
      requireManageChannels(res);
      const result = await performDeletionByCounterId(client, guild, req.params.counterId);
      res.json({ ...(await readState(client, guild)), channelDeleted: result.channelDeleted });
    });

    return router;
  },
};
