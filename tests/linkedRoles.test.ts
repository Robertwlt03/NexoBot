// Linked Roles: token sealing, Discord's limits for the metadata and the connection body.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROLE_METADATA, connectionBody, seal, unseal } from '../src/services/cosmetics/linkedRoles.js';

test('tokens are sealed, readable with the secret and tamper-proof', () => {
  const sealed = seal({ access: 'a', refresh: 'r', expiresAt: 1 }, 'secret');
  assert.ok(!sealed.includes('"access"'));
  assert.deepEqual(unseal(sealed, 'secret'), { access: 'a', refresh: 'r', expiresAt: 1 });
  assert.equal(unseal(sealed, 'other secret'), null);
  const raw = Buffer.from(sealed, 'base64');
  raw[raw.length - 1] ^= 1;
  assert.equal(unseal(raw.toString('base64'), 'secret'), null);
});

test('metadata fits Discord (≤ 5 records, keys a-z0-9_, names ≤ 100, descriptions ≤ 200)', () => {
  assert.ok(ROLE_METADATA.length <= 5);
  for (const m of ROLE_METADATA) {
    assert.match(m.key, /^[a-z0-9_]{1,50}$/);
    assert.ok(m.name.length <= 100 && m.description.length <= 200);
  }
});

test('connection body has every key as a string and a short line', () => {
  const body = connectionBody({ level: 999, season_tier: 10, achievements: 84, chat_days: 365, bernis: 123_456_789 });
  assert.deepEqual(Object.keys(body.metadata), ROLE_METADATA.map((m) => m.key));
  assert.ok(Object.values(body.metadata).every((v) => typeof v === 'string' && v.length <= 100));
  assert.ok(body.platform_username.length <= 100 && body.platform_name.length <= 50);
});
