import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countFor, counterStats, formatCounterChannelName, getCounterTypeDisplay, parseCounters } from '../src/services/serverstats/core.js';

const NOW = '2026-10-28T12:00:00.000Z';

test('counts per counter type, total from the member count', () => {
  const stats = counterStats(120, 80, 5);
  assert.deepEqual(stats, { totalCount: 120, botCount: 5, humanCount: 115 });
  assert.deepEqual(['members', 'members_only', 'bots', 'x'].map((type) => countFor(stats, type)), [120, 115, 5, null]);
  assert.equal(counterStats(undefined, 80, 5).totalCount, 80);
  assert.equal(counterStats(3, 3, 9).humanCount, 0);
});

test('channel names and type labels', () => {
  assert.equal(formatCounterChannelName('members_only', 42), 'Mitglieder-42');
  assert.equal(formatCounterChannelName('bots', 3, '{name}: {count}'), 'Bots: 3');
  assert.equal(formatCounterChannelName('x', 1), 'Zähler-1');
  assert.equal(getCounterTypeDisplay('members'), '👥 Mitglieder + Bots');
});

test('stored counters in every old format, invalid ones dropped, defaults filled in', () => {
  const counter = { id: '1', type: 'bots', channelId: '9' };
  const full = { ...counter, guildId: 'g', createdAt: NOW, enabled: true };
  assert.deepEqual(parseCounters([counter, { id: '', type: 'bots', channelId: '9' }, null], 'g', NOW), [full]);
  assert.deepEqual(parseCounters({ ok: true, value: [counter] }, 'g', NOW), [full]);
  assert.deepEqual(parseCounters(JSON.stringify([counter]), 'g', NOW), [full]);
  assert.deepEqual(parseCounters(counter, 'g', NOW), [full]);
  assert.deepEqual(parseCounters('kaputt', 'g', NOW), []);
  assert.deepEqual(parseCounters(null, 'g', NOW), []);
  assert.deepEqual(parseCounters([{ ...counter, enabled: false, updatedAt: NOW }], 'g', NOW), [{ ...full, enabled: false, updatedAt: NOW }]);
});
