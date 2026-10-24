// No grey buttons: Secondary buttons get red, green or blurple by their action; other styles stay as set.
// No emojis on buttons except link buttons.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ButtonBuilder, ButtonStyle } from 'discord.js';
import { actionStyle, plainLabel } from '../src/utils/buttonColors.js';

test('actions map to colours', () => {
  assert.equal(actionStyle('Ausnahmen löschen'), ButtonStyle.Danger);
  assert.equal(actionStyle('Abbrechen', 'eb_reorder_cancel'), ButtonStyle.Danger);
  assert.equal(actionStyle('', 'ticket_feedback_decline:1:2'), ButtonStyle.Danger);
  assert.equal(actionStyle('Übernehmen', 'ticket_claim'), ButtonStyle.Success);
  assert.equal(actionStyle('Speichern'), ButtonStyle.Success);
  assert.equal(actionStyle('Freigeben', 'ticket_unclaim'), ButtonStyle.Primary);
  assert.equal(actionStyle('Weiter ➡️', 'next_page'), ButtonStyle.Primary);
  assert.equal(actionStyle('Senden', 'send_message'), ButtonStyle.Primary);
});

test('grey buttons are coloured when serialised, customIds and other styles stay', () => {
  const grey = new ButtonBuilder().setCustomId('shop_next').setLabel('Weiter').setStyle(ButtonStyle.Secondary).toJSON();
  assert.equal(grey.style, ButtonStyle.Primary);
  assert.equal('custom_id' in grey && grey.custom_id, 'shop_next');
  const red = new ButtonBuilder().setCustomId('x_delete').setLabel('Löschen').setStyle(ButtonStyle.Secondary).toJSON();
  assert.equal(red.style, ButtonStyle.Danger);
  const set = new ButtonBuilder().setCustomId('giveaway_join').setLabel('Teilnehmen').setStyle(ButtonStyle.Primary).toJSON();
  assert.equal(set.style, ButtonStyle.Primary);
  const link = new ButtonBuilder().setURL('https://example.com').setLabel('Zum Shop').setStyle(ButtonStyle.Link).toJSON();
  assert.equal(link.style, ButtonStyle.Link);
});

test('emojis only on link buttons', () => {
  assert.equal(plainLabel('🎉 Teilnehmen'), 'Teilnehmen');
  assert.equal(plainLabel('Weiter ➡️'), 'Weiter');
  assert.equal(plainLabel('🗑️ Löschen'), 'Löschen');
  assert.equal(plainLabel('🇩🇪 Deutsch'), 'Deutsch');
  assert.equal(plainLabel('⏭️'), null);
  assert.equal(plainLabel('‹'), '‹');
  const join = new ButtonBuilder().setCustomId('giveaway_join').setLabel('🎉 Teilnehmen').setEmoji('✅').setStyle(ButtonStyle.Success).toJSON();
  assert.equal(join.label, 'Teilnehmen');
  assert.equal(join.emoji, undefined);
  assert.equal('custom_id' in join && join.custom_id, 'giveaway_join');
  const onlyEmoji = new ButtonBuilder().setCustomId('react').setEmoji('👍').setStyle(ButtonStyle.Secondary).toJSON();
  assert.equal(onlyEmoji.emoji?.name, '👍');
  const link = new ButtonBuilder().setURL('https://example.com').setLabel('🛒 Zum Shop').setEmoji('🛒').setStyle(ButtonStyle.Link).toJSON();
  assert.equal(link.label, '🛒 Zum Shop');
  assert.equal(link.emoji?.name, '🛒');
});
