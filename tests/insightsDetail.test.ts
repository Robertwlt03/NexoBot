import { test } from 'node:test';
import assert from 'node:assert/strict';
import { berlinSlot, buildHeatmap, insightRangeOf, isSnowflake, retentionCutoff } from '../src/services/statsTracker.js';
import { DETAIL_RETENTION_DAYS } from '../src/web/dto/insightsDetail.js';

test('UTC hours map to Berlin weekday (0 = Monday) and hour, DST included', () => {
  // Winter (UTC+1): Monday 2026-01-05 23:00 UTC is Tuesday 00:00 in Berlin.
  assert.deepEqual(berlinSlot('2026-01-05', 23), { weekday: 1, hour: 0 });
  // Summer (UTC+2): Sunday 2026-07-05 22:00 UTC is Monday 00:00 in Berlin.
  assert.deepEqual(berlinSlot('2026-07-05', 22), { weekday: 0, hour: 0 });
  assert.deepEqual(berlinSlot('2026-07-05', 12), { weekday: 6, hour: 14 });
  // DST starts Sunday 2026-03-29 at 01:00 UTC (02:00 → 03:00 local).
  assert.deepEqual(berlinSlot('2026-03-29', 0), { weekday: 6, hour: 1 });
  assert.deepEqual(berlinSlot('2026-03-29', 1), { weekday: 6, hour: 3 });
  // DST ends Sunday 2026-10-25 at 01:00 UTC (03:00 → 02:00 local): 00:00 and 01:00 UTC both show 02:00.
  assert.deepEqual(berlinSlot('2026-10-25', 0), { weekday: 6, hour: 2 });
  assert.deepEqual(berlinSlot('2026-10-25', 1), { weekday: 6, hour: 2 });
});

test('heatmap is 7 × 24 and sums rows into Berlin slots', () => {
  const heatmap = buildHeatmap([
    { day: '2026-10-25', hour: 0, messages: 3 },
    { day: '2026-10-25', hour: 1, messages: 4 },
    { day: '2026-01-05', hour: 23, messages: 5 },
  ]);
  assert.equal(heatmap.length, 7);
  assert.ok(heatmap.every((row) => row.length === 24));
  assert.equal(heatmap[6][2], 7);
  assert.equal(heatmap[1][0], 5);
  assert.equal(heatmap.flat().reduce((sum, value) => sum + value, 0), 12);
});

test('retention cutoff lies DETAIL_RETENTION_DAYS before today', () => {
  assert.equal(DETAIL_RETENTION_DAYS, 180);
  assert.equal(retentionCutoff('2026-10-18'), '2026-04-21');
  assert.equal(retentionCutoff('2026-03-01'), '2025-09-02');
});

test('range accepts 7, 30, 90 and defaults to 30', () => {
  assert.equal(insightRangeOf('7'), 7);
  assert.equal(insightRangeOf('90'), 90);
  assert.equal(insightRangeOf(undefined), 30);
  for (const bad of ['14', 'abc', '30.0', ['7']]) assert.equal(insightRangeOf(bad), null);
});

test('member ids must be 17–20 digits', () => {
  assert.ok(isSnowflake('123456789012345678'));
  for (const bad of ['1234', '123456789012345678901', 'abc123456789012345', undefined]) assert.equal(isSnowflake(bad), false);
});
