// Counting game: status, setup, disable, reset and leaderboard (same service functions as /count).

import express from 'express';
import { ChannelType } from 'discord.js';
import type { Guild } from 'discord.js';
import type { DashboardModule } from './index.js';
import { COUNTING_LEADERBOARD_LIMIT, COUNTING_MAX_START, type CountingStatus } from '../dto/counting.js';
import { locals } from '../dashboard.js';
import { badRequest, body, int } from '../http.js';
import {
  activateCountingGame, disableCountingGame, getCountingGameConfig, getCountingSystemChoices, getCountingSystemLabel,
  getExpectedCountValue, resetCountingGame,
} from '../../services/countingGameService.js';
import { botHasPermission } from '../../utils/permissionGuard.js';
import type { NexoClient } from '../../types/index.js';

async function userInfo(client: NexoClient, guild: Guild, userId: string) {
  const member = guild.members.cache.get(userId);
  const user = member?.user ?? await client.users.fetch(userId).catch(() => null);
  return {
    name: member?.displayName ?? user?.username ?? userId,
    avatarUrl: (member ?? user)?.displayAvatarURL({ size: 64 }) ?? null,
  };
}

async function readStatus(client: NexoClient, guild: Guild): Promise<CountingStatus> {
  const config = await getCountingGameConfig(client, guild.id);
  const ranked = Object.entries(config.leaderboard).sort((a, b) => b[1] - a[1]);
  const [leaderboard, lastUser] = await Promise.all([
    Promise.all(ranked.slice(0, COUNTING_LEADERBOARD_LIMIT).map(async ([userId, count], index) => ({
      rank: index + 1, userId, count, ...await userInfo(client, guild, userId),
    }))),
    config.lastUserId ? userInfo(client, guild, config.lastUserId) : null,
  ]);
  return {
    enabled: config.enabled,
    channelId: config.channelId,
    system: config.system,
    systemLabel: getCountingSystemLabel(config.system),
    nextNumber: config.nextNumber,
    expected: getExpectedCountValue(config),
    currentStreak: config.currentStreak,
    bestStreak: config.bestStreak || 0,
    lastUserId: config.lastUserId,
    lastUserName: lastUser?.name ?? null,
    systems: getCountingSystemChoices().map((choice) => ({ value: choice.value, label: choice.name })),
    leaderboard,
    players: ranked.length,
  };
}

export const countingModule: DashboardModule = {
  id: 'counting',
  router: (client) => {
    const router = express.Router();

    router.get('/', async (_req, res) => {
      const { guild } = locals(res);
      res.json(await readStatus(client, guild));
    });

    router.post('/actions/activate', async (req, res) => {
      const { guild } = locals(res);
      const input = body(req.body);
      const target = typeof input.channelId === 'string' ? guild.channels.cache.get(input.channelId) : undefined;
      if (!target || target.type !== ChannelType.GuildText) throw badRequest('Bitte wähle einen Textkanal für das Zählspiel.');
      const system = typeof input.system === 'string' ? input.system : '';
      if (!getCountingSystemChoices().some((choice) => choice.value === system)) throw badRequest('Bitte wähle ein gültiges Zahlensystem.');
      if (!botHasPermission(target, ['ViewChannel', 'SendMessages', 'ManageMessages', 'ReadMessageHistory'])) {
        throw badRequest(`Nexo braucht in #${target.name} die Berechtigungen „Nachrichten senden“, „Nachrichten verwalten“ und „Nachrichtenverlauf lesen“.`);
      }
      const config = await getCountingGameConfig(client, guild.id);
      if (config.enabled && config.channelId && config.channelId !== target.id) {
        throw badRequest(`Auf diesem Server ist bereits ein Zählkanal aktiv (#${guild.channels.cache.get(config.channelId)?.name ?? config.channelId}). Deaktiviere zuerst das aktuelle Zählspiel oder nutze diesen Kanal.`);
      }
      await activateCountingGame(client, guild.id, target.id, system);
      res.json(await readStatus(client, guild));
    });

    router.post('/actions/disable', async (_req, res) => {
      const { guild } = locals(res);
      const config = await getCountingGameConfig(client, guild.id);
      if (!config.enabled) throw badRequest('Das Zählspiel ist auf diesem Server bereits deaktiviert.');
      await disableCountingGame(client, guild.id);
      res.json(await readStatus(client, guild));
    });

    router.post('/actions/reset', async (req, res) => {
      const { guild } = locals(res);
      const start = int(body(req.body).start, 'Startzahl', 1, COUNTING_MAX_START);
      const config = await getCountingGameConfig(client, guild.id);
      if (!config.enabled) throw badRequest('Aktiviere das Zählspiel zuerst.');
      await resetCountingGame(client, guild.id, start);
      res.json(await readStatus(client, guild));
    });

    return router;
  },
};
