import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  concludeGiveaway, isClosed, parseDuration, redrawGiveaway, selectWinners, toGiveawayList, validatePrize, validateWinnerCount,
} from '../src/services/giveaways/core.js';

const limits = { minimumDuration: 300_000, maximumDuration: 30 * 86_400_000, minimumWinners: 1, maximumWinners: 10 };
const userMessage = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return (error as { userMessage?: string }).userMessage;
  }
  return null;
};

test('durations within the configured range', () => {
  assert.deepEqual(['5m', '1h', '2D', '30d'].map((input) => parseDuration(input, limits)), [300_000, 3_600_000, 172_800_000, 2_592_000_000]);
  assert.equal(userMessage(() => parseDuration('10s', limits)), 'Die minimale Dauer beträgt 5m.');
  assert.equal(userMessage(() => parseDuration('31d', limits)), 'Die maximale Dauer beträgt 30 Tage.');
  assert.equal(userMessage(() => parseDuration('1 Stunde', limits)), 'Ungültiges Format für die Dauer. Nutze: 1h, 30m, 5d (min.: 5m, max.: 30d)');
  assert.ok(userMessage(() => parseDuration(null, limits)));
});

test('prize and winner count', () => {
  assert.equal(validatePrize('  Nitro '), 'Nitro');
  assert.ok(userMessage(() => validatePrize('   ')));
  assert.ok(userMessage(() => validatePrize('x'.repeat(257))));
  assert.doesNotThrow(() => validateWinnerCount(10, limits));
  assert.ok(userMessage(() => validateWinnerCount(11, limits)));
  assert.ok(userMessage(() => validateWinnerCount(1.5, limits)));
});

test('winners are distinct participants, at most the winner count', () => {
  const first = () => 0;
  assert.deepEqual(selectWinners(['a', 'b', 'c', 'a'], 2, first), ['b', 'c']);
  assert.deepEqual(selectWinners(['a'], 3), ['a']);
  assert.deepEqual(selectWinners([], 3), []);
  const many = selectWinners(['a', 'b', 'c', 'd', 'e'], 3);
  assert.equal(new Set(many).size, 3);
});

test('ending and redrawing set the stored fields', () => {
  const now = new Date('2026-10-28T12:00:00Z');
  const giveaway = { messageId: '1', prize: 'Nitro', winnerCount: 1, participants: ['a', 'b'], endsAt: now.getTime() - 1 };
  assert.ok(isClosed(giveaway, now.getTime()));
  assert.ok(!isClosed({ ...giveaway, endsAt: now.getTime() + 1 }, now.getTime()));
  const ended = concludeGiveaway(giveaway, 'host', now, () => 0);
  assert.deepEqual([ended.ended, ended.isEnded, ended.winnerIds, ended.endedBy, ended.participantCount, ended.endedAt], [true, true, ['b'], 'host', 2, now.toISOString()]);
  const redrawn = redrawGiveaway(ended, 'mod', now, () => 0.99);
  assert.deepEqual([redrawn.winnerIds, redrawn.rerolledBy], [['a'], 'mod']);
});

test('stored giveaways as map, array or envelope', () => {
  const g = { messageId: '1' };
  assert.deepEqual(toGiveawayList({ 1: g }), [g]);
  assert.deepEqual(toGiveawayList([g, null, { prize: 'ohne id' }]), [g]);
  assert.deepEqual(toGiveawayList({ ok: true, value: { 1: g } }), [g]);
  assert.deepEqual(toGiveawayList(null), []);
});
