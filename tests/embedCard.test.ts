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

test('a card reads back as the embed it came from (tickets and panels rely on it)', async () => {
  const { cardToEmbed, messageEmbed } = await import('../src/utils/embedCard.js');
  const embed = createEmbed({
    title: 'Ticket #42', description: 'Bitte beschreib dein Anliegen.\nZweite Zeile', author: 'Support', color: 'ticket.open', footer: 'Ticket-ID 42',
    thumbnail: 'https://cdn.discordapp.com/embed/avatars/1.png',
    fields: [{ name: 'Status', value: 'Offen', inline: true }, { name: 'Übernommen von', value: 'Niemand', inline: true }, { name: 'Grund', value: 'Account gehackt:\nRollen weg' }],
  });
  const back = cardToEmbed(embedToCard(embed));
  assert.equal(back.title, 'Ticket #42');
  assert.equal(back.description, 'Bitte beschreib dein Anliegen.\nZweite Zeile');
  assert.deepEqual(back.fields, [{ name: 'Status', value: 'Offen', inline: true }, { name: 'Übernommen von', value: 'Niemand', inline: true }, { name: 'Grund', value: 'Account gehackt:\nRollen weg' }]);
  assert.equal(back.footer?.text, 'Ticket-ID 42');
  assert.equal(back.thumbnail?.url, 'https://cdn.discordapp.com/embed/avatars/1.png');
  assert.equal(back.color, 0x8fb36b);
  // Through a "message": classic embeds and cards both answer.
  const card = embedToCard(embed);
  assert.equal(messageEmbed({ flags: { has: (f: number) => f === MessageFlags.IsComponentsV2 }, components: [card] })?.title, 'Ticket #42');
  assert.equal(messageEmbed({ embeds: [embed.toJSON()] })?.fields.length, 3);
  assert.equal(messageEmbed({ flags: { has: () => false }, components: [] }), null);
});

test('posted files show up in the card and oversized messages stay embeds', () => {
  const payload = toCardPayload({ embeds: [createEmbed({ title: 'Transkript', image: 'attachment://karte.png' })], files: [{ attachment: Buffer.from(''), name: 'karte.png' }, { attachment: Buffer.from(''), name: 'transcript-42.html' }] });
  const json = JSON.stringify((payload.components[0] as { toJSON(): unknown }).toJSON());
  assert.equal((json.match(/attachment:\/\/karte\.png/g) ?? []).length, 1, 'image shown once');
  assert.match(json, /"type":13[^}]*attachment:\/\/transcript-42\.html|attachment:\/\/transcript-42\.html[^}]*"type":13/);
  const rows = Array.from({ length: 5 }, () => new ActionRowBuilder<ButtonBuilder>().addComponents(...Array.from({ length: 5 }, (_, i) => new ButtonBuilder().setCustomId(`b${Math.random()}${i}`).setLabel('x').setStyle(ButtonStyle.Secondary))));
  const big = toCardPayload({ embeds: [createEmbed({ title: 'Viel', fields: Array.from({ length: 12 }, (_, i) => ({ name: `F${i}`, value: 'v' })) })], components: rows });
  assert.ok('embeds' in big, 'should have stayed an embed');
});

test('cards only ping what the old content pinged – never the mentions inside the former embed', async () => {
  const { contentOnlyMentions } = await import('../src/utils/embedCard.js');
  const payload = toCardPayload({ content: 'Willkommen <@111>!', embeds: [createEmbed({ description: 'Frag <@&222> oder <@333>' })] });
  assert.deepEqual((payload as { allowedMentions?: unknown }).allowedMentions, { parse: [], users: ['111'], roles: [] });
  assert.deepEqual(contentOnlyMentions('', undefined), { parse: [], users: [], roles: [] });
  assert.deepEqual(contentOnlyMentions('<@1> <@&2> @here', { parse: ['users'] }), { parse: [], users: ['1'], roles: [] });
  assert.deepEqual(contentOnlyMentions('<@1> <@5>', { users: ['5'] }), { parse: [], users: ['5'], roles: [] });
  assert.deepEqual(contentOnlyMentions('@everyone <@&2>', { parse: ['everyone', 'roles'] }).parse, ['everyone']);
});

test('components-only edits keep the card and swap the rows', async () => {
  const { keepCards } = await import('../src/utils/embedCard.js');
  const card = embedToCard(createEmbed({ title: 'Karte' }));
  const oldRow = { type: 1, components: [] };
  const newRow = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('n').setLabel('Neu').setStyle(ButtonStyle.Secondary));
  const kept = keepCards({ components: [newRow] }, [card, oldRow]);
  assert.deepEqual(kept.components, [card, newRow]);
  assert.deepEqual(keepCards({ components: [] }, [card, oldRow]).components, [card]);
  assert.deepEqual(keepCards({ content: 'x' }, [card]), { content: 'x' });
});

test('ephemeral given by name or bitfield stays ephemeral', async () => {
  const { MessageFlagsBitField } = await import('discord.js');
  for (const flags of [['Ephemeral'], new MessageFlagsBitField(MessageFlags.Ephemeral), MessageFlags.Ephemeral]) {
    const payload = toCardPayload({ embeds: [createEmbed({ title: 'Nur für dich' })], flags });
    assert.ok(payload.flags & MessageFlags.Ephemeral, `lost ephemeral for ${JSON.stringify(flags)}`);
  }
});

test('review fixes: deferUpdate edits the clicked message, follow-ups do not mark the reply, edits keep the lead and never fall back', async () => {
  const { InteractionHelper } = await import('../src/utils/interactionHelper.js');
  const { cardMessageEdit } = await import('../src/utils/embedCard.js');
  const row = { type: 1 };
  const make = (cardMessage: boolean) => {
    const sent: Record<string, { flags?: number; embeds?: unknown[]; components?: unknown[]; content?: string }> = {};
    const fake = {
      id: '1', user: { id: '2' }, deferred: false, replied: false,
      message: { flags: { has: (flag: number) => cardMessage && flag === MessageFlags.IsComponentsV2 }, components: cardMessage ? [embedToCard(createEmbed({ title: 'Panel' })), row] : [row] },
      deferUpdate: async () => { fake.deferred = true; },
      deferReply: async () => { fake.deferred = true; },
      reply: async (o: never) => { sent.reply = o; fake.replied = true; },
      editReply: async (o: never) => { sent.editReply = o; },
      followUp: async (o: never) => { sent.followUp = o; },
      update: async (o: never) => { sent.update = o; },
      fetchReply: async () => ({ components: [row] }),
    };
    InteractionHelper.patchInteractionResponses(fake as never);
    return { fake, sent };
  };
  // deferUpdate on a classic embed message: the error edit stays an embed (no V2 flag on a classic message).
  const classic = make(false);
  await classic.fake.deferUpdate();
  await classic.fake.editReply({ embeds: [createEmbed({ title: 'Fehler' })] } as never);
  assert.ok(classic.sent.editReply.embeds, 'classic message got a card');
  // deferUpdate on a card message: becomes a card edit and keeps the rows.
  const card = make(true);
  await card.fake.deferUpdate();
  await card.fake.editReply({ embeds: [createEmbed({ title: 'Fehler' })] } as never);
  assert.ok(card.sent.editReply.components!.includes(row) && !card.sent.editReply.embeds);
  // reply with plain content, follow-up card, then edit of the reply: the reply stays plain.
  const plain = make(false);
  await plain.fake.reply({ content: 'Hallo' } as never);
  await plain.fake.followUp({ embeds: [createEmbed({ title: 'Info' })] } as never);
  await plain.fake.editReply({ embeds: [createEmbed({ title: 'Neu' })] } as never);
  assert.ok(plain.sent.editReply.embeds, 'plain reply was turned into a card by a follow-up');
  // Card edits keep the mention line and squeeze oversized edits instead of sending embeds to a card.
  const ticket = embedToCard(createEmbed({ title: 'Ticket #1' }), '<@1> <@&2>');
  const edited = cardMessageEdit({ embeds: [createEmbed({ title: 'Ticket #1', description: 'geschlossen' })] }, [ticket]) as { components: { toJSON(): unknown }[] };
  assert.match(JSON.stringify(edited.components[0].toJSON()), /<@1> <@&2>/);
  const huge = cardMessageEdit({ embeds: [createEmbed({ title: 'Viel', fields: Array.from({ length: 25 }, (_, i) => ({ name: `F${i}`, value: 'v' })) })], components: Array.from({ length: 5 }, () => new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`c${Math.random()}`).setLabel('x').setStyle(ButtonStyle.Secondary))) }, [ticket]) as { embeds?: unknown };
  assert.equal(huge.embeds, undefined, 'oversized edit fell back to embeds on a card');
});
