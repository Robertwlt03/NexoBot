// Giveaways: list, start, end, reroll and delete (same logic as /giveaway via the giveaway service).

import express from 'express';
import { PermissionFlagsBits } from 'discord.js';
import type { Guild } from 'discord.js';
import type { DashboardModule } from './index.js';
import type { GiveawayItem, GiveawayList } from '../dto/giveaways.js';
import { GIVEAWAY_PAGE_SIZE } from '../dto/giveaways.js';
import { locals } from '../dashboard.js';
import { HttpError, badRequest, body, channel, str } from '../http.js';
import { requireBotPermissions, resolveNames } from '../moduleSupport.js';
import {
  GIVEAWAY_LIMITS, endGiveaway, endTimeOf, getGiveaway, getGuildGiveaways, isEnded, removeGiveaway, rerollGiveaway, startGiveaway, type Giveaway,
} from '../../services/giveaways/giveaways.js';
import type { NexoClient } from '../../types/index.js';

async function findGiveaway(client: NexoClient, guildId: string, messageId: string): Promise<Giveaway> {
  if (!/^\d+$/.test(messageId)) throw badRequest('Ungültige Giveaway-ID.');
  const giveaway = await getGiveaway(client, guildId, messageId);
  if (!giveaway) throw new HttpError(404, 'Dieses Giveaway gibt es nicht mehr.');
  return giveaway;
}

/** Nexo must be able to post in the giveaway channel before end/reroll touch Discord. */
function requireChannelAccess(guild: Guild, giveaway: Giveaway) {
  const giveawayChannel = giveaway.channelId ? guild.channels.cache.get(giveaway.channelId) : undefined;
  if (giveawayChannel) {
    requireBotPermissions(guild, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory], giveawayChannel);
  }
}

async function listGiveaways(client: NexoClient, guild: Guild, status: 'active' | 'ended', page: number): Promise<GiveawayList> {
  const all = await getGuildGiveaways(client, guild.id);
  const filtered = all
    .filter((giveaway) => isEnded(giveaway) === (status === 'ended'))
    .sort((a, b) => status === 'active' ? (endTimeOf(a) ?? 0) - (endTimeOf(b) ?? 0) : (endTimeOf(b) ?? 0) - (endTimeOf(a) ?? 0));
  const pageItems = filtered.slice((page - 1) * GIVEAWAY_PAGE_SIZE, page * GIVEAWAY_PAGE_SIZE);
  const names = await resolveNames(client, guild, pageItems.flatMap((g) => [g.hostId ?? '', ...(g.winnerIds ?? [])]).filter(Boolean));
  const user = (id: string) => ({ id, name: names[id] ?? id });

  const items: GiveawayItem[] = pageItems.map((giveaway) => ({
    messageId: giveaway.messageId,
    channelId: giveaway.channelId ?? null,
    prize: giveaway.prize ?? 'Unbekannter Preis',
    host: giveaway.hostId ? user(giveaway.hostId) : null,
    endsAt: endTimeOf(giveaway),
    winnerCount: giveaway.winnerCount ?? 1,
    entries: giveaway.participants?.length ?? 0,
    ended: isEnded(giveaway),
    winners: (giveaway.winnerIds ?? []).map(user),
    messageUrl: giveaway.channelId ? `https://discord.com/channels/${guild.id}/${giveaway.channelId}/${giveaway.messageId}` : null,
  }));
  const activeCount = all.filter((giveaway) => !isEnded(giveaway)).length;
  return {
    items,
    total: filtered.length,
    page,
    pageSize: GIVEAWAY_PAGE_SIZE,
    activeCount,
    endedCount: all.length - activeCount,
    minWinners: GIVEAWAY_LIMITS.minimumWinners,
    maxWinners: GIVEAWAY_LIMITS.maximumWinners,
  };
}

export const giveawaysModule: DashboardModule = {
  id: 'giveaways',
  router: (client) => {
    const router = express.Router();

    router.get('/', async (req, res) => {
      const status = req.query.status === 'ended' ? 'ended' : 'active';
      const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
      res.json(await listGiveaways(client, locals(res).guild, status, page));
    });

    router.post('/', async (req, res) => {
      const { guild, member } = locals(res);
      const input = body(req.body);
      const channelId = channel(guild, input.channelId, 'Kanal');
      if (!channelId) throw badRequest('Bitte wähle einen Kanal aus.');
      const prize = str(input.prize, 'Preis', { min: 1, max: 256 });
      const duration = str(input.duration, 'Dauer', { min: 1, max: 10 });
      if (typeof input.winnerCount !== 'number') throw badRequest('Gewinner: Zahl erwartet.');
      const winnerCount = input.winnerCount;

      const target = guild.channels.cache.get(channelId)!;
      requireBotPermissions(guild, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks], target);
      const giveaway = await startGiveaway(client, guild.id, target, { duration, winnerCount, prize, hostId: member.id });
      res.json({ messageId: giveaway.messageId });
    });

    router.post('/:messageId/end', async (req, res) => {
      const { guild, member } = locals(res);
      const giveaway = await findGiveaway(client, guild.id, req.params.messageId);
      requireChannelAccess(guild, giveaway);
      const { giveaway: ended } = await endGiveaway(client, guild.id, giveaway.messageId, member.id);
      res.json({ winners: ended.winnerIds?.length ?? 0, entries: ended.participants?.length ?? 0 });
    });

    router.post('/:messageId/reroll', async (req, res) => {
      const { guild, member } = locals(res);
      const giveaway = await findGiveaway(client, guild.id, req.params.messageId);
      requireChannelAccess(guild, giveaway);
      const result = await rerollGiveaway(client, guild.id, giveaway.messageId, member.id);
      res.json({ winners: result.giveaway.winnerIds?.length ?? 0, announced: result.channel !== null });
    });

    router.post('/:messageId/delete', async (req, res) => {
      const { guild, member } = locals(res);
      const giveaway = await findGiveaway(client, guild.id, req.params.messageId);
      const result = await removeGiveaway(client, guild.id, giveaway, member.id);
      res.json({ messageDeleted: result.deletedMessage });
    });

    return router;
  },
};
