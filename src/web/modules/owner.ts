// Owner area (/dashboard/api/owner/...): only OWNER_IDS. Controls the Bernis economy: items, prices, events,
// black market, tunables and support grants. Contract: web/dto/profile.ts.

import express from 'express';
import type { Router } from 'express';
import type { NexoClient } from '../../types/index.js';
import { COSMETIC_SLOTS, RARITIES, type CosmeticSlot, type Rarity } from '../../shared/cosmetics.js';
import type { OwnerOverview, OwnerStats } from '../dto/profile.js';
import { locals, sendError } from '../dashboard.js';
import { badRequest, body, int, optionalStr } from '../http.js';
import { isBotOwner } from '../../config/bot.js';
import { NO_DB_MESSAGE, T, cosmeticsPool, requirePool } from '../../services/cosmetics/db.js';
import { isSnowflake } from '../../utils/validation.js';
import { createItem, deactivateItem, loadCatalog, updateItem } from '../../services/cosmetics/catalog.js';
import { getEconomyConfig, saveEconomyConfig } from '../../services/cosmetics/config.js';
import { createCustomEvent, deleteEvent, loadStoredEvents, ownerEventList, updateEvent } from '../../services/cosmetics/events.js';
import { blackMarketResponse, pinBlackMarket, rerollBlackMarket } from '../../services/cosmetics/shop.js';
import { earn, walletSummary } from '../../services/cosmetics/wallet.js';
import { berlinDay, berlinTime } from '../../services/cosmetics/time.js';

async function ownerStats(client: NexoClient): Promise<OwnerStats> {
  const pool = requirePool();
  const [y, m, d] = berlinDay().split('-').map(Number);
  const [totals, today, holders, sold, catalog] = await Promise.all([
    pool.query<{ supply: string; wallets: string }>(`SELECT COALESCE(SUM(balance), 0) AS supply, COUNT(*) AS wallets FROM ${T.user_wallets}`),
    pool.query<{ earned: string; spent: string }>(
      `SELECT COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0) AS earned, COALESCE(-SUM(amount) FILTER (WHERE amount < 0), 0) AS spent
       FROM ${T.wallet_transactions} WHERE created_at >= $1`,
      [berlinTime(y, m, d)],
    ),
    pool.query<{ user_id: string; balance: string }>(`SELECT user_id, balance FROM ${T.user_wallets} WHERE balance > 0 ORDER BY balance DESC LIMIT 10`),
    pool.query<{ item_id: string; sold: string }>(
      `SELECT item_id, COUNT(*) AS sold FROM ${T.user_inventory} WHERE source IN ('purchase', 'gift', 'event')
       GROUP BY item_id ORDER BY sold DESC, item_id LIMIT 10`,
    ),
    loadCatalog(),
  ]);
  const topHolders = await Promise.all(holders.rows.map(async (row) => {
    const user = client.users.cache.get(row.user_id) ?? await client.users.fetch(row.user_id).catch(() => null);
    return { userId: row.user_id, name: user?.displayName ?? row.user_id, balance: Number(row.balance) };
  }));
  return {
    supply: Number(totals.rows[0].supply),
    wallets: Number(totals.rows[0].wallets),
    earnedToday: Number(today.rows[0].earned),
    spentToday: Number(today.rows[0].spent),
    topHolders,
    bestsellers: sold.rows.map((row) => ({ itemId: row.item_id, name: catalog.get(row.item_id)?.name ?? row.item_id, sold: Number(row.sold) })),
  };
}

export function ownerRouter(client: NexoClient): Router {
  const router = express.Router();

  router.use((_req, res, next) => {
    if (!isBotOwner(locals(res).session.userId)) return sendError(res, 403, 'Dieser Bereich ist nur für den Bot-Owner.');
    return cosmeticsPool() ? next() : sendError(res, 503, NO_DB_MESSAGE);
  });

  router.get('/overview', async (_req, res) => {
    const [stats, stored, blackMarket, config] = await Promise.all([ownerStats(client), loadStoredEvents(), blackMarketResponse(null), getEconomyConfig()]);
    const overview: OwnerOverview = { stats, events: ownerEventList(new Date(), stored), blackMarket, config };
    res.json(overview);
  });

  // ---------- Config ----------
  router.get('/config', async (_req, res) => {
    res.json(await getEconomyConfig());
  });
  router.put('/config', async (req, res) => {
    res.json(await saveEconomyConfig(req.body));
  });

  // ---------- Items ----------
  router.get('/items', async (req, res) => {
    const slot = typeof req.query.slot === 'string' && req.query.slot ? req.query.slot : null;
    const rarity = typeof req.query.rarity === 'string' && req.query.rarity ? req.query.rarity : null;
    if (slot && !COSMETIC_SLOTS.includes(slot as CosmeticSlot)) throw badRequest('Unbekannter Slot.');
    if (rarity && !RARITIES.includes(rarity as Rarity)) throw badRequest('Unbekannte Seltenheit.');
    const items = [...(await loadCatalog()).values()].filter((entry) => (!slot || entry.slot === slot) && (!rarity || entry.rarity === rarity));
    res.json(items);
  });
  router.post('/items', async (req, res) => {
    res.status(201).json(await createItem(req.body));
  });
  router.put('/items/:id', async (req, res) => {
    res.json(await updateItem(req.params.id, req.body));
  });
  router.delete('/items/:id', async (req, res) => {
    await deactivateItem(req.params.id);
    res.json({ ok: true });
  });

  // ---------- Events ----------
  router.get('/events', async (_req, res) => {
    res.json(ownerEventList(new Date(), await loadStoredEvents()));
  });
  router.post('/events', async (req, res) => {
    res.status(201).json(await createCustomEvent(req.body));
  });
  router.put('/events/:id', async (req, res) => {
    res.json(await updateEvent(req.params.id, req.body));
  });
  router.delete('/events/:id', async (req, res) => {
    await deleteEvent(req.params.id);
    res.json({ ok: true });
  });

  // ---------- Black market ----------
  router.post('/blackmarket/reroll', async (_req, res) => {
    await rerollBlackMarket();
    res.json(await blackMarketResponse(null));
  });
  router.put('/blackmarket', async (req, res) => {
    await pinBlackMarket(body(req.body).itemIds);
    res.json(await blackMarketResponse(null));
  });

  // ---------- Grants ----------
  router.post('/grant', async (req, res) => {
    const input = body(req.body);
    if (!isSnowflake(input.userId)) throw badRequest('Bitte gib eine gültige Nutzer-ID ein.');
    const amount = int(input.amount, 'Betrag', 1, 100_000);
    const note = optionalStr(input.note, 'Notiz', 100);
    await earn(input.userId, amount, 'owner_grant', note ? `Gutschrift vom Owner: ${note}` : 'Gutschrift vom Owner', null);
    res.json(await walletSummary(input.userId));
  });

  return router;
}
