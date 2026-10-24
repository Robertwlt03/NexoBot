// Nexo's emoji rule for embeds: one leading accent in titles, coins kept, everything else calm.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeEmbedText } from '../src/utils/embeds.js';

test('titles keep one leading emoji, bodies none – coins always stay', () => {
  assert.equal(sanitizeEmbedText('🎉 Gewinnspiel 🎁 gestartet', { keepLeadingEmoji: true }), '🎉 Gewinnspiel gestartet');
  assert.equal(sanitizeEmbedText('⚠️ Achtung', { keepLeadingEmoji: true }), '⚠️ Achtung');
  assert.equal(sanitizeEmbedText('Ohne 🎉 Emoji', { keepLeadingEmoji: true }), 'Ohne Emoji');
  assert.equal(sanitizeEmbedText('🎉 Text mit 🔥 Deko'), 'Text mit Deko');
  assert.equal(sanitizeEmbedText('Du hast 🟡 1 ⚪ 28 🟤 5'), 'Du hast 🟡 1 ⚪ 28 🟤 5');
  assert.equal(sanitizeEmbedText('Custom <:berni_gold_v1:123> bleibt'), 'Custom <:berni_gold_v1:123> bleibt');
});
