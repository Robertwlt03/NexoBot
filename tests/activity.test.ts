import { test } from 'node:test';
import assert from 'node:assert/strict';
import { messageCounters, nextChatStreak } from '../src/services/cosmetics/activity.js';
import { ACHIEVEMENTS } from '../src/services/cosmetics/achievements.js';
import { ACHIEVEMENT_BADGES, SEED_ITEMS } from '../src/services/cosmetics/catalog.js';

const plain = { reply: false, media: false };
// Berlin is UTC+2 in summer (CEST) and UTC+1 in winter.
const at = (iso: string) => new Date(iso);

test('messages move the counters of their time of day and kind', () => {
  assert.deepEqual(messageCounters('hallo', at('2026-07-08T10:00:00Z'), plain), ['messages']);
  assert.ok(messageCounters('noch wach', at('2026-07-08T00:30:00Z'), plain).includes('msg_night')); // 02:30 Berlin
  assert.ok(messageCounters('Guten Morgen zusammen', at('2026-07-08T04:15:00Z'), plain).includes('msg_early')); // 06:15
  assert.ok(messageCounters('Guten Morgen zusammen', at('2026-07-08T04:15:00Z'), plain).includes('msg_morning'));
  assert.ok(messageCounters('punkt', at('2026-01-14T23:00:30Z'), plain).includes('msg_midnight')); // 00:00 Berlin (CET)
  assert.ok(messageCounters('leet', at('2026-07-08T11:37:10Z'), plain).includes('msg_leet')); // 13:37
  assert.ok(messageCounters('samstag', at('2026-07-11T12:00:00Z'), plain).includes('msg_weekend'));
  assert.ok(messageCounters('WAS IST HIER LOS', at('2026-07-08T10:00:00Z'), plain).includes('msg_caps'));
  assert.ok(!messageCounters('OK', at('2026-07-08T10:00:00Z'), plain).includes('msg_caps'));
  assert.deepEqual(messageCounters('wer kommt mit? 🎉 https://x.de', at('2026-07-08T10:00:00Z'), { reply: true, media: true }).sort(),
    ['messages', 'msg_emoji', 'msg_link', 'msg_media', 'msg_reply'].sort());
});

test('the chat streak grows on consecutive days and restarts after a gap', () => {
  const start = { chat_days: 0, chat_streak: 0, chat_streak_best: 0, chat_last_day: 0 };
  const day1 = nextChatStreak(start, 100);
  assert.deepEqual(day1, { chat_days: 1, chat_streak: 1, chat_streak_best: 1, chat_last_day: 100 });
  assert.equal(nextChatStreak(day1, 100), day1);
  const day2 = nextChatStreak(day1, 101);
  assert.equal(day2.chat_streak, 2);
  const gap = nextChatStreak(day2, 105);
  assert.deepEqual(gap, { chat_days: 3, chat_streak: 1, chat_streak_best: 2, chat_last_day: 105 });
});

test('about 70+ achievements, each with its own badge and title item', () => {
  assert.ok(ACHIEVEMENTS.length >= 70);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  assert.equal(new Set(ACHIEVEMENT_BADGES.map((a) => a.title)).size, ACHIEVEMENT_BADGES.length);
  const ids = new Set(SEED_ITEMS.map((item) => item.id));
  for (const a of ACHIEVEMENTS) {
    assert.ok(ids.has(`ach-${a.id}`) && ids.has(`ach-title-${a.id}`), a.id);
    assert.ok(a.target >= 1 && a.reward > 0, a.id);
  }
});
