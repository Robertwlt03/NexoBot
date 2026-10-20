import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { BADGE_GLYPHS, type ProfileCardSubject, type ResolvedCosmetics } from '../src/shared/cosmetics.js';
import {
  FRAME_MAX_OUTSET, GLYPH_DRAWERS, LEVELUP_CARD_HEIGHT, LEVELUP_CARD_WIDTH, LEVELUP_STYLES, PROFILE_CARD_HEIGHT, PROFILE_CARD_WIDTH,
  ITEM_PREVIEW_HEIGHT, ITEM_PREVIEW_WIDTH, PROFILE_FONTS, PROFILE_LAYOUTS, createRng, stickerRadius, drawGlyph, fitText, profileGeometry,
  renderItemPreview, renderLevelUpCard, renderProfileCard,
  seedFrom, stickerCenter, xpFraction,
} from '../src/shared/profileCard.js';
import { CARD_FONTS, defaultCard } from '../src/shared/welcomeCard.js';
import { applyMemberStyle } from '../src/services/welcomeCardRenderer.js';
import { SEED_ITEMS } from '../src/services/cosmetics/catalog.js';

const W = PROFILE_CARD_WIDTH;
const H = PROFILE_CARD_HEIGHT;
const empty = (): ResolvedCosmetics => ({
  background: null, accent: null, nameStyle: null, frame: null, badges: [], title: null, xpBar: null, font: null, effect: null, levelup: null, layout: null, sticker: null,
});
const subject: ProfileCardSubject = {
  name: 'Lena', username: 'lena', avatarUrl: null, bio: 'Hallo!', level: 12, xp: 300, xpNeeded: 1370, rank: 2, serverName: 'Nexo', balance: 1234,
};

test('every badge glyph has a vector drawer that paints something', () => {
  assert.deepEqual(Object.keys(GLYPH_DRAWERS).sort(), [...BADGE_GLYPHS].sort());
  for (const glyph of BADGE_GLYPHS) {
    const canvas = createCanvas(32, 32);
    const ctx = canvas.getContext('2d');
    drawGlyph(ctx, glyph, 16, 16, 24, '#FFFFFF');
    const alpha = ctx.getImageData(0, 0, 32, 32).data.filter((_, index) => index % 4 === 3);
    assert.ok(alpha.some((value) => value > 0), `${glyph} draws nothing`);
  }
});

test('seeds and the PRNG are deterministic', () => {
  assert.equal(seedFrom('lena'), seedFrom('lena'));
  assert.notEqual(seedFrom('lena'), seedFrom('max'));
  const a = createRng(seedFrom('lena'));
  const b = createRng(seedFrom('lena'));
  const values = Array.from({ length: 50 }, () => a());
  assert.deepEqual(values, Array.from({ length: 50 }, () => b()));
  assert.ok(values.every((value) => value >= 0 && value < 1));
  assert.notDeepEqual(values.slice(0, 5), Array.from({ length: 5 }, createRng(seedFrom('max'))));
});

test('layout geometry stays inside the card and clear of stickers', () => {
  const inside = (x: number, y: number, w: number, h: number) => x >= 0 && y >= 0 && x + w <= W && y + h <= H;
  for (const layout of PROFILE_LAYOUTS) {
    const g = profileGeometry(layout);
    const { cx, cy, r } = g.avatar;
    const outer = r + FRAME_MAX_OUTSET;
    assert.ok(inside(cx - outer, cy - outer, outer * 2, outer * 2), `${layout}: avatar + frame`);
    assert.ok(inside(g.xp.x, g.xp.y, g.xp.w, g.xp.h), `${layout}: xp bar`);
    assert.ok(g.text.maxWidth >= 500, `${layout}: text column`);
    assert.ok(g.text.nameY < g.text.titleY && g.text.titleY < g.text.bioY && g.text.bioY < g.xp.y, `${layout}: text order`);
    for (const corner of ['tl', 'tr', 'bl', 'br'] as const) {
      const s = stickerCenter(corner);
      assert.ok(Math.hypot(s.x - cx, s.y - cy) > outer + stickerRadius(corner), `${layout}: sticker ${corner} overlaps avatar`);
      const nearestX = Math.min(Math.max(s.x, g.xp.x), g.xp.x + g.xp.w);
      const nearestY = Math.min(Math.max(s.y, g.xp.y), g.xp.y + g.xp.h);
      assert.ok(Math.hypot(s.x - nearestX, s.y - nearestY) > stickerRadius(corner), `${layout}: sticker ${corner} overlaps xp bar`);
    }
  }
});

test('xp fraction and text fitting', () => {
  assert.equal(xpFraction(50, 100), 0.5);
  assert.equal(xpFraction(500, 100), 1);
  assert.equal(xpFraction(-5, 100), 0);
  assert.equal(xpFraction(5, 0), 0);

  // Fake measure: every character is half the font size wide.
  const ctx = { font: '', measureText(text: string) { return { width: Array.from(text).length * Number(/(\d+)px/.exec(this.font)?.[1]) * 0.5 }; } };
  assert.deepEqual(fitText(ctx, 'abcd', 'inter', 700, 40, 20, 100), { text: 'abcd', size: 40 });
  assert.deepEqual(fitText(ctx, 'abcdefgh', 'inter', 700, 40, 20, 100), { text: 'abcdefgh', size: 25 });
  const cut = fitText(ctx, 'a'.repeat(30), 'inter', 700, 40, 20, 100);
  assert.equal(cut.size, 20);
  assert.ok(cut.text.endsWith('…') && ctx.measureText(cut.text).width <= 100);
});

test('profile fonts match the bundled card fonts', () => {
  for (const [key, family] of Object.entries(PROFILE_FONTS)) assert.equal(family, CARD_FONTS[key as keyof typeof CARD_FONTS].family);
});

test('cards render deterministically for every layout and level-up style', () => {
  const render = (cosmetics: ResolvedCosmetics) => {
    const canvas = createCanvas(W, H);
    renderProfileCard(canvas.getContext('2d'), subject, cosmetics, { avatar: null });
    return canvas.toBuffer('image/png');
  };
  for (const layout of PROFILE_LAYOUTS) {
    const cosmetics = { ...empty(), layout: { layout }, effect: { effect: 'confetti' as const } };
    assert.ok(render(cosmetics).equals(render(cosmetics)), `${layout} differs between renders`);
  }
  for (const style of LEVELUP_STYLES) {
    const canvas = createCanvas(LEVELUP_CARD_WIDTH, LEVELUP_CARD_HEIGHT);
    renderLevelUpCard(canvas.getContext('2d'), subject, { ...empty(), levelup: { style, color: '#A99BFF' } }, 13, 98, { avatar: null });
  }
});

test('member style maps frame/accent onto the welcome card avatar border', () => {
  const card = defaultCard();
  const avatar = (c: typeof card) => c.layers.find((layer) => layer.type === 'avatar');
  assert.equal(applyMemberStyle(card, null, null), card);
  const framed = avatar(applyMemberStyle(card, { style: 'neon', colors: ['#22D3EE'], width: 8 }, { color: '#FF0000' }));
  assert.ok(framed?.type === 'avatar' && framed.borderColor === '#22D3EE' && framed.borderWidth === 11);
  const accented = avatar(applyMemberStyle(card, null, { color: '#FF0000' }));
  assert.ok(accented?.type === 'avatar' && accented.borderColor === '#FF0000' && accented.borderWidth === 8);
});

test('shop tiles are painted by the card renderer for every item that shows on the card', () => {
  for (const item of SEED_ITEMS) {
    const canvas = createCanvas(ITEM_PREVIEW_WIDTH, ITEM_PREVIEW_HEIGHT);
    const ctx = canvas.getContext('2d');
    const painted = renderItemPreview(ctx, item, subject, { avatar: null });
    // Level-up styles and layouts are not part of one spot on the card; the dashboard sketches those itself.
    assert.equal(painted, item.slot !== 'levelup' && item.slot !== 'layout', item.id);
    if (!painted) continue;
    const alpha = ctx.getImageData(0, 0, ITEM_PREVIEW_WIDTH, ITEM_PREVIEW_HEIGHT).data.filter((_, index) => index % 4 === 3);
    assert.ok(alpha.some((value) => value > 0), `${item.id} paints nothing`);
  }
});

