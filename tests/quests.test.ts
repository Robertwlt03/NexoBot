// Daily quests: a stable pick of three different tasks per member and day, and progress from today's counters.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTS, QUESTS_PER_DAY, questProgress, questsFor } from '../src/services/cosmetics/quests.js';

test('three different quests per member and day, the same every time', () => {
  const picks = new Set<string>();
  for (let user = 0; user < 200; user += 1) {
    const quests = questsFor(`1000000000000000${user}`, '2026-10-23');
    assert.equal(quests.length, QUESTS_PER_DAY);
    assert.equal(new Set(quests.map((q) => q.counters[0])).size, QUESTS_PER_DAY, 'two quests watch the same counter');
    assert.deepEqual(questsFor(`1000000000000000${user}`, '2026-10-23'), quests);
    quests.forEach((q) => picks.add(q.id));
  }
  assert.equal(picks.size, QUESTS.length, 'some quest never comes up');
  const ids = (day: string) => questsFor('123456789012345678', day).map((q) => q.id).join();
  assert.ok(new Set(['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26'].map(ids)).size > 1, 'the quests never change');
});

test('progress sums the counters, caps at the target and keeps paid quests done', () => {
  const games = QUESTS.find((q) => q.id === 'games')!;
  const chat = QUESTS.find((q) => q.id === 'chat')!;
  const [g, c] = questProgress([games, chat], new Map([['game_fish', 1], ['game_roll', 1], ['messages', 40]]), new Set());
  assert.deepEqual([g.current, g.done], [2, false]);
  assert.deepEqual([c.current, c.done], [25, true]);
  assert.equal(questProgress([games], new Map(), new Set(['games']))[0].done, true);
});
