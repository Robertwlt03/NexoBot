// Embed → Nexo card adapter: every part of an embed lands in the card, payloads become V2 and stay within limits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { createEmbed } from '../src/utils/embeds.js';
import { embedToCard, toCardPayload } from '../src/utils/embedCard.js';

const texts = (json: { components: { type: number; content?: string; components?: { content?: string }[] }[] }) =>
  json.components.flatMap((c) => (c.type === 10 ? [c.content!] : c.type === 9 ? c.components!.map((t) => t.content!) : []));

test('title, author, description, fields, thumbnail, image and footer all arrive', () => {
  const embed = createEmbed({
    title: '🎉 Gewinnspiel', description: 'Mach mit!', author: 'Giveaways', color: 'primary',
    fields: [{ name: 'Preis', value: 'Nitro', inline: true }, { name: 'Endet', value: 'morgen', inline: true }, { name: 'Regeln', value: 'Eine Teilnahme pro Person' }],
    thumbnail: 'https://cdn.discordapp.com/embed/avatars/0.png', image: 'https://example.com/banner.png', footer: 'Endet bald',
  });
  const json = embedToCard(embed).toJSON() as never as { accent_color: number; components: { type: number; content?: string; components?: { content?: string }[] }[] };
  const all = texts(json).join('\n');
  assert.match(all, /-# GIVEAWAYS\n## 🎉 Gewinnspiel/);
  assert.match(all, /Mach mit!/);
  assert.match(all, /\*\*Preis:\*\* Nitro\n\*\*Endet:\*\* morgen/);
  assert.match(all, /\*\*Regeln\*\*\nEine Teilnahme pro Person/);
  assert.equal(json.accent_color, 0x8fb36b);
  assert.ok(json.components.some((c) => c.type === 9), 'thumbnail section');
  assert.ok(json.components.some((c) => c.type === 12), 'image gallery');
});

test('payloads become V2, keep rows and the ephemeral flag, content moves into the card', () => {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('x').setLabel('OK').setStyle(ButtonStyle.Primary));
  const payload = toCardPayload({ content: '<@1>', embeds: [createEmbed({ title: 'Hallo', description: 'Text' })], components: [row], flags: MessageFlags.Ephemeral });
  assert.equal(payload.flags & MessageFlags.IsComponentsV2, MessageFlags.IsComponentsV2);
  assert.equal(payload.flags & MessageFlags.Ephemeral, MessageFlags.Ephemeral);
  assert.equal(payload.components.length, 2);
  assert.ok(!('content' in payload) && !('embeds' in payload));
  assert.match(JSON.stringify((payload.components[0] as { toJSON(): unknown }).toJSON()), /<@1>/);
});

test('very long embeds are cut to the V2 text budget', () => {
  const long = createEmbed({ title: 'Liste', description: 'x'.repeat(4000), fields: Array.from({ length: 25 }, (_, i) => ({ name: `Feld ${i}`, value: 'y'.repeat(900) })) });
  const all = texts(embedToCard(long).toJSON() as never).join('');
  assert.ok(all.length <= 4000, String(all.length));
});

test('interaction replies, edits, follow-ups and card updates go out as cards; plain posts stay', async () => {
  const { InteractionHelper } = await import('../src/utils/interactionHelper.js');
  const sent: Record<string, { flags?: number; embeds?: unknown[]; components?: unknown[] }> = {};
  const row = { type: 1 };
  const fake = {
    id: '1', user: { id: '2' }, deferred: false, replied: false,
    message: { flags: { has: (flag: number) => flag === MessageFlags.IsComponentsV2 }, components: [{ type: 17 }, row] },
    reply: async (o: never) => { sent.reply = o; fake.replied = true; },
    editReply: async (o: never) => { sent.editReply = o; },
    followUp: async (o: never) => { sent.followUp = o; },
    update: async (o: never) => { sent.update = o; },
    fetchReply: async () => ({ components: [row] }),
  };
  InteractionHelper.patchInteractionResponses(fake as never);
  const embed = () => createEmbed({ title: 'Hallo', description: 'Text' });
  await fake.reply({ embeds: [embed()], flags: MessageFlags.Ephemeral } as never);
  await fake.editReply({ embeds: [embed()] } as never);
  await fake.followUp({ embeds: [embed()] } as never);
  await fake.update({ embeds: [embed()] } as never);
  for (const kind of ['reply', 'editReply', 'followUp', 'update']) {
    assert.ok((sent[kind].flags! & MessageFlags.IsComponentsV2) !== 0, `${kind} is not a card`);
    assert.equal(sent[kind].embeds, undefined, `${kind} still has embeds`);
  }
  assert.ok(sent.reply.flags! & MessageFlags.Ephemeral, 'reply lost ephemeral');
  assert.ok(sent.editReply.components!.includes(row) && sent.update.components!.includes(row), 'rows were dropped');
  await fake.reply('nur Text' as never);
});
