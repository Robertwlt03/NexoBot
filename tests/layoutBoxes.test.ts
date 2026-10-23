// Box model of the profile card: every element as a rectangle or circle (conservative: text boxes span their full
// width), for every layout and every sticker spot, fully loaded (three badges, max frame, bio, captions).
// No two may overlap – except a sticker placed on the avatar, which is meant to sit on it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STICKER_SPOTS, type StickerSpot } from '../src/shared/cosmetics.js';
import {
  BADGE_GAP, BADGE_SIZE, FRAME_MAX_OUTSET, PROFILE_CARD_HEIGHT as H, PROFILE_CARD_WIDTH as W, PROFILE_LAYOUTS,
  badgeRowRight, profileGeometry, stickerPoint, stickerRadius,
} from '../src/shared/profileCard.js';

type Box = { name: string; x: number; y: number; w: number; h: number } | { name: string; cx: number; cy: number; r: number };
const rect = (name: string, x: number, y: number, w: number, h: number): Box => ({ name, x, y, w, h });
const isCircle = (b: Box): b is Extract<Box, { r: number }> => 'r' in b;

function overlaps(a: Box, b: Box): boolean {
  if (isCircle(a) && isCircle(b)) return Math.hypot(a.cx - b.cx, a.cy - b.cy) < a.r + b.r;
  if (isCircle(a) || isCircle(b)) {
    const c = (isCircle(a) ? a : b) as Extract<Box, { r: number }>;
    const r = (isCircle(a) ? b : a) as Extract<Box, { w: number }>;
    const nx = Math.min(Math.max(c.cx, r.x), r.x + r.w);
    const ny = Math.min(Math.max(c.cy, r.y), r.y + r.h);
    return Math.hypot(c.cx - nx, c.cy - ny) < c.r;
  }
  const p = a as Extract<Box, { w: number }>;
  const q = b as Extract<Box, { w: number }>;
  return p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
}
const inside = (b: Box) => (isCircle(b)
  ? b.cx - b.r >= 0 && b.cy - b.r >= 0 && b.cx + b.r <= W && b.cy + b.r <= H
  : b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H);

function boxes(layout: (typeof PROFILE_LAYOUTS)[number], spot: StickerSpot | null): Box[] {
  const g = profileGeometry(layout);
  const sticker = spot ? { glyph: 'star' as const, color: '#fff', corner: spot } : null;
  const list: Box[] = [{ name: 'avatar', cx: g.avatar.cx, cy: g.avatar.cy, r: g.avatar.r + FRAME_MAX_OUTSET }];
  const right = badgeRowRight(g, sticker);
  const badgeW = 3 * (BADGE_SIZE + BADGE_GAP) - BADGE_GAP;
  list.push(rect('badges', right - badgeW, g.badges.top, badgeW, BADGE_SIZE));
  const t = g.text;
  const span = (width: number) => (t.align === 'center' ? t.x - width / 2 : t.x);
  const nameW = t.align === 'left' && g.badges.top < t.nameY ? Math.min(t.maxWidth, right - badgeW - 24 - t.x) : t.maxWidth;
  list.push(rect('name', span(nameW), t.nameY - t.nameSize * 0.78, nameW, t.nameSize));
  list.push(rect('title', span(t.maxWidth), t.titleY - 15, t.maxWidth, 20));
  list.push(rect('bio', span(t.maxWidth), t.bioY - 14, t.maxWidth, 19));
  const s = g.stats;
  // Widest realistic values: level "999", rank "#12345", balance as coins "💠 1 🟡 23 ⚪ 45 🟤 67".
  const statWidth = (key: string, size: number) => ({ level: 2.4, rank: 4.4, balance: 8.8 }[key] ?? 6) * size;
  if (s.style === 'stacked') {
    for (const item of s.items) {
      const w = statWidth(item.key, item.size);
      list.push(rect(`stat ${item.key}`, item.align === 'center' ? item.x - w / 2 : item.x, item.y - 11, w, item.size + 21));
    }
  }
  if (s.style === 'tiles') list.push(rect('stats', s.rect.x, s.rect.y, s.rect.w, s.rect.h));
  if (s.style === 'inline') list.push(rect('stats', s.align === 'center' ? s.x - 380 : s.x, s.y - 16, 760, 22));
  if (g.captionY !== null) list.push(rect('captions', g.xp.x, g.captionY - 13, g.xp.w, 17));
  list.push(rect('xp', g.xp.x, g.xp.y - 7, g.xp.w, g.xp.h + 11));
  if (g.serverLabel) list.push(rect('server', g.serverLabel.x + (spot === 'tl' && g.serverLabel.x < 80 ? 68 : 0), g.serverLabel.y - 10, g.serverLabel.maxWidth, 13));
  if (sticker) {
    const at = stickerPoint(sticker.corner, g.avatar);
    list.push({ name: 'sticker', cx: at.x, cy: at.y, r: stickerRadius(sticker.corner) });
  }
  return list;
}

test('no element of any layout overlaps another, for every sticker spot', () => {
  const problems: string[] = [];
  for (const layout of PROFILE_LAYOUTS) {
    for (const spot of [null, ...STICKER_SPOTS]) {
      const list = boxes(layout, spot);
      for (const box of list) if (!inside(box)) problems.push(`${layout}/${spot}: ${box.name} leaves the card`);
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const [a, b] = [list[i], list[j]];
          if (spot === 'avatar' && [a.name, b.name].includes('sticker') && [a.name, b.name].includes('avatar')) continue;
          if (overlaps(a, b)) problems.push(`${layout}/${spot}: ${a.name} × ${b.name}`);
        }
      }
    }
  }
  assert.deepEqual([...new Set(problems)], []);
});
