// Bernis as coins: every amount is stored in bronze and shown in platinum, gold, silver and bronze (100 bronze =
// 1 silver, 100 silver = 1 gold, 100 gold = 1 platinum), each an octagonal token with the amber drop cut in. One geometry for every surface: the dashboard
// draws it as SVG, the profile and level-up cards on canvas, Discord messages use the text form.
// Import-free apart from the amber geometry (shared by the bot and the dashboard).

import { AMBER_DROP, type AmberContext, type AmberPath } from './amber.js';

export type CoinTier = 'platinum' | 'gold' | 'silver' | 'bronze';
export const COIN_TIERS: readonly { tier: CoinTier; value: number; label: string; emoji: string }[] = [
  { tier: 'platinum', value: 1_000_000, label: 'Platin', emoji: '💠' },
  { tier: 'gold', value: 10_000, label: 'Gold', emoji: '🟡' },
  { tier: 'silver', value: 100, label: 'Silber', emoji: '⚪' },
  { tier: 'bronze', value: 1, label: 'Bronze', emoji: '🟤' },
];

/** Platinum, gold, silver and bronze in an amount (absolute value); zero tiers are left out, 0 is "0 bronze". */
export function splitCoins(amount: number): { tier: CoinTier; count: number }[] {
  let rest = Math.floor(Math.abs(amount));
  const parts = COIN_TIERS.map(({ tier, value }) => {
    const count = Math.floor(rest / value);
    rest -= count * value;
    return { tier, count };
  }).filter((part) => part.count > 0);
  return parts.length ? parts : [{ tier: 'bronze', count: 0 }];
}

/** Discord text form, e.g. "🟡 1 ⚪ 28" (negative amounts get a minus in front). */
export function formatCoins(amount: number): string {
  const text = splitCoins(amount).map(({ tier, count }) => `${COIN_TIERS.find((t) => t.tier === tier)!.emoji} ${count}`).join(' ');
  return amount < 0 ? `−${text}` : text;
}

/** Metal per tier: the bevel light → deep, the rim, and the lit lower edge of the cut-in drop. */
export const COIN_COLORS: Record<CoinTier, { light: string; mid: string; deep: string; rim: string; shine: string }> = {
  // Cooler and brighter than silver, with a blue-white sheen.
  platinum: { light: '#FFFFFF', mid: '#C9D6E6', deep: '#5D7391', rim: '#3B4B63', shine: '#F2F8FF' },
  gold: { light: '#FFF1B0', mid: '#F2C14E', deep: '#A8740F', rim: '#7A520A', shine: '#FFF8DC' },
  silver: { light: '#FFFFFF', mid: '#D3D8DF', deep: '#7E8794', rim: '#5A626D', shine: '#FFFFFF' },
  bronze: { light: '#F6C9A0', mid: '#C98A55', deep: '#7A4A24', rim: '#5A3418', shine: '#FCE2C8' },
};

/**
 * Octagonal token in a 24×24 box: outer rim, the bevel (lit diagonally) and the inner field, as circumradii; the
 * amber drop is cut into the field (scale + offset) with a lit lower-right edge (`depth`).
 */
export const COIN = { box: 24, rim: 11.6, bevel: 10.44, field: 8.35, drop: { k: 0.5, x: 6, y: 5.95 }, depth: { x: 0.36, y: 0.48 } } as const;

/** Corners of a regular octagon around (cx, cy) with circumradius r (flat top and sides). */
export function octagon(cx: number, cy: number, r: number): [number, number][] {
  return Array.from({ length: 8 }, (_, i) => {
    const a = Math.PI / 8 + (i / 8) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
}

// ---------- Canvas ----------

function trace(ctx: AmberContext, path: AmberPath, ox: number, oy: number, k: number) {
  ctx.beginPath();
  for (const cmd of path) {
    if (cmd[0] === 'M') ctx.moveTo(ox + cmd[1] * k, oy + cmd[2] * k);
    else if (cmd[0] === 'L') ctx.lineTo(ox + cmd[1] * k, oy + cmd[2] * k);
    else if (cmd[0] === 'C') ctx.bezierCurveTo(ox + cmd[1] * k, oy + cmd[2] * k, ox + cmd[3] * k, oy + cmd[4] * k, ox + cmd[5] * k, oy + cmd[6] * k);
    else ctx.closePath();
  }
}

/** Draws a coin of `tier` centred on (cx, cy), `size` px wide. */
export function drawCoin(ctx: AmberContext, tier: CoinTier, cx: number, cy: number, size: number) {
  const c = COIN_COLORS[tier];
  const k = size / COIN.box;
  const ox = cx - size / 2;
  const oy = cy - size / 2;
  const oct = (r: number) => {
    ctx.beginPath();
    octagon(cx, cy, r * k).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };
  ctx.save();
  oct(COIN.rim);
  ctx.fillStyle = c.rim;
  ctx.fill();
  // The bevel catches the light diagonally, the field sits a little deeper.
  const bevel = ctx.createLinearGradient(cx - 12 * k, cy - 12 * k, cx + 12 * k, cy + 12 * k);
  bevel.addColorStop(0, c.light);
  bevel.addColorStop(0.5, c.mid);
  bevel.addColorStop(1, c.deep);
  oct(COIN.bevel);
  ctx.fillStyle = bevel;
  ctx.fill();
  const field = ctx.createRadialGradient(cx - 3 * k, cy - 3.5 * k, 0, cx, cy, COIN.field * k * 1.3);
  field.addColorStop(0, c.mid);
  field.addColorStop(1, c.deep);
  oct(COIN.field);
  ctx.fillStyle = field;
  ctx.fill();
  // The drop cut in: its lit lower-right edge, then the hole in the rim colour.
  const { drop, depth } = COIN;
  const [dx, dy, dk] = [ox + drop.x * k, oy + drop.y * k, drop.k * k];
  trace(ctx, AMBER_DROP, dx + depth.x * k, dy + depth.y * k, dk);
  ctx.fillStyle = c.shine;
  ctx.globalAlpha = 0.7;
  ctx.fill();
  ctx.globalAlpha = 1;
  trace(ctx, AMBER_DROP, dx, dy, dk);
  ctx.fillStyle = c.rim;
  ctx.fill();
  ctx.restore();
}
