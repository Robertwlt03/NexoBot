// Coin flight paths at the measured wallet-pill positions (phone, tablet, desktop): every coin stays on screen and
// lands on the pill when earning (or leaves from it when spending), from any click point.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coinPath } from '../dashboard/src/me/CoinFlight.tsx';

const SCREENS = [
  { name: 'phone', w: 375, h: 812, pill: { x: 313, y: 32 } },
  { name: 'tablet', w: 768, h: 1024, pill: { x: 690, y: 32 } },
  { name: 'desktop', w: 1440, h: 900, pill: { x: 273, y: 32 } },
];

test('coin flights stay on screen and hit the pill', () => {
  for (const { name, w, h, pill } of SCREENS) {
    const clicks = [{ x: w / 2, y: h * 0.6 }, { x: 8, y: h - 8 }, { x: w - 8, y: 40 }, { x: pill.x, y: pill.y + 60 }, { x: w * 0.9, y: h * 0.3 }];
    for (const click of clicks) {
      for (const [from, to] of [[click, pill], [pill, click]]) {
        for (const spread of [-40, -8, 0, 24, 40]) {
          const path = coinPath(from, to, spread, { w, h });
          for (let i = 0; i <= 50; i++) {
            const p = path.at(i / 50);
            assert.ok(p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h, `${name}: coin off screen at ${JSON.stringify(p)}`);
          }
          if (to === pill) assert.deepEqual(path.at(1), pill, `${name}: coin misses the pill`);
          else assert.deepEqual(path.at(0), { x: pill.x + spread, y: pill.y }, `${name}: coin does not leave the pill`);
        }
      }
    }
    // Spending: tossed out of the pill, scattering as they drop below it.
    for (const spread of [-40, 0, 40]) {
      const path = coinPath(pill, { x: pill.x + spread * 3, y: pill.y + 150 }, spread, { w, h });
      for (let i = 0; i <= 50; i++) {
        const p = path.at(i / 50);
        assert.ok(p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h, `${name}: spent coin off screen at ${JSON.stringify(p)}`);
      }
    }
  }
});
