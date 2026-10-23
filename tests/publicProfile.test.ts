// Link preview payload of the public profile page: one container, valid JSON, within Discord's 3000-byte limit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { componentEmbed } from '../src/web/publicProfile.js';

test('component embed stays small, closes no script and links back', () => {
  const json = componentEmbed({
    name: 'Robert</script><b>', lines: ['*Saisonheld Oktober 2026*', 'Level **24** auf Discord Notizen · Rang #1', 'Saison Oktober 2026 · Stufe 5 von 10'],
    avatarUrl: 'https://cdn.discordapp.com/avatars/1/a.png', cardUrl: 'https://nexo.example/dashboard/p/1/card.png?v=1',
    pageUrl: 'https://nexo.example/dashboard/p/1', editUrl: 'https://nexo.example/dashboard/me', accent: '#8FB36B',
  });
  assert.ok(Buffer.byteLength(json) < 3000);
  assert.ok(!json.includes('</'));
  const payload = JSON.parse(json);
  assert.equal(payload.component.type, 17);
  assert.equal(payload.component.accent_color, 0x8fb36b);
  assert.deepEqual(payload.component.components.map((c: { type: number }) => c.type), [9, 12, 1]);
});
