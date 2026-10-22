import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCoins, splitCoins } from '../src/shared/coins.js';

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
