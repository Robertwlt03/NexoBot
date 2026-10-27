import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { BADGE_GLYPHS, RARITIES } from '../src/shared/cosmetics.js';
import { EMBLEM_BOX, EMBLEM_FIELD, EMBLEM_LIFT, drawEmblem, drawGlyph, emblemGlyphSize, emblemGlyphY, emblemPath } from '../src/shared/profileCard.js';

const SIZE = 120;
const C = 100;

/** Alpha channel of a 200×200 drawing. */
function alpha(draw: (ctx: never) => void): Uint8ClampedArray {
  const canvas = createCanvas(200, 200);
  const ctx = canvas.getContext('2d');
  draw(ctx as never);
  const data = ctx.getImageData(0, 0, 200, 200).data;
  return data.filter((_, i) => i % 4 === 3);
}

test('every badge symbol stays inside the field of every emblem shape', () => {
  const problems: string[] = [];
  for (const rarity of RARITIES) {
    const field = alpha((ctx: { translate(x: number, y: number): void; fillStyle: string; fill(): void }) => {
      ctx.translate(C, C);
      emblemPath(ctx as never, rarity, (SIZE / 2) * EMBLEM_FIELD);
      ctx.fillStyle = '#fff';
      ctx.fill();
    });
    for (const glyph of BADGE_GLYPHS) {
      const size = emblemGlyphSize(rarity, SIZE);
      const y = C + emblemGlyphY(rarity, SIZE);
      // The light symbol and its embossed shadow copy (as drawEmblem draws them).
      const mark = alpha((ctx) => {
        drawGlyph(ctx, glyph, C, y, size, '#fff');
        drawGlyph(ctx, glyph, C + SIZE * 0.02, y + SIZE * 0.03, size, '#fff');
      });
      let outside = 0;
      for (let i = 0; i < mark.length; i += 1) if (mark[i] > 40 && field[i] < 200) outside += 1;
      if (outside > 4) problems.push(`${rarity}/${glyph}: ${outside}px`);
    }
  }
  assert.deepEqual(problems, []);
});

test('an emblem with its shadow fits its own canvas (nothing cut off at the edges)', () => {
  const size = 60;
  const box = Math.round(size * EMBLEM_BOX);
  for (const rarity of RARITIES) {
    const canvas = createCanvas(box, box);
    const ctx = canvas.getContext('2d');
    drawEmblem(ctx as never, { glyph: 'star', color: '#F5C451', rarity }, box / 2, box / 2 - size * EMBLEM_LIFT, size);
    const data = ctx.getImageData(0, 0, box, box).data;
    const edge = (x: number, y: number) => data[(y * box + x) * 4 + 3];
    let touching = 0;
    for (let i = 0; i < box; i += 1) for (const a of [edge(i, 0), edge(i, box - 1), edge(0, i), edge(box - 1, i)]) if (a > 8) touching += 1;
    assert.equal(touching, 0, `${rarity} reaches the edge of its canvas`);
  }
});
