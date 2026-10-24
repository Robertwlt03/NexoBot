// Community goal size: three quarters of the server's usual pace, rounded, with a floor for quiet or new servers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goalTarget } from '../src/services/cosmetics/community.js';

test('goal follows the server pace over the event', () => {
  assert.equal(goalTarget(28 * 200, 28, 10), 1500); // 200 a day, 10 days → 2000 × 0.75
  assert.equal(goalTarget(28 * 2, 28, 7), 150, 'quiet servers get the floor');
  assert.equal(goalTarget(100, 3, 7), 200, 'too little history: 40 a day');
  assert.equal(goalTarget(28 * 100_000, 28, 30), 100_000, 'capped');
});
