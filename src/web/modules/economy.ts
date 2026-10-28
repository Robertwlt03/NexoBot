// Economy: premium shop role (same as /economy shop-config setrole), per-server leaderboard (same as /eco eleaderboard)
// and add/remove money (same as /economy dashboard). The currency itself is global and read-only here.

import express from 'express';
import type { Guild, GuildMember } from 'discord.js';
import type { DashboardModule } from './index.js';
import {
  ECONOMY_MAX_AMOUNT, ECONOMY_PAGE_SIZE,
  type EconomyAccount, type EconomyLeaderboard, type EconomyMember, type EconomySettings,
} from '../dto/economy.js';
import { locals } from '../dashboard.js';
import { badRequest, body, int, role } from '../http.js';
import { addMoney, getEconomyData, getEconomyLeaderboard, getMaxBankCapacity, removeMoney } from '../../utils/economy.js';
import { getGuildConfig, updateGuildConfig } from '../../services/config/guildConfig.js';
import { BotConfig } from '../../config/bot.js';
import { logger } from '../../utils/logger.js';
import type { NexoClient } from '../../types/index.js';
import { fetchMember } from '../moduleSupport.js';

async function readSettings(client: NexoClient, guildId: string): Promise<EconomySettings> {
  const config = await getGuildConfig(client, guildId);
  return {
    premiumRoleId: typeof config.premiumRoleId === 'string' && config.premiumRoleId ? config.premiumRoleId : null,
    currency: { name: BotConfig.economy.currency.name, symbol: BotConfig.economy.currency.symbol },
  };
}

async function resolveAccount(client: NexoClient, guild: Guild, userId: string, wallet: number, bank: number): Promise<EconomyAccount> {
  const member = guild.members.cache.get(userId);
  const user = member?.user ?? await client.users.fetch(userId).catch(() => null);
  return {
    userId,
    name: member?.displayName ?? user?.username ?? userId,
    avatarUrl: (member ?? user)?.displayAvatarURL({ size: 64 }) ?? null,
    wallet,
    bank,
    netWorth: wallet + bank,
  };
}

/** Same checks as the add/remove modals in /economy dashboard. */
async function fetchAccountMember(guild: Guild, value: unknown): Promise<GuildMember> {
  const member = await fetchMember(guild, value);
  if (member.user.bot) throw badRequest('Bots haben kein Wirtschaftskonto.');
  return member;
}

async function readMember(client: NexoClient, guild: Guild, member: GuildMember): Promise<EconomyMember> {
  const data = await getEconomyData(client, guild.id, member.id);
  const account = await resolveAccount(client, guild, member.id, data.wallet || 0, data.bank || 0);
  return { ...account, maxBank: getMaxBankCapacity(data) };
}

export const economyModule: DashboardModule = {
  id: 'economy',
  router: (client) => {
    const router = express.Router();

    router.get('/', async (_req, res) => {
      res.json(await readSettings(client, locals(res).guild.id));
    });

    router.put('/', async (req, res) => {
      const { guild } = locals(res);
      const input = body(req.body);
      const premiumRoleId = role(guild, input.premiumRoleId, 'Premium-Rolle', { assignable: true });
      await updateGuildConfig(client, guild.id, { premiumRoleId });
      res.json(await readSettings(client, guild.id));
    });

    router.get('/leaderboard', async (req, res) => {
      const { guild } = locals(res);
      const all = await getEconomyLeaderboard(client, guild.id);
      const pages = Math.max(1, Math.ceil(all.length / ECONOMY_PAGE_SIZE));
      const page = Math.min(Math.max(1, Math.floor(Number(req.query.page)) || 1), pages);
      const start = (page - 1) * ECONOMY_PAGE_SIZE;
      const entries = await Promise.all(all.slice(start, start + ECONOMY_PAGE_SIZE).map(async (entry, index) => ({
        ...await resolveAccount(client, guild, entry.userId, entry.wallet, entry.bank),
        rank: start + index + 1,
      })));
      const result: EconomyLeaderboard = {
        entries,
        page,
        pages,
        total: all.length,
        totalInCirculation: all.reduce((sum, entry) => sum + entry.net_worth, 0),
      };
      res.json(result);
    });

    router.get('/members/:userId', async (req, res) => {
      const { guild } = locals(res);
      res.json(await readMember(client, guild, await fetchAccountMember(guild, req.params.userId)));
    });

    router.post('/members/:userId', async (req, res) => {
      const { guild, member: admin } = locals(res);
      const input = body(req.body);
      const member = await fetchAccountMember(guild, req.params.userId);
      const amount = int(input.amount, 'Betrag', 1, ECONOMY_MAX_AMOUNT);
      if (input.type !== 'wallet' && input.type !== 'bank') throw badRequest('Der Typ muss entweder „wallet“ oder „bank“ sein.');
      if (input.action === 'add') {
        await addMoney(client, guild.id, member.id, amount, input.type);
      } else if (input.action === 'remove') {
        await removeMoney(client, guild.id, member.id, amount, input.type);
      } else {
        throw badRequest('Unbekannte Aktion.');
      }
      logger.info(`[ECONOMY_WEB] Currency ${input.action === 'add' ? 'added' : 'removed'}`, {
        adminId: admin.id, targetUserId: member.id, amount, type: input.type,
      });
      res.json(await readMember(client, guild, member));
    });

    return router;
  },
};
