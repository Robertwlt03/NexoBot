// Year review: six tiles and the highlights that have data behind them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildYearReview } from '../src/services/cosmetics/yearReview.js';

const numbers = {
  earned: 1200, spent: 300, purchases: 2, achievements: 5, xp: 9000, minigames: 40,
  bestMonth: { month: 10, xp: 4000 }, topGuild: { guildId: 'g', xp: 6000 },
  counters: new Map([['messages', 900], ['chat_days', 40], ['chat_streak_best', 1], ['game_fish', 12], ['game_roll', 3]]),
};

test('tiles and highlights from the year numbers', () => {
  const review = buildYearReview(2026, numbers, () => 'Nexo');
  assert.equal(review.tiles.length, 6);
  assert.deepEqual(review.tiles.find((t) => t.label === 'Bernis verdient'), { label: 'Bernis verdient', value: 1200, coins: true });
  assert.equal(review.tiles.find((t) => t.label === 'Längste Chat-Serie')!.unit, 'Tag');
  assert.deepEqual(review.highlights, ['Dein Lieblingsserver: Nexo mit 6.000 XP', 'Dein stärkster Monat: Oktober', 'Dein Lieblingsspiel: Angeln (12-mal)']);
});

test('no highlights without data', () => {
  const review = buildYearReview(2026, { ...numbers, purchases: 0, bestMonth: null, topGuild: null, counters: new Map() }, () => null);
  assert.deepEqual(review.highlights, []);
});
