// Members' colour schemes: every scheme has a colour per role, and answers to a member are painted in theirs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ContainerBuilder, MediaGalleryBuilder, TextDisplayBuilder } from 'discord.js';
import { DEFAULT_MESSAGE_PALETTE, MESSAGE_ROLES, THEME_PRESETS, messagePalette, oklch, hueDistance } from '../src/shared/theme.js';
import { paintPayload } from '../src/utils/messagePalette.js';
import { renderBanner } from '../src/services/bannerArt.js';

const scheme = (id: string) => {
  const preset = THEME_PRESETS.find((p) => p.id === id)!;
  return { preset: id, primary: preset.primary, secondary: preset.secondary, mode: 'dark' as const };
};

test('the default scheme keeps the bot palette, every other one has a colour for each role', () => {
  assert.deepEqual(messagePalette(scheme('walnuss')), DEFAULT_MESSAGE_PALETTE);
  for (const preset of THEME_PRESETS) {
    const palette = messagePalette(scheme(preset.id));
    for (const role of MESSAGE_ROLES) assert.match(palette[role], /^#[0-9a-f]{6}$/, `${preset.id} ${role}`);
  }
  const ocean = messagePalette(scheme('ozean'));
  assert.equal(ocean.nexo, '#60a5fa');
  // Danger stays red and success green, whatever the scheme.
  assert.ok(hueDistance(oklch(ocean.danger)[2], 25) < 15);
  assert.ok(hueDistance(oklch(ocean.success)[2], 150) < 15);
});

test('cards take the scheme colour of their role, banners follow, other pictures stay', () => {
  const card = new ContainerBuilder().setAccentColor(0xEF4444)
    .addMediaGalleryComponents(new MediaGalleryBuilder().addItems({ media: { url: 'https://nexo.example/dashboard/banners/danger.png?c=ef4444&v=2' } }))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('Fehler'))
    .addMediaGalleryComponents(new MediaGalleryBuilder().addItems({ media: { url: 'https://example.com/card.png' } }));
  const palette = messagePalette(scheme('ozean'));
  const painted = paintPayload({ components: [card], embeds: [{ title: 'x', color: 0x8FB36B }] }, palette);
  const json = painted.components[0] as { accent_color: number; components: { items?: { media: { url: string } }[] }[] };
  const danger = Number.parseInt(palette.danger.slice(1), 16);
  assert.equal(json.accent_color, danger);
  assert.match(json.components[0].items![0].media.url, new RegExp(`danger\\.png\\?c=${palette.danger.slice(1)}&v=2`));
  assert.equal(json.components[2].items![0].media.url, 'https://example.com/card.png');
  assert.equal((painted.embeds[0] as { color: number }).color, 0x60a5fa);
});

test('banners render as PNG in any colour', async () => {
  const png = await renderBanner('gift', 0x60a5fa);
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
});
