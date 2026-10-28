import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { renderEventBanner } from '../src/services/cosmetics/botProfile.js';

test('event banner is drawn on the walnut at Discord size', async () => {
  const event = { id: 'halloween', name: 'Halloween', description: '', startsAt: '', endsAt: '', discount: 15, slots: null, kind: 'auto' as const, active: true };
  const image = await loadImage(await renderEventBanner(event));
  assert.deepEqual([image.width, image.height], [960, 384]);
  // Middle of the banner: wood (a warm brown), not the flat event colour of the fallback.
  const ctx = createCanvas(960, 384).getContext('2d');
  ctx.drawImage(image, 0, 0);
  const [r, g, b] = ctx.getImageData(480, 300, 1, 1).data;
  assert.ok(r > g && g > b, `expected wood at the centre, got ${r},${g},${b}`);
});

test('the brush paints the frame and leaves the middle bare', async () => {
  const { brush } = await import('../src/services/cosmetics/brush.js');
  const W = 200;
  const H = 100;
  const wood = () => Uint8ClampedArray.from({ length: W * H * 4 }, (_, i) => (i % 4 === 3 ? 255 : 90));
  const data = wood();
  let seed = 1;
  brush(W, H, () => ((seed = (seed * 16807) % 2147483647) / 2147483647)).frame(data, '#ff0000');
  const red = (x: number, y: number) => data[(y * W + x) * 4] - data[(y * W + x) * 4 + 1];
  const edge = Array.from({ length: W }, (_, x) => red(x, 1)).filter((d) => d > 20).length;
  assert.ok(edge > W * 0.4, `most of the top edge is painted (${edge}/${W})`);
  assert.equal(red(W / 2, H / 2), 0, 'the middle stays wood');
});

test('the uploaded profile banners come in Discord\'s 17:6 at twice the size', async () => {
  const { renderProfileBanner } = await import('../src/services/cosmetics/profileArt.js');
  const image = await loadImage(await renderProfileBanner({ format: 'app', seed: 'nexo-test', tint: '#FFC400', tag: 'TEST' }));
  assert.deepEqual([image.width, image.height], [1360, 480]);
});
