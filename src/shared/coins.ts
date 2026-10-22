// Bernis as coins: every amount is stored in bronze and shown in platinum, gold, silver and bronze (100 bronze =
// 1 silver, 100 silver = 1 gold, 100 gold = 1 platinum), each coin with the amber drop engraved. One geometry for every surface: the dashboard
// draws it as SVG, the profile and level-up cards on canvas, Discord messages use the text form.
// Import-free apart from the amber geometry (shared by the bot and the dashboard).

import { AMBER_DROP, AMBER_LEAF, type AmberContext, type AmberPath } from './amber.js';

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

/** Metal per tier: face light → deep, the rim, the engraved recess and the lit edge of the engraving. */
export const COIN_COLORS: Record<CoinTier, { light: string; mid: string; deep: string; rim: string; recess: string; shine: string }> = {
  // Cooler and brighter than silver, with a blue-white sheen.
  platinum: { light: '#FFFFFF', mid: '#C9D6E6', deep: '#5D7391', rim: '#3B4B63', recess: '#8EA3BE', shine: '#F2F8FF' },
  gold: { light: '#FFF1B0', mid: '#F2C14E', deep: '#A8740F', rim: '#7A520A', recess: '#B88A2A', shine: '#FFF8DC' },
  silver: { light: '#FFFFFF', mid: '#D3D8DF', deep: '#7E8794', rim: '#5A626D', recess: '#99A2AE', shine: '#FFFFFF' },
  bronze: { light: '#F6C9A0', mid: '#C98A55', deep: '#7A4A24', rim: '#5A3418', recess: '#9C6438', shine: '#FCE2C8' },
};

/** Geometry in a 24×24 box: rim radius, face radius and where the amber drop is engraved (scale + offset). */
export const COIN = { box: 24, rim: 11.6, face: 9.7, drop: { k: 0.6, x: 4.8, y: 4.74 }, depth: 0.42 } as const;

export function coinDetail(size: number): 'small' | 'full' {
  return size < 22 ? 'small' : 'full';
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
  const disc = (r: number) => { ctx.beginPath(); ctx.arc(cx, cy, r * k, 0, Math.PI * 2); };
  ctx.save();
  // Rim, then the face lit from the top left.
  const rim = ctx.createRadialGradient(cx - 3 * k, cy - 4 * k, 0, cx, cy, COIN.rim * k);
  rim.addColorStop(0, c.mid);
  rim.addColorStop(1, c.rim);
  disc(COIN.rim);
  ctx.fillStyle = rim;
  ctx.fill();
  const face = ctx.createRadialGradient(cx - 3 * k, cy - 3.5 * k, 0, cx, cy, COIN.face * k * 1.15);
  face.addColorStop(0, c.light);
  face.addColorStop(0.55, c.mid);
  face.addColorStop(1, c.deep);
  disc(COIN.face);
  ctx.fillStyle = face;
  ctx.fill();
  // Engraved drop: a lit lower-right edge, the recess shifted up-left over it, the leaf cut a little deeper.
  const { drop, depth } = COIN;
  const [dx, dy, dk] = [ox + drop.x * k, oy + drop.y * k, drop.k * k];
  trace(ctx, AMBER_DROP, dx + depth * k, dy + depth * k, dk);
  ctx.fillStyle = c.shine;
  ctx.globalAlpha = 0.8;
  ctx.fill();
  ctx.globalAlpha = 1;
  trace(ctx, AMBER_DROP, dx, dy, dk);
  ctx.fillStyle = c.recess;
  ctx.fill();
  if (coinDetail(size) === 'full') {
    trace(ctx, AMBER_LEAF, dx, dy, dk);
    ctx.fillStyle = c.deep;
    ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  disc(COIN.face);
  ctx.strokeStyle = c.deep;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = Math.max(0.6, 0.5 * k);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}
