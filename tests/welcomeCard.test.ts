import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CARD_MAX_LAYERS, CARD_TEMPLATES, CardValidationError, defaultCard, fillPlaceholders, safeCard, validateCard,
} from '../src/shared/welcomeCard.js';
import { fetchImageBuffer, isBlockedAddress } from '../src/services/welcomeCardRenderer.js';

test('fillPlaceholders replaces every occurrence', () => {
  const vars = { userName: 'Jürgen', username: 'juergen', server: 'Nexo', memberCount: '1.234' };
  assert.equal(fillPlaceholders('Hi {user.name} ({username}) auf {server} #{memberCount} – {user.name}!', vars),
    'Hi Jürgen (juergen) auf Nexo #1.234 – Jürgen!');
  assert.equal(fillPlaceholders('{unknown} bleibt', vars), '{unknown} bleibt');
});

test('validateCard accepts the default card and every template', () => {
  assert.deepEqual(validateCard(defaultCard()), defaultCard());
  for (const template of CARD_TEMPLATES) {
    validateCard({ ...defaultCard(), background: template.background, layers: template.layers });
  }
});

test('validateCard rejects bad input with German messages', () => {
  const card = () => defaultCard();
  const rejects = (value: unknown, pattern: RegExp) => assert.throws(() => validateCard(value), (error: unknown) =>
    error instanceof CardValidationError && pattern.test(error.message));

  rejects(null, /ungültige Daten/);
  rejects({ ...card(), width: 800 }, /Format/);
  rejects({ ...card(), background: { ...card().background, color: 'red' } }, /#RRGGBB/);
  rejects({ ...card(), background: { ...card().background, dim: 95 } }, /Abdunkeln/);
  rejects({ ...card(), background: { ...card().background, type: 'image', imageUrl: null } }, /Bild-URL/);
  rejects({ ...card(), background: { ...card().background, imageUrl: 'javascript:alert(1)' } }, /http/);
  rejects({ ...card(), layers: [{ id: 'a', type: 'video', x: 0, y: 0 }] }, /Typ/);
  rejects({ ...card(), layers: [{ id: 'a', type: 'circle', x: 99999, y: 0, r: 5, color: '#FFFFFF', opacity: 50 }] }, /X/);
  rejects({ ...card(), layers: [{ id: 'a', type: 'text', x: 0, y: 0, text: 'x'.repeat(201), font: 'inter', size: 20, weight: 400, color: '#FFFFFF', align: 'left', maxWidth: 0, shadow: false }] }, /200 Zeichen/);
  rejects({ ...card(), layers: [{ id: 'a', type: 'text', x: 0, y: 0, text: 'x', font: 'comic', size: 20, weight: 400, color: '#FFFFFF', align: 'left', maxWidth: 0, shadow: false }] }, /Schrift/);
  rejects({ ...card(), layers: [{ id: 'a', type: 'image', x: 0, y: 0, w: 10, h: 10, url: 'ftp://x/y.png', radius: 0, opacity: 100 }] }, /http/);
  const circle = { type: 'circle', x: 0, y: 0, r: 5, color: '#FFFFFF', opacity: 50 };
  rejects({ ...card(), layers: Array.from({ length: CARD_MAX_LAYERS + 1 }, (_, i) => ({ ...circle, id: `c${i}` })) }, /höchstens 25/);
  rejects({ ...card(), layers: [{ ...circle, id: 'x' }, { ...circle, id: 'x' }] }, /doppelte/);

  assert.equal(safeCard({ nope: true }), null);
  assert.equal(validateCard({ ...card(), background: { ...card().background, color: '#abcdef' } }).background.color, '#ABCDEF');
});

test('SSRF guard blocks internal addresses', async () => {
  for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.5.4', '192.168.0.10', '169.254.169.254', '100.64.0.1', '224.0.0.1', '0.0.0.0',
    '::1', '::', 'fe80::1', 'fd12::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '[::1]', 'localhost']) {
    assert.equal(isBlockedAddress(ip), true, ip);
  }
  for (const ip of ['1.1.1.1', '162.159.130.233', '2606:4700::6810:85e5']) {
    assert.equal(isBlockedAddress(ip), false, ip);
  }
  await assert.rejects(fetchImageBuffer('http://127.0.0.1/avatar.png'), /Blocked/);
  await assert.rejects(fetchImageBuffer('http://[::1]:3000/x.png'), /Blocked/);
  await assert.rejects(fetchImageBuffer('http://localhost/x.png'), /Blocked/);
  await assert.rejects(fetchImageBuffer('file:///etc/passwd'), /Protocol/);
});
