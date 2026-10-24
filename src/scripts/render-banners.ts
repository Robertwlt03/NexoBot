// Renders the banners on top of every Nexo card (dashboard/public/banners/<name>.png): walnut wood, the Nexo coin,
// a glow and a large line motif in the card's accent colour. Run after changing the look:
//   npx tsx src/scripts/render-banners.ts
// The PNGs are committed; utils/cardBanner.ts picks one by the card's accent colour.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage, Path2D } from '@napi-rs/canvas';
import { BANNERS } from '../utils/cardBanner.js';

const W = 1200;
const H = 300;
const root = path.resolve(import.meta.dirname, '../..');
const out = path.join(root, 'dashboard/public/banners');

/** Line motifs on the dashboard's 24px icon grid. */
const MOTIFS: Record<keyof typeof BANNERS, string> = {
  nexo: 'M5 19c0-8 6-14 14-14 0 8-6 14-14 14zM5 19l9-9',
  amber: 'M14.5 3.5l6 6M12 6l6 6M9.5 8.5l6 6M4 20l7-7M13 4l7 7-3 3-7-7z',
  gold: 'M3 7a6 3 0 1 0 12 0a6 3 0 1 0-12 0M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7M9 15v2c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.7-2.7-3-6-3',
  success: 'M2.5 12a9.5 9.5 0 1 0 19 0a9.5 9.5 0 1 0-19 0M7.5 12.5l3 3 6-6.5',
  info: 'M2.5 12a9.5 9.5 0 1 0 19 0a9.5 9.5 0 1 0-19 0M12 11v6M12 7.5v.5',
  warn: 'M12 3l10 18H2zM12 10v5M12 18v.5',
  danger: 'M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6zM9 9l6 6M15 9l-6 6',
  calm: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5',
  pink: 'M4 21V13a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8M4 16c1.5 1 3 1 4 0s2.5-1 4 0 3 1 4 0 2.5-1 4 0M2 21h20M12 11V7M12 7c-1.2 0-2-.8-2-2s2-3 2-3 2 1.8 2 3-.8 2-2 2z',
};

const rgba = (color: number, alpha: number) => `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${alpha})`;
/** The colour mixed with white by `amount` (0–1). */
const lighten = (color: number, amount: number) => [16, 8, 0]
  .map((shift) => { const channel = (color >> shift) & 255; return Math.round(channel + (255 - channel) * amount) << shift; })
  .reduce((sum, part) => sum | part, 0);

/** Deterministic noise, so every render of a banner is identical. */
function random(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

const logo = await loadImage(readFileSync(path.join(root, 'dashboard/public/nexo.svg')));
mkdirSync(out, { recursive: true });

for (const [name, accent] of Object.entries(BANNERS) as [keyof typeof BANNERS, number][]) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const rand = random(7);

  // Walnut base.
  const base = ctx.createLinearGradient(0, 0, W, H);
  base.addColorStop(0, '#22170F');
  base.addColorStop(0.5, '#2E1F14');
  base.addColorStop(1, '#1A120C');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // Wood grain: soft wavy lines.
  for (let i = 0; i < 34; i++) {
    const y = (i / 34) * H + rand() * 8;
    ctx.beginPath();
    ctx.moveTo(-20, y);
    for (let x = 0; x <= W + 40; x += 60) ctx.quadraticCurveTo(x + 30, y + (rand() - 0.5) * 18, x + 60, y + (rand() - 0.5) * 6);
    ctx.strokeStyle = `rgba(255,214,170,${0.025 + rand() * 0.035})`;
    ctx.lineWidth = 1 + rand() * 1.5;
    ctx.stroke();
  }

  // Accent wash over the whole width, a strong glow on the right, soft light circles, warm glow behind the logo.
  const wash = ctx.createLinearGradient(0, 0, W, 0);
  wash.addColorStop(0, rgba(accent, 0.2));
  wash.addColorStop(1, rgba(accent, 0.38));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.76, H * 0.45, 0, W * 0.76, H * 0.45, W * 0.7);
  glow.addColorStop(0, rgba(accent, 0.75));
  glow.addColorStop(0.4, rgba(accent, 0.3));
  glow.addColorStop(1, rgba(accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.arc(W * 0.25 + rand() * W * 0.7, rand() * H, 24 + rand() * 60, 0, Math.PI * 2);
    ctx.fillStyle = rgba(accent, 0.04 + rand() * 0.06);
    ctx.fill();
  }
  const warm = ctx.createRadialGradient(150, H / 2, 0, 150, H / 2, 260);
  warm.addColorStop(0, 'rgba(232,163,61,0.22)');
  warm.addColorStop(1, 'rgba(232,163,61,0)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, W, H);

  // Sparkles scattered over the glow.
  for (let i = 0; i < 26; i++) {
    const x = W * 0.45 + rand() * W * 0.55;
    const y = rand() * H;
    ctx.beginPath();
    ctx.arc(x, y, 1 + rand() * 2.2, 0, Math.PI * 2);
    ctx.fillStyle = rgba(accent, 0.25 + rand() * 0.45);
    ctx.fill();
  }

  // Large line motif, slightly tilted.
  ctx.save();
  ctx.translate(W - 250, H / 2);
  ctx.rotate(-0.12);
  ctx.scale(11, 11);
  ctx.translate(-12, -12);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = rgba(accent, 1);
  ctx.shadowBlur = 36;
  ctx.strokeStyle = rgba(lighten(accent, 0.55), 0.95);
  ctx.stroke(new Path2D(MOTIFS[name]));
  ctx.restore();

  // Nexo coin.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 8;
  ctx.drawImage(logo, 64, (H - 190) / 2, 190, 190);
  ctx.restore();

  // Soft vignette top and bottom, accent line at the bottom edge.
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(0,0,0,0.28)');
  shade.addColorStop(0.3, 'rgba(0,0,0,0)');
  shade.addColorStop(0.75, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
  const line = ctx.createLinearGradient(0, 0, W, 0);
  line.addColorStop(0, rgba(accent, 0));
  line.addColorStop(0.35, rgba(accent, 0.9));
  line.addColorStop(1, rgba(accent, 0.2));
  ctx.fillStyle = line;
  ctx.fillRect(0, H - 6, W, 6);

  writeFileSync(path.join(out, `${name}.png`), await canvas.encode('png'));
}
console.log(`Rendered ${Object.keys(BANNERS).length} banners to ${path.relative(root, out)}`);
