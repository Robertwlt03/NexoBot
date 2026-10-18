import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, dayKey, fillDays, mergeCounters, type DailyStatsRow } from '../src/services/statsTracker.js';

const row = (day: string, values: Partial<DailyStatsRow> = {}): DailyStatsRow => ({
  day, joins: 0, leaves: 0, messages: 0, activeMembers: 0, voiceMinutes: 0, memberCount: null, ...values,
});

test('days are bucketed in UTC', () => {
  assert.equal(dayKey(Date.UTC(2026, 9, 18, 23, 59, 59)), '2026-10-18');
  assert.equal(dayKey(Date.UTC(2026, 9, 19, 0, 0, 0)), '2026-10-19');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('buffers merge by summing every counter', () => {
  const merged = mergeCounters({ joins: 1, leaves: 2, messages: 3, voiceMs: 4 }, { messages: 10, voiceMs: 60_000 });
  assert.deepEqual(merged, { joins: 1, leaves: 2, messages: 13, voiceMs: 60_004 });
});

test('range fill adds empty days and carries the member count forward', () => {
  const days = fillDays([
    row('2026-10-10', { memberCount: 100 }),
    row('2026-10-16', { joins: 3, messages: 40, memberCount: 103 }),
    row('2026-10-18', { leaves: 1 }),
  ], '2026-10-18', 5);
  assert.deepEqual(days.map((d) => d.day), ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
  assert.deepEqual(days.map((d) => d.memberCount), [100, 100, 103, 103, 103]);
  assert.deepEqual(days.map((d) => d.joins), [0, 0, 3, 0, 0]);
  assert.equal(days[4].leaves, 1);
});

test('member count stays null until the first snapshot', () => {
  const days = fillDays([row('2026-10-18', { memberCount: 7 })], '2026-10-18', 3);
  assert.deepEqual(days.map((d) => d.memberCount), [null, null, 7]);
});
