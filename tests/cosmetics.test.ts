import { test } from 'node:test';
import { discounted } from '../src/shared/coins.js';
import assert from 'node:assert/strict';
import {
  COSMETIC_SLOTS, MAX_BIO_LENGTH, PRICE_BANDS, RARITIES, defaultProfileSettings, levelUpReward, type CosmeticItem,
} from '../src/shared/cosmetics.js';
import { HttpError } from '../src/web/http.js';
import { dailyBonusAmount, defaultEconomyConfig, levelReward, parseEconomyConfig } from '../src/services/cosmetics/config.js';
import { AUTO_EVENT_IDS, blackFridayDay, calendarEvents, eventFor, priceFor, runningEvents, upcomingEvents } from '../src/services/cosmetics/events.js';
import { BUNDLES, SEED_ITEMS, parseSlotData } from '../src/services/cosmetics/catalog.js';
import { BLACK_MARKET_EXCLUSIVES, blackMarketDiscount, blackMarketPrice, bundleFor, bundlePrice, rotationFor } from '../src/services/cosmetics/shop.js';
import { cappedGrant, dailyState } from '../src/services/cosmetics/wallet.js';
import { selectPayouts, type Placement } from '../src/services/cosmetics/rankings.js';
import { parseProfileSettings, sanitizeBio } from '../src/services/cosmetics/profile.js';
import { resolveEquipped } from '../src/services/cosmetics/store.js';
import { berlinDay, monthStartOf, weekEnd, weekStartOf } from '../src/services/cosmetics/time.js';
import type { ShopEvent } from '../src/web/dto/profile.js';

const config = defaultEconomyConfig();
const byId = new Map(SEED_ITEMS.map((entry) => [entry.id, entry]));
const seed = (id: string): CosmeticItem => {
  const entry = byId.get(id);
  assert.ok(entry, `seed item ${id}`);
  return entry;
};

test('level-up rewards match the shared formula with the default config', () => {
  for (let level = 1; level <= 200; level += 1) assert.equal(levelReward(config, level), levelUpReward(level));
  assert.equal(levelUpReward(12), 92);
  assert.equal(levelUpReward(10), 120);
  assert.equal(levelReward({ ...config, levelUpBase: 0, levelUpPerLevel: 10, milestoneMultiplier: 2 }, 20), 400);
});

test('Black Friday is the last Friday of November, through Cyber Monday (Berlin time)', () => {
  assert.deepEqual([2025, 2026, 2027, 2028].map(blackFridayDay), [28, 27, 26, 24]);
  const bf = calendarEvents(2026).find((event) => event.id === 'black-friday')!;
  assert.equal(bf.startsAt, '2026-11-26T23:00:00.000Z');
  assert.equal(bf.endsAt, '2026-11-30T23:00:00.000Z'); // Tuesday 1.12. 00:00 Berlin
  assert.equal(bf.discount, 30);
  const bf2028 = calendarEvents(2028).find((event) => event.id === 'black-friday')!;
  assert.equal(bf2028.startsAt, '2028-11-23T23:00:00.000Z');
  assert.equal(bf2028.endsAt, '2028-11-27T23:00:00.000Z');
});

test('calendar events use Berlin local midnight (summer time included)', () => {
  const summer = calendarEvents(2026).find((event) => event.id === 'summer-sale')!;
  assert.equal(summer.startsAt, '2026-07-14T22:00:00.000Z');
  assert.equal(summer.endsAt, '2026-08-15T22:00:00.000Z');
  const halloween = calendarEvents(2026).find((event) => event.id === 'halloween')!;
  assert.equal(halloween.startsAt, '2026-10-23T22:00:00.000Z');
  assert.equal(halloween.endsAt, '2026-10-31T23:00:00.000Z'); // DST ends on 25.10.
  assert.deepEqual(calendarEvents(2026).map((event) => event.id).sort(), [...AUTO_EVENT_IDS].sort());
});

test('Weihnachten and Neujahr overlap at the turn of the year', () => {
  const ids = (iso: string) => runningEvents(new Date(iso), []).map((event) => event.id).sort();
  assert.deepEqual(ids('2026-12-20T12:00:00Z'), ['christmas']);
  assert.deepEqual(ids('2027-01-01T12:00:00Z'), ['christmas', 'new-year']);
  assert.deepEqual(ids('2027-01-02T22:59:00Z'), ['christmas', 'new-year']);
  assert.deepEqual(ids('2027-01-03T12:00:00Z'), ['new-year']);
  assert.deepEqual(ids('2027-01-08T12:00:00Z'), []);
  assert.deepEqual(ids('2026-10-18T12:00:00Z'), []);
  assert.equal(upcomingEvents(new Date('2026-10-18T12:00:00Z'), [])[0].id, 'halloween');
});

test('disabled auto events do not run', () => {
  const off: ShopEvent = { ...calendarEvents(2026)[0], id: 'christmas', active: false };
  assert.deepEqual(runningEvents(new Date('2027-01-01T12:00:00Z'), [off]).map((event) => event.id), ['new-year']);
});

test('discount resolution picks the best running event for the slot', () => {
  const now = new Date('2026-07-20T12:00:00Z');
  const custom: ShopEvent = {
    id: 'custom-bg', name: 'BG', description: '', startsAt: '2026-07-01T00:00:00Z', endsAt: '2026-08-01T00:00:00Z',
    discount: 50, slots: ['background'], kind: 'custom', active: true,
  };
  const running = runningEvents(now, [custom]);
  assert.deepEqual(running.map((event) => event.id).sort(), ['custom-bg', 'summer-sale']);
  // 900 at 50 % = 450: full silver would be 10 % off the deal, so it stays at 450.
  assert.deepEqual(priceFor(seed('bg-indigo-dusk'), running), { finalPrice: 450, discount: 50, eventId: 'custom-bg' });
  assert.deepEqual(priceFor(seed('frame-sapphire'), running), { finalPrice: 800, discount: 20, eventId: 'summer-sale' });
  // Black-market items never get discounts.
  assert.equal(priceFor(seed('bg-void-crystal'), running).discount, 0);
  // Event items only while their event runs.
  assert.ok(eventFor(seed('badge-sun'), running));
  assert.equal(eventFor(seed('badge-pumpkin'), running), null);
  assert.equal(priceFor(seed('frame-sapphire'), []).finalPrice, 1000);
});

test('weekly black-market rotation: deterministic night-market mix of exclusives and shop items', () => {
  const exclusives = SEED_ITEMS.filter((entry) => entry.availability === 'blackmarket').map((entry) => entry.id);
  const shop = SEED_ITEMS.filter((entry) => entry.availability === 'shop' && entry.price > 0).map((entry) => entry.id);
  const a = rotationFor('2026-10-12', exclusives, shop, 6);
  assert.deepEqual(rotationFor('2026-10-12', [...exclusives].reverse(), [...shop].reverse(), 6), a);
  assert.equal(a.length, 6);
  assert.equal(new Set(a).size, 6);
  assert.equal(a.filter((id) => exclusives.includes(id)).length, BLACK_MARKET_EXCLUSIVES);
  // Regular items of more than one rarity, so the cards are not all the same colour.
  assert.ok(new Set(a.map((id) => seed(id).rarity)).size >= 2);
  const weeks = ['2026-10-19', '2026-10-26', '2026-11-02'].map((week) => rotationFor(week, exclusives, shop, 6).join());
  assert.ok(weeks.some((week) => week !== a.join()));
  // Too few shop items: filled up with exclusives; too few of both: as many as there are.
  assert.equal(rotationFor('2026-10-12', exclusives, shop.slice(0, 1), 6).length, 6);
  assert.equal(rotationFor('2026-10-12', exclusives.slice(0, 2), shop.slice(0, 1), 6).length, 3);
});

test('black-market discounts: 10–40 % per item and week, and never worse than a running event', () => {
  const item = seed(SEED_ITEMS.find((entry) => entry.availability === 'shop' && entry.price > 0)!.id);
  const weeks = Array.from({ length: 40 }, (_, i) => new Date(Date.UTC(2026, 0, 5 + i * 7)).toISOString().slice(0, 10));
  const discounts = weeks.map((week) => blackMarketDiscount(week, item.id));
  assert.ok(discounts.every((d) => d >= 10 && d <= 40 && d % 5 === 0));
  assert.ok(new Set(discounts).size > 2);
  assert.equal(blackMarketDiscount('2026-10-12', item.id), blackMarketDiscount('2026-10-12', item.id));
  const price = blackMarketPrice(item, '2026-10-12', []);
  assert.equal(price.finalPrice, discounted(item.price, price.discount));
  const bigSale: ShopEvent = { id: 'sale', name: 'Sale', description: '', startsAt: '2026-10-01T00:00:00Z', endsAt: '2026-11-01T00:00:00Z', discount: 90, slots: null, kind: 'custom', active: true };
  assert.equal(blackMarketPrice(item, '2026-10-12', [bigSale]).discount, 90);
});

test('weeks start Monday 00:00 Berlin, months follow Berlin time', () => {
  assert.equal(weekStartOf(new Date('2026-10-18T21:30:00Z')), '2026-10-12'); // Sunday 23:30 Berlin
  assert.equal(weekStartOf(new Date('2026-10-18T22:30:00Z')), '2026-10-19'); // Monday 00:30 Berlin
  assert.equal(weekEnd('2026-10-19').toISOString(), '2026-10-25T23:00:00.000Z');
  assert.equal(monthStartOf(new Date('2026-10-31T23:30:00Z')), '2026-11-01');
  assert.equal(monthStartOf(new Date('2027-01-10T12:00:00Z'), -1), '2026-12-01');
  assert.equal(berlinDay(new Date('2026-12-31T23:30:00Z')), '2027-01-01');
});

test('streak shields bridge missed days, one each, and only when there are enough', () => {
  const today = '2026-10-18';
  const now = new Date('2026-10-18T10:00:00Z');
  const one = dailyState('2026-10-16', 9, today, config, now, 1);
  assert.deepEqual([one.streak, one.claimStreak, one.saving], [9, 10, 1]);
  const short = dailyState('2026-10-15', 9, today, config, now, 1);
  assert.deepEqual([short.streak, short.saving], [0, 0]);
  const two = dailyState('2026-10-15', 9, today, config, now, 2);
  assert.deepEqual([two.streak, two.saving], [9, 2]);
  assert.equal(dailyState('2026-10-17', 3, today, config, now, 2).saving, 0, 'no shield used without a missed day');
});

test('daily bonus streak grows, caps and resets after a missed day', () => {
  const today = '2026-10-18';
  const first = dailyState(null, 0, today, config);
  assert.deepEqual([first.available, first.streak, first.nextAmount, first.nextAt], [true, 0, 25, null]);
  const continued = dailyState('2026-10-17', 3, today, config);
  assert.deepEqual([continued.available, continued.streak, continued.claimStreak, continued.nextAmount], [true, 3, 4, 40]);
  const missed = dailyState('2026-10-16', 9, today, config);
  assert.deepEqual([missed.streak, missed.claimStreak, missed.nextAmount], [0, 1, 25]);
  const claimed = dailyState(today, 5, today, config, new Date('2026-10-18T10:00:00Z'));
  assert.equal(claimed.available, false);
  assert.equal(claimed.nextAt, '2026-10-18T22:00:00.000Z');
  assert.equal(dailyBonusAmount(config, 40), 75);
});

test('the daily cap only lets the remainder through', () => {
  assert.equal(cappedGrant(50, 0, 400), 50);
  assert.equal(cappedGrant(50, 380, 400), 20);
  assert.equal(cappedGrant(50, 400, 400), 0);
  assert.equal(cappedGrant(50, 450, 400), 0);
});

test('monthly payouts: top places paid, at most N servers per user, best ranks first', () => {
  const p = (guildId: string, kind: 'minigames' | 'activity', userId: string, rank: number): Placement => ({ guildId, kind, userId, rank, points: 100 - rank });
  const payouts = selectPayouts([
    p('g1', 'minigames', 'u1', 4),
    p('g2', 'minigames', 'u1', 1),
    p('g3', 'activity', 'u1', 2),
    p('g4', 'activity', 'u1', 3),
    p('g2', 'activity', 'u1', 5), // same server as an earlier payout: still allowed
    p('g1', 'minigames', 'u2', 1),
    p('g1', 'minigames', 'u3', 6), // beyond the reward list
  ], [500, 300, 200, 120, 80], 3);
  const u1 = payouts.filter((payout) => payout.userId === 'u1');
  assert.deepEqual(u1.map((payout) => `${payout.guildId}:${payout.kind}:${payout.amount}`).sort(),
    ['g2:activity:80', 'g2:minigames:500', 'g3:activity:300', 'g4:activity:200']);
  assert.deepEqual(payouts.filter((payout) => payout.userId === 'u2').map((payout) => payout.amount), [500]);
  assert.equal(payouts.some((payout) => payout.userId === 'u3'), false);
});

test('profile validation: ownership, slot match, badge limit and clean bio', () => {
  const owned = new Set(['bg-midnight', 'badge-star', 'badge-leaf', 'badge-paw', 'badge-music', 'frame-silver']);
  const ok = parseProfileSettings({
    equipped: { background: 'bg-midnight', frame: 'frame-silver', badges: ['badge-star', 'badge-leaf', 'badge-star'] },
    bio: 'Hi <@123456789012345678> schau auf https://evil.example/x und discord.gg/abc   @everyone  ciao',
    showOnWelcome: false,
  }, byId, owned);
  assert.equal(ok.equipped.background, 'bg-midnight');
  assert.deepEqual(ok.equipped.badges, ['badge-star', 'badge-leaf']);
  assert.equal(ok.bio, 'Hi schau auf und ciao');
  assert.equal(ok.showOnWelcome, false);

  const status = (fn: () => unknown) => {
    try { fn(); } catch (error) { return error instanceof HttpError ? error.status : -1; }
    return 0;
  };
  assert.equal(status(() => parseProfileSettings({ equipped: { background: 'bg-aurora' } }, byId, owned)), 403);
  assert.equal(status(() => parseProfileSettings({ equipped: { background: 'frame-silver' } }, byId, owned)), 400);
  assert.equal(status(() => parseProfileSettings({ equipped: { badges: ['badge-star', 'badge-leaf', 'badge-paw', 'badge-music'] } }, byId, owned)), 400);
  assert.equal(status(() => parseProfileSettings({ bio: 'x'.repeat(MAX_BIO_LENGTH + 1) }, byId, owned)), 400);
  assert.equal(sanitizeBio('Besuch www.nexo.gg oder nexobot.de/hilfe'), 'Besuch oder');
});

test('resolved cosmetics skip unknown, inactive and wrong-slot items', () => {
  const settings = defaultProfileSettings();
  settings.equipped.background = 'bg-midnight';
  settings.equipped.frame = 'bg-graphite';
  settings.equipped.badges = ['badge-star', 'nope'];
  const catalog = new Map(byId);
  catalog.set('bg-midnight', { ...seed('bg-midnight'), active: false });
  const resolved = resolveEquipped(settings, catalog);
  assert.equal(resolved.background, null);
  assert.equal(resolved.frame, null);
  assert.deepEqual(resolved.badges, [{ glyph: 'star', color: '#F5C451' }]);
});

test('seed catalog: size, coverage, price bands and valid data', () => {
  assert.ok(SEED_ITEMS.length >= 70, `only ${SEED_ITEMS.length} items`);
  assert.equal(new Set(SEED_ITEMS.map((entry) => entry.id)).size, SEED_ITEMS.length);
  for (const slot of COSMETIC_SLOTS) assert.ok(SEED_ITEMS.some((entry) => entry.slot === slot), `slot ${slot}`);
  for (const rarity of RARITIES) assert.ok(SEED_ITEMS.some((entry) => entry.rarity === rarity), `rarity ${rarity}`);
  assert.ok(SEED_ITEMS.filter((entry) => entry.availability === 'event').length >= 8);
  assert.ok(SEED_ITEMS.filter((entry) => entry.availability === 'blackmarket' && entry.rarity === 'mythic').length >= 8);
  assert.ok(SEED_ITEMS.some((entry) => entry.availability === 'ranking' && entry.name === 'Monatssieger'));
  for (const entry of SEED_ITEMS) {
    const buyable = entry.availability === 'shop' || entry.availability === 'event' || entry.availability === 'blackmarket';
    if (buyable) {
      const [min, max] = PRICE_BANDS[entry.rarity];
      assert.ok(entry.price >= min && entry.price <= max, `${entry.id} price ${entry.price} outside ${min}–${max}`);
    } else {
      assert.equal(entry.price, 0, entry.id);
    }
    if (entry.availability === 'event') assert.ok((AUTO_EVENT_IDS as readonly string[]).includes(entry.eventId ?? ''), entry.id);
    assert.doesNotThrow(() => parseSlotData(entry.slot, entry.data), entry.id);
  }
});

test('owner config validation rejects out-of-range values', () => {
  assert.deepEqual(parseEconomyConfig({}), config);
  assert.equal(parseEconomyConfig({ dailyEarnCap: 600 }).dailyEarnCap, 600);
  assert.throws(() => parseEconomyConfig({ minigameReward: { min: 10, max: 5 } }), HttpError);
  assert.throws(() => parseEconomyConfig({ monthlyRewards: [] }), HttpError);
  assert.throws(() => parseEconomyConfig({ blackMarketSize: 0 }), HttpError);
});

test('bundles only hold regular shop items, each at most once, and every slot only once', () => {
  const ids = new Set<string>();
  for (const bundle of BUNDLES) {
    assert.ok(!ids.has(bundle.id), bundle.id);
    ids.add(bundle.id);
    assert.ok(bundle.itemIds.length >= 3, `${bundle.id}: at least three items`);
    assert.equal(new Set(bundle.itemIds).size, bundle.itemIds.length, `${bundle.id}: duplicate item`);
    const items = bundle.itemIds.map(seed);
    for (const entry of items) assert.equal(entry.availability, 'shop', `${bundle.id}: ${entry.id} is not a shop item`);
    // A bundle is one look: two items of the same slot would replace each other (badges may stack).
    const slots = items.filter((entry) => entry.slot !== 'badge').map((entry) => entry.slot);
    assert.equal(new Set(slots).size, slots.length, `${bundle.id}: two items of one slot`);
  }
});

test('bundle price: current prices of the missing items, owned ones are free', () => {
  assert.equal(bundlePrice([{ finalPrice: 400, owned: false }, { finalPrice: 900, owned: true }, { finalPrice: 1200, owned: false }]), 1600);
  const def = BUNDLES[0];
  const listings = new Map(def.itemIds.map((id, i) => {
    const item = seed(id);
    return [id, { item, finalPrice: Math.round(item.price * 0.8), discount: 20, eventId: 'sale', owned: i === 0, availableUntil: null }];
  }));
  const bundle = bundleFor(def, listings);
  assert.ok(bundle);
  assert.equal(bundle.owned, 1);
  assert.equal(bundle.fullPrice, def.itemIds.reduce((sum, id) => sum + seed(id).price, 0));
  assert.equal(bundle.price, def.itemIds.slice(1).reduce((sum, id) => sum + Math.round(seed(id).price * 0.8), 0));
  // Fewer than two items on sale: no bundle.
  assert.equal(bundleFor(def, new Map([...listings].slice(0, 1))), null);
});

