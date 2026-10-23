// Member area "Mein Profil" (/dashboard/api/me/...): any logged-in Discord user, no guild permission needed.
// Bernis and cosmetics are global per user. Contract: web/dto/profile.ts.

import express from 'express';
import type { Router } from 'express';
import type { NexoClient } from '../../types/index.js';
import type { CosmeticItem } from '../../shared/cosmetics.js';
import type {
  AchievementsResponse, CommunityResponse, DailyClaimResult, MeProfileResponse, ProfileLevel, QuestsResponse,
} from '../dto/profile.js';
import { locals, sendError } from '../dashboard.js';
import { HttpError, badRequest, body } from '../http.js';
import { isBotOwner } from '../../config/bot.js';
import { getXpForLevel } from '../../services/leveling/leveling.js';
import { NO_DB_MESSAGE, T, cosmeticsPool, isSnowflake, requirePool } from '../../services/cosmetics/db.js';
import { loadCatalog } from '../../services/cosmetics/catalog.js';
import { parseProfileSettings, readDashboardTheme, readProfileSettings, writeDashboardTheme, writeProfileSettings } from '../../services/cosmetics/profile.js';
import { buyStreakShield, claimDaily, getDailyState, listTransactions, walletSummary } from '../../services/cosmetics/wallet.js';
import { blackMarketResponse, gift, ownedItems, purchase, purchaseBundle, shopResponse } from '../../services/cosmetics/shop.js';
import { listAchievements, syncAchievements } from '../../services/cosmetics/achievements.js';
import { userRankings } from '../../services/cosmetics/rankings.js';
import { getDailyQuests } from '../../services/cosmetics/quests.js';
import { readReminders, writeReminders } from '../../services/cosmetics/reminders.js';
import { communityGoals } from '../../services/cosmetics/community.js';
import { readShareProfile, writeShareProfile } from '../publicProfile.js';
import { isLinked, pushRoleConnection, roleValues, unlink } from '../../services/cosmetics/linkedRoles.js';
import { linkedRolesConfig } from '../dashboard.js';
import { addSeasonPoints, getSeason } from '../../services/cosmetics/season.js';
import { SEASON_POINTS } from '../../shared/season.js';
import { petStage } from '../../shared/pets.js';
import { pendingCommunity, pendingQuestCounts } from '../../services/cosmetics/activity.js';

async function levels(client: NexoClient, userId: string): Promise<ProfileLevel[]> {
  const result = await requirePool().query<{ guild_id: string; level: number; xp: string; rank: string }>(
    `SELECT u.guild_id, u.level, u.xp,
       (SELECT COUNT(*) + 1 FROM ${T.user_levels} o WHERE o.guild_id = u.guild_id AND o.total_xp > u.total_xp) AS rank
     FROM ${T.user_levels} u WHERE u.user_id = $1 ORDER BY u.level DESC, u.total_xp DESC LIMIT 50`,
    [userId],
  );
  return result.rows.flatMap((row) => {
    const guild = client.guilds.cache.get(row.guild_id);
    if (!guild) return [];
    return [{ guildId: guild.id, guildName: guild.name, level: row.level, xp: Number(row.xp), xpNeeded: getXpForLevel(row.level), rank: Number(row.rank) }];
  });
}

async function profileResponse(client: NexoClient, userId: string): Promise<MeProfileResponse> {
  const [wallet, profile, inventory, levelList, daily, quests, reminders, chatDays, shareProfile, linkedRole] = await Promise.all([
    walletSummary(userId), readProfileSettings(userId), ownedItems(userId), levels(client, userId), getDailyState(userId),
    getDailyQuests(userId, pendingQuestCounts(userId)), readReminders(userId),
    requirePool().query<{ value: string }>(`SELECT value FROM ${T.user_stats} WHERE user_id = $1 AND stat = 'chat_days'`, [userId]).then((r) => Number(r.rows[0]?.value ?? 0)),
    readShareProfile(userId),
    linkedRoleState(userId),
  ]);
  return { isOwner: isBotOwner(userId), wallet, profile, inventory, levels: levelList, daily, quests, reminders, petStage: petStage(chatDays), chatDays, shareProfile, linkedRole };
}

async function linkedRoleState(userId: string) {
  const [linked, values] = await Promise.all([isLinked(userId), roleValues(userId)]);
  return { linked, values };
}

export function meRouter(client: NexoClient): Router {
  const router = express.Router();

  router.use((_req, res, next) => (cosmeticsPool() ? next() : sendError(res, 503, NO_DB_MESSAGE)));

  router.get('/profile', async (_req, res) => {
    res.json(await profileResponse(client, locals(res).session.userId));
  });

  router.put('/profile', async (req, res) => {
    const { userId } = locals(res).session;
    const [catalog, owned] = await Promise.all([loadCatalog(), ownedItems(userId)]);
    const settings = parseProfileSettings(req.body, catalog, new Set(owned.map((entry) => entry.itemId)));
    await writeProfileSettings(userId, settings);
    res.json(await profileResponse(client, userId));
  });

  // Personal dashboard colours (body: DashboardTheme from shared/theme.ts).
  router.get('/theme', async (_req, res) => {
    res.json(await readDashboardTheme(locals(res).session.userId));
  });
  router.put('/theme', async (req, res) => {
    res.json(await writeDashboardTheme(locals(res).session.userId, req.body));
  });

  router.post('/daily', async (_req, res) => {
    const { userId } = locals(res).session;
    const { claimed } = await claimDaily(userId);
    await addSeasonPoints(userId, SEASON_POINTS.daily);
    await syncAchievements(userId);
    const result: DailyClaimResult = { claimed, wallet: await walletSummary(userId), daily: await getDailyState(userId) };
    res.json(result);
  });

  router.post('/daily/shield', async (_req, res) => {
    const { userId } = locals(res).session;
    await buyStreakShield(userId);
    res.json({ wallet: await walletSummary(userId), daily: await getDailyState(userId) });
  });

  // Shared goals of the running events on the member's servers (servers where they have XP and Nexo is present).
  router.get('/community', async (_req, res) => {
    const { userId } = locals(res).session;
    const rows = await requirePool().query<{ guild_id: string }>(`SELECT guild_id FROM ${T.user_levels} WHERE user_id = $1`, [userId]);
    const guilds = rows.rows.flatMap((row) => {
      const guild = client.guilds.cache.get(row.guild_id);
      return guild ? [{ id: guild.id, name: guild.name, iconUrl: guild.iconURL({ size: 64 }) }] : [];
    });
    const result: CommunityResponse = { goals: await communityGoals(userId, guilds, pendingCommunity(userId)) };
    res.json(result);
  });

  router.get('/season', async (_req, res) => {
    res.json(await getSeason(locals(res).session.userId));
  });

  // Linked Roles: push the current values now, or remove the connection.
  router.post('/linked-role/sync', async (_req, res) => {
    const { userId } = locals(res).session;
    const config = linkedRolesConfig();
    if (!config) throw new HttpError(503, 'Linked Roles sind auf diesem Bot nicht eingerichtet.');
    if (await pushRoleConnection(config, userId, true) === 'unlinked') throw new HttpError(409, 'Die Verknüpfung besteht nicht mehr – verbinde Nexo in Discord neu.');
    res.json({ linkedRole: await linkedRoleState(userId) });
  });
  router.delete('/linked-role', async (_req, res) => {
    const { userId } = locals(res).session;
    const config = linkedRolesConfig();
    if (config) await unlink(config, userId);
    res.json({ linkedRole: await linkedRoleState(userId) });
  });

  router.put('/share', async (req, res) => {
    const { enabled } = body(req.body);
    if (typeof enabled !== 'boolean') throw badRequest('enabled: true oder false erwartet.');
    res.json({ enabled: await writeShareProfile(locals(res).session.userId, enabled) });
  });

  router.put('/reminders', async (req, res) => {
    const { enabled } = body(req.body);
    if (typeof enabled !== 'boolean') throw badRequest('enabled: true oder false erwartet.');
    res.json({ enabled: await writeReminders(locals(res).session.userId, enabled) });
  });

  // Polled by the dashboard while the profile page is open: quest progress and the wallet (quests pay on their own).
  router.get('/quests', async (_req, res) => {
    const { userId } = locals(res).session;
    const result: QuestsResponse = { quests: await getDailyQuests(userId, pendingQuestCounts(userId)), wallet: await walletSummary(userId) };
    res.json(result);
  });

  router.get('/shop', async (_req, res) => {
    res.json(await shopResponse(locals(res).session.userId));
  });

  router.get('/blackmarket', async (_req, res) => {
    res.json(await blackMarketResponse(locals(res).session.userId));
  });

  /** Catalog data for owned and listed items (inventory view): every active item plus inactive owned ones. */
  router.get('/items', async (_req, res) => {
    const { userId } = locals(res).session;
    const [catalog, owned] = await Promise.all([loadCatalog(), ownedItems(userId)]);
    const ownedIds = new Set(owned.map((entry) => entry.itemId));
    const items: CosmeticItem[] = [...catalog.values()].filter((entry) => entry.active || ownedIds.has(entry.id));
    res.json(items);
  });

  router.post('/shop/buy', async (req, res) => {
    res.json(await purchase(locals(res).session.userId, body(req.body).itemId));
  });

  router.post('/shop/buy-bundle', async (req, res) => {
    res.json(await purchaseBundle(locals(res).session.userId, body(req.body).bundleId));
  });

  router.post('/shop/gift', async (req, res) => {
    const { session } = locals(res);
    const input = body(req.body);
    if (!isSnowflake(input.toUserId)) throw badRequest('Bitte gib eine gültige Nutzer-ID ein.');
    const recipient = await client.users.fetch(input.toUserId).catch(() => null);
    if (!recipient) throw new HttpError(404, 'Diesen Discord-Nutzer gibt es nicht.');
    if (recipient.bot) throw badRequest('Bots können keine Geschenke bekommen.');
    res.json(await gift(session.userId, {
      itemId: input.itemId, toUserId: recipient.id, toName: recipient.displayName,
      fromName: session.globalName ?? session.username, message: input.message,
    }));
  });

  router.get('/transactions', async (req, res) => {
    const raw = typeof req.query.page === 'string' ? Number(req.query.page) : 1;
    const page = Number.isInteger(raw) && raw >= 1 && raw <= 10_000 ? raw : 1;
    res.json(await listTransactions(locals(res).session.userId, page, (guildId) => client.guilds.cache.get(guildId)?.name ?? null));
  });

  router.get('/rankings', async (_req, res) => {
    const { session } = locals(res);
    res.json(await userRankings(client, session.userId, session.guilds.map((guild) => guild.id)));
  });

  router.get('/achievements', async (_req, res) => {
    const result: AchievementsResponse = { achievements: await listAchievements(locals(res).session.userId) };
    res.json(result);
  });

  return router;
}
