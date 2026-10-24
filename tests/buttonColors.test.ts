// No grey buttons: Secondary buttons get red, green or blurple by their action; other styles stay as set.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ButtonBuilder, ButtonStyle } from 'discord.js';
import { actionStyle } from '../src/utils/buttonColors.js';

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
