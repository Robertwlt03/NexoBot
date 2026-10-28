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
