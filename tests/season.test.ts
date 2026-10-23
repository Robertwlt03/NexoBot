// Season path: tiers by points, and season items that fit the catalog limits for every month.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEASON_TIERS, seasonItems, seasonTier } from '../src/shared/season.js';

test('tiers are reached in order', () => {
  assert.equal(seasonTier(0), 0);
  assert.equal(seasonTier(SEASON_TIERS[0].points), 1);
  assert.equal(seasonTier(SEASON_TIERS[4].points - 1), 4);
  assert.equal(seasonTier(99_999), SEASON_TIERS.length);
  assert.ok(SEASON_TIERS.every((tier, i) => i === 0 || tier.points > SEASON_TIERS[i - 1].points));
});

test('every month has a badge and a title of at most 32 characters', () => {
  for (let month = 1; month <= 12; month += 1) {
    const items = seasonItems(`2026-${String(month).padStart(2, '0')}`);
    assert.ok(items.title.data.text.length <= 32, items.title.data.text);
    assert.match(items.badge.id, /^season-badge-2026-\d\d$/);
  }
});
