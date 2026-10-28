import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_LEVEL, applyXp, calculateTotalXp, defaultLevelingConfig, getXpForLevel, isOnCooldown, normalizeLevelData, rollMessageXp,
} from '../src/services/leveling/core.js';

const fresh = normalizeLevelData(null);

test('xp curve and total xp match', () => {
  assert.deepEqual([0, 1, 2, 10].map(getXpForLevel), [50, 105, 170, 1050]);
  assert.equal(calculateTotalXp(0), 0);
  assert.equal(calculateTotalXp(3, 7), 50 + 105 + 170 + 7);
});

test('applyXp rolls over into every level it passes', () => {
  const { data, reached } = applyXp(fresh, 50 + 105 + 10, 1234);
  assert.deepEqual(reached, [1, 2]);
  assert.deepEqual(data, { xp: 10, level: 2, totalXp: 165, lastMessage: 1234, rank: 0 });
  assert.equal(fresh.level, 0, 'input stays untouched');
  assert.deepEqual(applyXp(fresh, 49, 0).reached, []);
});

test('applyXp stops at the max level', () => {
  const { data, reached } = applyXp({ ...fresh, level: MAX_LEVEL }, 10_000_000, 0);
  assert.equal(data.level, MAX_LEVEL);
  assert.deepEqual(reached, []);
});

test('normalizeLevelData clamps broken records', () => {
  assert.deepEqual(normalizeLevelData({ xp: -5, level: 5000, totalXp: Number.NaN }), { xp: 0, level: MAX_LEVEL, totalXp: 0, lastMessage: 0, rank: 0 });
});

test('message xp respects range, multiplier and cooldown', () => {
  const cfg = { ...defaultLevelingConfig(), xpRange: { min: 10, max: 20 } };
  assert.equal(rollMessageXp(cfg, () => 0), 10);
  assert.equal(rollMessageXp(cfg, () => 0.999), 20);
  assert.equal(rollMessageXp({ ...cfg, xpMultiplier: 1.5 }, () => 0), 15);
  assert.equal(isOnCooldown(cfg, 1000, 1000 + 19_999), true);
  assert.equal(isOnCooldown(cfg, 1000, 1000 + 20_000), false);
});

test('xp shown for the next level is what applyXp needs to level up', async () => {
  const { leaderboardEmbed } = await import('../src/services/leveling/views.js');
  const needed = getXpForLevel(5);
  assert.deepEqual(applyXp({ ...fresh, level: 5 }, needed, 0).reached, [6]);
  const text = leaderboardEmbed([{ userId: '1', xp: 0, level: 5, totalXp: 900, rank: 1 }]).toJSON().fields?.[0]?.value ?? '';
  assert.match(text, new RegExp(`\\(0/${needed} XP\\)`));
});
