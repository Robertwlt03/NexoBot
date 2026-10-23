// Shop, black market, purchases and gifts. Purchases lock the buyer's wallet first, so concurrent buys of one user
// run one after another; the inventory primary key keeps every item unique per user.

import { discounted } from '../../shared/coins.js';
import { randomInt } from 'node:crypto';
import { COSMETIC_SLOTS, RARITIES, type CosmeticItem } from '../../shared/cosmetics.js';
import type { BlackMarketResponse, OwnedItem, PurchaseResult, ShopBundle, ShopEvent, ShopListing, ShopResponse } from '../../web/dto/profile.js';
import { HttpError, badRequest } from '../../web/http.js';
import { BUNDLES, loadCatalog, type BundleDef } from './catalog.js';
import { getEconomyConfig } from './config.js';
import { T, requirePool, withTx, type Queryable } from './db.js';
import { eventFor, loadStoredEvents, priceFor, runningEvents, upcomingEvents } from './events.js';
import { sanitizeBio } from './profile.js';
import { weekEnd, weekStartOf } from './time.js';
import { lockWallet, noteTx, spendTx, walletSummary } from './wallet.js';
import { syncAchievements } from './achievements.js';

export async function ownedItems(userId: string, client: Queryable = requirePool()): Promise<OwnedItem[]> {
  const result = await client.query<{ item_id: string; acquired_at: Date; source: OwnedItem['source'] }>(
    `SELECT item_id, acquired_at, source FROM ${T.user_inventory} WHERE user_id = $1 ORDER BY acquired_at DESC`,
    [userId],
  );
  return result.rows.map((row) => ({ itemId: row.item_id, acquiredAt: row.acquired_at.toISOString(), source: row.source }));
}

const sortItems = (a: CosmeticItem, b: CosmeticItem) => COSMETIC_SLOTS.indexOf(a.slot) - COSMETIC_SLOTS.indexOf(b.slot)
  || RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity) || a.price - b.price || a.name.localeCompare(b.name, 'de');

// ---------- Black market ----------

/** FNV-1a string hash → mulberry32 generator. */
function seededRandom(seed: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(ids: string[], random: () => number): string[] {
  const list = [...ids];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** Exclusives (the mythic black-market-only items) per week; the rest of the market comes from the regular shop. */
export const BLACK_MARKET_EXCLUSIVES = 2;

/**
 * Night-market mix: up to BLACK_MARKET_EXCLUSIVES exclusives plus regular shop items of every rarity, in random
 * order. Falls back to more exclusives when the shop pool is too small.
 */
function mixRotation(exclusiveIds: string[], shopIds: string[], size: number, random: () => number): string[] {
  const exclusives = shuffle([...exclusiveIds].sort(), random);
  const regular = shuffle([...shopIds].sort(), random);
  const take = Math.min(exclusives.length, size >= 4 ? BLACK_MARKET_EXCLUSIVES : 1);
  const ids = [...exclusives.slice(0, take), ...regular.slice(0, size - take)];
  if (ids.length < size) ids.push(...exclusives.slice(take, take + size - ids.length));
  return shuffle(ids, random);
}

/** Deterministic weekly rotation: same week + same pools = same items. */
export function rotationFor(weekStart: string, exclusiveIds: string[], shopIds: string[], size: number): string[] {
  return mixRotation(exclusiveIds, shopIds, size, seededRandom(`nexo-black-market:${weekStart}`));
}

/** Black-market discount of one item for one week: 10–40 % in steps of 5, the same all week (no storage needed). */
export function blackMarketDiscount(weekStart: string, itemId: string): number {
  return 10 + Math.floor(seededRandom(`nexo-black-market-discount:${weekStart}:${itemId}`)() * 7) * 5;
}

/** Price on the black market: its weekly discount, or a running event's if that is better. */
export function blackMarketPrice(entry: CosmeticItem, weekStart: string, running: ShopEvent[]): { finalPrice: number; discount: number; eventId: string | null } {
  const discount = blackMarketDiscount(weekStart, entry.id);
  const own = { finalPrice: discounted(entry.price, discount), discount, eventId: null };
  const event = priceFor(entry, running);
  return event.finalPrice < own.finalPrice ? event : own;
}

const blackMarketPools = (catalog: Map<string, CosmeticItem>) => {
  const active = [...catalog.values()].filter((entry) => entry.active && entry.price > 0);
  return {
    exclusives: active.filter((entry) => entry.availability === 'blackmarket').map((entry) => entry.id),
    shop: active.filter((entry) => entry.availability === 'shop').map((entry) => entry.id),
  };
};

/** This week's rotation. Persisted on first read so later catalog edits do not reshuffle a running week. */
export async function currentRotation(catalog?: Map<string, CosmeticItem>): Promise<{ weekStart: string; itemIds: string[] }> {
  const items = catalog ?? await loadCatalog();
  const weekStart = weekStartOf();
  const pool = requirePool();
  const read = () => pool.query<{ item_ids: string[] }>(`SELECT item_ids FROM ${T.black_market_weeks} WHERE week_start = $1::date`, [weekStart]);
  let row = (await read()).rows[0];
  if (!row) {
    const pools = blackMarketPools(items);
    const ids = rotationFor(weekStart, pools.exclusives, pools.shop, (await getEconomyConfig()).blackMarketSize);
    await pool.query(
      `INSERT INTO ${T.black_market_weeks} (week_start, item_ids, pinned) VALUES ($1::date, $2::jsonb, FALSE) ON CONFLICT (week_start) DO NOTHING`,
      [weekStart, JSON.stringify(ids)],
    );
    row = (await read()).rows[0];
  }
  return { weekStart, itemIds: row.item_ids.filter((id) => items.get(id)?.active) };
}

async function writeRotation(itemIds: string[], pinned: boolean): Promise<void> {
  await requirePool().query(
    `INSERT INTO ${T.black_market_weeks} (week_start, item_ids, pinned) VALUES ($1::date, $2::jsonb, $3)
     ON CONFLICT (week_start) DO UPDATE SET item_ids = EXCLUDED.item_ids, pinned = EXCLUDED.pinned`,
    [weekStartOf(), JSON.stringify(itemIds), pinned],
  );
}

/** Owner: a fresh random rotation for the running week. */
export async function rerollBlackMarket(): Promise<void> {
  const pools = blackMarketPools(await loadCatalog());
  const ids = mixRotation(pools.exclusives, pools.shop, (await getEconomyConfig()).blackMarketSize, () => randomInt(0, 2 ** 32) / 2 ** 32);
  await writeRotation(ids, false);
}

/** Owner: pin exactly these items for the running week. */
export async function pinBlackMarket(itemIds: unknown): Promise<void> {
  if (!Array.isArray(itemIds) || itemIds.length < 1 || itemIds.length > 24) throw badRequest('Items: Liste mit 1 bis 24 IDs erwartet.');
  const catalog = await loadCatalog();
  const ids = [...new Set(itemIds.map(String))];
  for (const id of ids) {
    const entry = catalog.get(id);
    if (!entry || !entry.active) throw badRequest(`Unbekanntes oder inaktives Item: ${id}`);
    if (entry.price <= 0) throw badRequest(`„${entry.name}“ hat keinen Preis und kann nicht auf den Schwarzmarkt.`);
  }
  await writeRotation(ids, true);
}

// ---------- Listings ----------

interface Context { catalog: Map<string, CosmeticItem>; stored: ShopEvent[]; running: ShopEvent[]; owned: Set<string> }

async function context(userId: string | null): Promise<Context> {
  const now = new Date();
  const [catalog, stored, owned] = await Promise.all([loadCatalog(), loadStoredEvents(), userId ? ownedItems(userId) : Promise.resolve([])]);
  return { catalog, stored, running: runningEvents(now, stored), owned: new Set(owned.map((entry) => entry.itemId)) };
}

function listing(entry: CosmeticItem, ctx: Context, availableUntil: string | null): ShopListing {
  const price = priceFor(entry, ctx.running);
  return { item: entry, finalPrice: price.finalPrice, discount: price.discount, eventId: price.eventId, owned: ctx.owned.has(entry.id), availableUntil };
}

export async function shopResponse(userId: string): Promise<ShopResponse> {
  const ctx = await context(userId);
  // Items on this week's black market cost the same here as there (that is also what a purchase charges).
  const { weekStart, itemIds } = await currentRotation(ctx.catalog);
  const listings = [...ctx.catalog.values()]
    .filter((entry) => entry.active && (entry.availability === 'shop' || (entry.availability === 'event' && eventFor(entry, ctx.running))))
    .sort(sortItems)
    .map((entry) => {
      const base = listing(entry, ctx, eventFor(entry, ctx.running)?.endsAt ?? null);
      return itemIds.includes(entry.id) ? { ...base, ...blackMarketPrice(entry, weekStart, ctx.running) } : base;
    });
  const byId = new Map(listings.map((entry) => [entry.item.id, entry]));
  const bundles = BUNDLES.flatMap((def) => bundleFor(def, byId) ?? []);
  return { listings, bundles, events: ctx.running, upcoming: upcomingEvents(new Date(), ctx.stored), wallet: await walletSummary(userId) };
}

// ---------- Bundles ----------

/** Price of a bundle: the current prices of the items still missing (already owned ones are free). */
export function bundlePrice(listings: Pick<ShopListing, 'finalPrice' | 'owned'>[]): number {
  return listings.reduce((sum, entry) => sum + (entry.owned ? 0 : entry.finalPrice), 0);
}

/** A bundle as the shop shows it; null when fewer than two of its items are on sale right now. */
export function bundleFor(def: BundleDef, listings: Map<string, ShopListing>): ShopBundle | null {
  const parts = def.itemIds.flatMap((id) => {
    const entry = listings.get(id);
    return entry && entry.item.availability === 'shop' ? [entry] : [];
  });
  if (parts.length < 2) return null;
  return {
    id: def.id, name: def.name, description: def.description, itemIds: parts.map((entry) => entry.item.id),
    price: bundlePrice(parts), fullPrice: parts.reduce((sum, entry) => sum + entry.item.price, 0), owned: parts.filter((entry) => entry.owned).length,
  };
}

/** Buys every item of a bundle you do not own yet, in one transaction, for their summed current prices. */
export async function purchaseBundle(userId: string, bundleId: unknown): Promise<PurchaseResult> {
  const def = BUNDLES.find((entry) => entry.id === bundleId);
  if (!def) throw new HttpError(404, 'Dieses Paket gibt es nicht (mehr).');
  const ctx = await context(null);
  const { weekStart, itemIds: rotation } = await currentRotation(ctx.catalog);
  const entries = def.itemIds.flatMap((id) => {
    const entry = ctx.catalog.get(id);
    return entry?.active && entry.availability === 'shop' && entry.price > 0 ? [entry] : [];
  });
  if (entries.length < 2) throw badRequest('Dieses Paket ist gerade nicht erhältlich.');
  await withTx(async (client) => {
    // Lock first, then read what you own: a parallel single purchase cannot slip in between.
    await lockWallet(client, userId);
    const owned = new Set((await ownedItems(userId, client)).map((entry) => entry.itemId));
    const missing = entries.filter((entry) => !owned.has(entry.id));
    if (!missing.length) throw new HttpError(409, 'Du besitzt schon alles aus diesem Paket.');
    // Same price per item as a single purchase would charge (event or black-market discount included).
    const price = missing.reduce((sum, entry) => sum + (rotation.includes(entry.id)
      ? blackMarketPrice(entry, weekStart, ctx.running).finalPrice
      : priceFor(entry, ctx.running).finalPrice), 0);
    await spendTx(client, userId, price, 'purchase', `Paket: ${def.name} (${missing.length} Artikel)`, { bundleId: def.id, items: missing.length });
    for (const entry of missing) {
      await client.query(`INSERT INTO ${T.user_inventory} (user_id, item_id, source) VALUES ($1, $2, 'purchase') ON CONFLICT DO NOTHING`, [userId, entry.id]);
    }
  });
  await syncAchievements(userId);
  return { wallet: await walletSummary(userId), inventory: await ownedItems(userId) };
}

export async function blackMarketResponse(userId: string | null): Promise<BlackMarketResponse> {
  const ctx = await context(userId);
  const { weekStart, itemIds } = await currentRotation(ctx.catalog);
  const endsAt = weekEnd(weekStart).toISOString();
  const listings = itemIds.map((id) => {
    const entry = ctx.catalog.get(id)!;
    return { ...listing(entry, ctx, endsAt), ...blackMarketPrice(entry, weekStart, ctx.running) };
  });
  const wallet = userId ? await walletSummary(userId) : { balance: 0, lifetimeEarned: 0, todayEarned: 0, dailyCap: (await getEconomyConfig()).dailyEarnCap };
  return { weekStart, endsAt, listings, wallet };
}

// ---------- Purchases ----------

interface Offer { entry: CosmeticItem; price: number; source: OwnedItem['source']; blackMarket: boolean }

async function offerFor(itemId: unknown): Promise<Offer> {
  if (typeof itemId !== 'string' || itemId.length > 64) throw badRequest('Item: ID erwartet.');
  const ctx = await context(null);
  const entry = ctx.catalog.get(itemId);
  if (!entry || !entry.active) throw new HttpError(404, 'Dieses Item gibt es nicht (mehr).');
  // This week's black market first: its items (exclusives and regular ones) sell at the black-market price.
  // Pinned weeks may contain any priced item, so check the rotation rather than the availability.
  const { weekStart, itemIds } = await currentRotation(ctx.catalog);
  if (itemIds.includes(entry.id)) return { entry, price: blackMarketPrice(entry, weekStart, ctx.running).finalPrice, source: 'purchase', blackMarket: true };
  if (entry.availability === 'shop') return { entry, price: priceFor(entry, ctx.running).finalPrice, source: 'purchase', blackMarket: false };
  if (entry.availability === 'event') {
    if (!eventFor(entry, ctx.running)) throw badRequest('Dieses Event-Item gibt es nur während seines Events.');
    return { entry, price: priceFor(entry, ctx.running).finalPrice, source: 'event', blackMarket: false };
  }
  if (entry.availability === 'blackmarket') throw badRequest('Dieses Item ist diese Woche nicht auf dem Schwarzmarkt.');
  throw badRequest('Dieses Item kann man nicht kaufen.');
}

export async function purchase(userId: string, itemId: unknown): Promise<PurchaseResult> {
  const offer = await offerFor(itemId);
  await withTx(async (client) => {
    await spendTx(client, userId, offer.price, 'purchase', `Kauf: ${offer.entry.name}`, { itemId: offer.entry.id, blackMarket: offer.blackMarket ? 1 : 0 });
    const inserted = await client.query(
      `INSERT INTO ${T.user_inventory} (user_id, item_id, source) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [userId, offer.entry.id, offer.source],
    );
    if (!inserted.rowCount) throw new HttpError(409, 'Du besitzt dieses Item schon.');
  });
  await syncAchievements(userId);
  return { wallet: await walletSummary(userId), inventory: await ownedItems(userId) };
}

export interface GiftInput { itemId: unknown; toUserId: string; toName: string; fromName: string; message: unknown }

export async function gift(userId: string, input: GiftInput): Promise<PurchaseResult> {
  if (input.toUserId === userId) throw badRequest('Du kannst dir selbst nichts schenken. Kauf es einfach direkt.');
  if (input.message !== undefined && input.message !== null && typeof input.message !== 'string') throw badRequest('Nachricht: Text erwartet.');
  const message = typeof input.message === 'string' ? sanitizeBio(input.message) : '';
  if (message.length > 100) throw badRequest('Nachricht: höchstens 100 Zeichen.');
  const offer = await offerFor(input.itemId);
  await withTx(async (client) => {
    await spendTx(client, userId, offer.price, 'gift_sent', `Geschenk an ${input.toName}: ${offer.entry.name}`, { itemId: offer.entry.id, to: input.toUserId, blackMarket: offer.blackMarket ? 1 : 0 });
    const inserted = await client.query(
      `INSERT INTO ${T.user_inventory} (user_id, item_id, source) VALUES ($1, $2, 'gift') ON CONFLICT DO NOTHING`,
      [input.toUserId, offer.entry.id],
    );
    if (!inserted.rowCount) throw new HttpError(409, `${input.toName} besitzt dieses Item schon.`);
    await noteTx(client, input.toUserId, 'gift_received', `Geschenk von ${input.fromName}: ${offer.entry.name}${message ? ` – „${message}“` : ''}`, { itemId: offer.entry.id, from: userId });
  });
  await syncAchievements(userId);
  return { wallet: await walletSummary(userId), inventory: await ownedItems(userId) };
}
