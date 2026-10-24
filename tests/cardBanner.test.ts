// Card banners: one picture per accent colour on top of every Nexo card, only with a public https dashboard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bannerName, cardBanner } from '../src/utils/cardBanner.js';
import { cardToEmbed, embedToCard } from '../src/utils/embedCard.js';
import { createEmbed } from '../src/utils/embeds.js';
import { nexoCard } from '../src/utils/nexoMessage.js';

type Json = { components: { type: number; id?: number; items?: { media: { url: string } }[] }[] };

function withDashboard<T>(url: string | undefined, run: () => T): T {
  const before = process.env.DASHBOARD_URL;
  if (url === undefined) delete process.env.DASHBOARD_URL;
  else process.env.DASHBOARD_URL = url;
  try {
    return run();
  } finally {
    if (before === undefined) delete process.env.DASHBOARD_URL;
    else process.env.DASHBOARD_URL = before;
  }
}

test('each colour gets the closest banner', () => {
  assert.equal(bannerName(0x8FB36B), 'nexo');
  assert.equal(bannerName(0xF5C451), 'gold');
  assert.equal(bannerName(0xEF4444), 'danger');
  assert.equal(bannerName(0xED4245), 'danger');
  assert.equal(bannerName(0x99AAB5), 'calm');
  assert.equal(bannerName(0xF472B6), 'pink');
});

test('banners only come from a public https dashboard', () => {
  assert.equal(cardBanner(0x8FB36B, { baseUrl: 'http://localhost:3000' }), null);
  assert.equal(cardBanner(0x8FB36B, { baseUrl: '' }), null);
  assert.equal(cardBanner(0xF5C451, { baseUrl: 'https://nexo.example/' }), 'https://nexo.example/dashboard/banners/gold.png?v=1');
});

test('converted embeds open with the banner and read back without it', () => {
  const json = withDashboard('https://nexo.example', () => embedToCard(createEmbed({ title: 'Kontostand', description: 'Text', color: 'economy' })).toJSON()) as never as Json;
  assert.equal(json.components[0].type, 12);
  assert.equal(json.components[0].id, 5);
  assert.match(json.components[0].items![0].media.url, /banners\/gold\.png/);
  const back = cardToEmbed(json);
  assert.equal(back.title, 'Kontostand');
  assert.equal(back.image, undefined);
});

test('cards with a picture of their own and local dashboards get no banner', () => {
  const withImage = withDashboard('https://nexo.example', () => embedToCard(createEmbed({ title: 'Willkommen', image: 'https://example.com/card.png' })).toJSON()) as never as Json;
  assert.equal(withImage.components.filter((c) => c.type === 12).length, 1);
  const local = withDashboard('http://localhost:3000', () => embedToCard(createEmbed({ title: 'Hallo', description: 'Text' })).toJSON()) as never as Json;
  assert.ok(!local.components.some((c) => c.type === 12));
});

test('Nexo cards open with the banner unless they start with a picture', () => {
  const plain = withDashboard('https://nexo.example', () => nexoCard({ title: 'Tagesaufgaben', blocks: [{ text: 'Los geht’s' }] }).toJSON()) as never as Json;
  assert.equal(plain.components[0].type, 12);
  const picture = withDashboard('https://nexo.example', () => nexoCard({ blocks: [{ images: ['attachment://profil.png'] }] }).toJSON()) as never as Json;
  assert.equal(picture.components.length, 1);
});

test('giveaways carry the gift banner, running and ended', async () => {
  const { createGiveawayEmbed } = await import('../src/services/giveawayService.js');
  const giveaway = { prize: 'Nitro', hostId: '1', winnerCount: 1, participants: [], endsAt: Date.now() + 60_000 } as never;
  const url = (status: string) => (withDashboard('https://nexo.example', () => embedToCard(createGiveawayEmbed(giveaway, status)).toJSON()) as never as Json).components[0].items![0].media.url;
  assert.match(url('active'), /banners\/gift\.png/);
  assert.match(url('ended'), /banners\/giftEnded\.png/);
});

test('daily quests carry their own banner', () => {
  const json = withDashboard('https://nexo.example', () => nexoCard({ kicker: 'Tagesaufgaben', blocks: [{ text: 'x' }], banner: 'quests' }).toJSON()) as never as Json;
  assert.match(json.components[0].items![0].media.url, /banners\/quests\.png/);
});
