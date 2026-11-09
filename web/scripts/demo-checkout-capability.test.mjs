import test from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { sealDemoCheckout, openDemoCheckout, InvalidDemoCheckout } from '../src/lib/auth/demo-checkout-capability.ts';
const cfg = { secret: randomBytes(48).toString('base64url'), origin: 'https://example.test', nowMs: 1794207600000 };
const subject = { accountId: 'qa-account', orderId: 'ord_test' };
test('roundtrip, random IV and concealed account/order', () => {
  const first = sealDemoCheckout(subject, cfg), second = sealDemoCheckout(subject, cfg);
  assert.notEqual(first, second);
  assert.deepEqual(openDemoCheckout(first, cfg), { ...subject, iat: cfg.nowMs / 1000, exp: cfg.nowMs / 1000 + 600 });
  assert.ok(!Buffer.from(first.slice(3), 'base64url').toString().includes(subject.accountId));
});
test('tampered ciphertext, tag, IV, truncated and oversized tokens fail uniformly', () => {
  const token = sealDemoCheckout(subject, cfg), bytes = Buffer.from(token.slice(3), 'base64url');
  for (const index of [0, 12, bytes.length - 1]) {
    const changed = Buffer.from(bytes); changed[index] ^= 1;
    assert.throws(() => openDemoCheckout('v1.' + changed.toString('base64url'), cfg), InvalidDemoCheckout);
  }
  for (const invalid of [token.slice(0, -8), token + '=', token.replace('v1.', 'v2.'), 'v1.' + 'a'.repeat(1025)]) {
    assert.throws(() => openDemoCheckout(invalid, cfg), InvalidDemoCheckout);
  }
});
test('expiry, future issuance, TTL, origin and different key reject', () => {
  const token = sealDemoCheckout(subject, cfg);
  assert.throws(() => openDemoCheckout(token, { ...cfg, nowMs: cfg.nowMs + 600000 }), InvalidDemoCheckout);
  assert.throws(() => openDemoCheckout(token, { ...cfg, nowMs: cfg.nowMs - 1000 }), InvalidDemoCheckout);
  assert.throws(() => sealDemoCheckout(subject, cfg, new Date(cfg.nowMs + 901000).toISOString()), InvalidDemoCheckout);
  assert.throws(() => openDemoCheckout(token, { ...cfg, origin: 'https://canary.example.test' }), InvalidDemoCheckout);
  assert.throws(() => openDemoCheckout(token, { ...cfg, secret: randomBytes(48).toString('base64url') }), InvalidDemoCheckout);
});
test('authenticated but malformed payloads are rejected before tenant selection', () => {
  const purpose = 'trangui:demo-checkout:v1';
  const key = Buffer.from(hkdfSync('sha256', cfg.secret, purpose, cfg.origin, 32));
  const now = cfg.nowMs / 1000;
  for (const input of [{ ...subject, iat: now, exp: now + 601, extra: true }, { ...subject, accountId: '../escape', iat: now, exp: now + 600 }, { ...subject, iat: now, exp: now + 901 }, { ...subject, iat: now, exp: now + 0.1 }, null]) {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(purpose + ':' + cfg.origin));
    const value = Buffer.concat([iv, cipher.update(JSON.stringify(input)), cipher.final(), cipher.getAuthTag()]);
    assert.throws(() => openDemoCheckout('v1.' + value.toString('base64url'), cfg), InvalidDemoCheckout);
  }
});
