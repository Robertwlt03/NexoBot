import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discounted, formatCoins, setCoinEmojis, splitCoins } from '../src/shared/coins.js';
import { coinPng } from '../src/services/cosmetics/coinEmojis.js';

test('amounts split into platinum, gold, silver and bronze (100 : 100 : 100), zero tiers left out', () => {
  assert.deepEqual(splitCoins(4850), [{ tier: 'silver', count: 48 }, { tier: 'bronze', count: 50 }]);
  assert.deepEqual(splitCoins(12800), [{ tier: 'gold', count: 1 }, { tier: 'silver', count: 28 }]);
  assert.deepEqual(splitCoins(350), [{ tier: 'silver', count: 3 }, { tier: 'bronze', count: 50 }]);
  assert.deepEqual(splitCoins(1_234_567), [{ tier: 'platinum', count: 1 }, { tier: 'gold', count: 23 }, { tier: 'silver', count: 45 }, { tier: 'bronze', count: 67 }]);
  assert.deepEqual(splitCoins(3_000_000), [{ tier: 'platinum', count: 3 }]);
  assert.deepEqual(splitCoins(0), [{ tier: 'bronze', count: 0 }]);
  assert.deepEqual(splitCoins(-250), [{ tier: 'silver', count: 2 }, { tier: 'bronze', count: 50 }]);
  assert.equal(formatCoins(12800), '🟡 1 ⚪ 28');
  assert.equal(formatCoins(-7), '−🟤 7');
});

test('discounts round down to clean coin steps within 5 %, never below the announced discount', () => {
  assert.equal(discounted(2200, 20), 1700); // 1760 → ⚪ 17
  assert.equal(discounted(1000, 20), 800);
  assert.equal(discounted(350, 20), 280); // ⚪ 2 would be far too cheap → 10-bronze step
  assert.equal(discounted(6500, 15), 5500); // 5525 → ⚪ 55
  assert.equal(discounted(95, 20), 76); // small prices stay exact
  for (const [price, percent] of [[2200, 20], [6500, 15], [9000, 35], [450, 10]]) assert.ok(discounted(price, percent) <= price * (100 - percent) / 100);
});

test('bot coin emojis replace the unicode fallback once registered, and render as PNG', () => {
  assert.equal(formatCoins(250), '⚪ 2 🟤 50');
  setCoinEmojis({ silver: '<:berni_silber_v1:1>', bronze: '<:berni_bronze_v1:2>' });
  assert.equal(formatCoins(250), '<:berni_silber_v1:1> 2 <:berni_bronze_v1:2> 50');
  setCoinEmojis({ silver: undefined, bronze: undefined });
  const png = coinPng('gold');
  assert.deepEqual([...png.subarray(1, 4)].map((b) => String.fromCharCode(b)).join(''), 'PNG');
  assert.ok(png.length < 256 * 1024, 'Discord emoji limit');
});
