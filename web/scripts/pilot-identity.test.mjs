import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createPilotIdentity as createIdentity } from '../src/lib/auth/pilot-identity.ts';

const baseURL = 'https://pilot.mercado.test';
const password = 'Prueba-local-12-caracteres!';
const connections = new Map();
async function createPilotIdentity(options) {
  const identity = await createIdentity(options);
  connections.set(identity, options.directory);
  return identity;
}
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'mc-identity-'));
  t.after(() => {
    for (const [identity, directory] of connections) {
      if (directory === root || directory.startsWith(root + path.sep)) {
        identity.close();
        connections.delete(identity);
      }
    }
    assert.ok(path.basename(root).startsWith('mc-identity-'));
    rmSync(root, { recursive: true, force: true });
  });
  return { directory: path.join(root, 'identity'), baseURL, secret: randomBytes(48).toString('base64url') };
}
function request(auth, endpoint, body, cookie, origin = baseURL) {
  return auth.handler(new Request(baseURL + '/api/auth/' + endpoint, {
    method: body ? 'POST' : 'GET',
    headers: { ...(body ? { 'Content-Type': 'application/json', Origin: origin } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }));
}
function cookieOf(response) { return response.headers.getSetCookie().map(c => c.split(';')[0]).join('; '); }
async function signup(auth, email = 'judge-a@example.test', extra = {}) {
  return request(auth, 'sign-up/email', { name: 'Juez de prueba', email, password, ...extra });
}

test('demo accepts short and over-128 passwords for signup and signin', async t => {
  const identity = await createPilotIdentity({ ...fixture(t), allowSignUp: true });
  for (const [index, candidate] of ['a', 'x'.repeat(129), 'x'.repeat(1024)].entries()) {
    const email = `unrestricted-${index}@example.test`;
    const created = await signup(identity.auth, email, { password: candidate });
    assert.equal(created.status, 200, `signup length=${candidate.length}: ${await created.clone().text()}`);
    const login = await request(identity.auth, 'sign-in/email', { email, password: candidate });
    assert.equal(login.status, 200, `signin length=${candidate.length}: ${await login.clone().text()}`);
  }
});

test('upstream signup schema requires a nonempty credential; demo offers separate guest entry', async t => {
  const identity = await createPilotIdentity({ ...fixture(t), allowSignUp: true });
  const response = await signup(identity.auth, 'empty@example.test', { password: '' });
  assert.equal(response.status, 400);
  assert.equal(identity.database.prepare('SELECT count(*) AS n FROM user').get().n, 0);
});

test('rejects weak secret and unsafe origins before creating any files', async t => {
  for (const invalid of [{ secret: 'short' }, { baseURL: 'http://example.com' }, { baseURL: 'https://user:pass@example.com' }, { baseURL: baseURL + '/path' }, { baseURL: baseURL + '?query=1' }, { baseURL: 'file:///tmp/auth' }]) {
    const options = { ...fixture(t), ...invalid };
    await assert.rejects(createPilotIdentity(options));
    assert.equal(existsSync(options.directory), false);
  }
});

test('refuses the existing business database directory without altering it', async t => {
  const options = fixture(t);
  options.directory = path.dirname(options.directory);
  const businessFile = path.join(options.directory, 'mercado-cero.db');
  writeFileSync(businessFile, 'must-not-change');
  await assert.rejects(createPilotIdentity(options), /separad|business/i);
  assert.equal(existsSync(path.join(options.directory, 'identity.sqlite')), false);
});

test('identity uses WAL and foreign keys; registration is closed by default', async t => {
  const identity = await createPilotIdentity(fixture(t));
  t.after(() => identity.close());
  assert.equal(identity.database.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
  assert.equal(identity.database.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
  assert.equal(identity.database.prepare('PRAGMA max_page_count').get().max_page_count * identity.database.prepare('PRAGMA page_size').get().page_size, 32 * 1024 * 1024);
  const response = await signup(identity.auth);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'EMAIL_PASSWORD_SIGN_UP_DISABLED');
  assert.equal(identity.database.prepare('SELECT count(*) AS n FROM user').get().n, 0);
});

test('real signup, secure cookie, maximum 24 hour session, and revocation', async t => {
  const identity = await createPilotIdentity({ ...fixture(t), allowSignUp: true });
  t.after(() => identity.close());
  const response = await signup(identity.auth);
  assert.equal(response.status, 200);
  const header = response.headers.getSetCookie().join(';');
  assert.match(header, /HttpOnly/i);
  assert.match(header, /Secure/i);
  assert.match(header, /SameSite=Lax/i);
  const cookie = cookieOf(response);
  const session = await (await request(identity.auth, 'get-session', null, cookie)).json();
  assert.equal(session.user.email, 'judge-a@example.test');
  // Better Auth may cross one second between computing expiry and createdAt.
  // Tolerate shortening by that tick, never a session exceeding 24 hours.
  const durationMs = Date.parse(session.session.expiresAt) - Date.parse(session.session.createdAt);
  assert.ok(durationMs >= 86_399_000 && durationMs <= 86_400_000, `Invalid session duration: ${durationMs}`);
  const logout = await request(identity.auth, 'sign-out', {}, cookie);
  assert.equal(logout.status, 200);
  assert.equal(await (await request(identity.auth, 'get-session', null, cookie)).json(), null);
});

test('two identity instances do not share users or accept the other session', async t => {
  const a = await createPilotIdentity({ ...fixture(t), allowSignUp: true });
  const b = await createPilotIdentity({ ...fixture(t), allowSignUp: true });
  t.after(() => { a.close(); b.close(); });
  const [responseA, responseB] = await Promise.all([signup(a.auth), signup(b.auth, 'judge-b@example.test')]);
  assert.equal(responseA.status, 200);
  assert.equal(responseB.status, 200);
  assert.equal(await (await request(b.auth, 'get-session', null, cookieOf(responseA))).json(), null);
  assert.equal(b.database.prepare('SELECT count(*) AS n FROM user WHERE email=?').get('judge-a@example.test').n, 0);
  const stored = a.database.prepare('SELECT password FROM account').get().password;
  assert.notEqual(stored, password);
  assert.ok(stored.length > 30);
});

test('rejects mutations from another origin', async t => {
  const identity = await createPilotIdentity({ ...fixture(t), allowSignUp: true });
  t.after(() => identity.close());
  const forged = await request(identity.auth, 'sign-up/email', { name: 'Juez', email: 'forged@example.test', password }, null, 'https://other.example');
  assert.equal(forged.status, 403);
  assert.equal(identity.database.prepare('SELECT count(*) AS n FROM user').get().n, 0);
});

test('reopening and repeating migrations preserve accounts; expired session is rejected', async t => {
  const options = { ...fixture(t), allowSignUp: true };
  const first = await createPilotIdentity(options);
  const original = await signup(first.auth);
  assert.equal(original.status, 200);
  const cookie = cookieOf(original);
  first.close();
  const reopened = await createPilotIdentity(options);
  t.after(() => reopened.close());
  assert.equal(reopened.database.prepare('SELECT count(*) AS n FROM user').get().n, 1);
  assert.equal((await (await request(reopened.auth, 'get-session', null, cookie)).json()).user.email, 'judge-a@example.test');
  const login = await request(reopened.auth, 'sign-in/email', { email: 'judge-a@example.test', password });
  assert.equal(login.status, 200);
  reopened.database.prepare('UPDATE session SET expiresAt = 0').run();
  assert.equal(await (await request(reopened.auth, 'get-session', null, cookieOf(login))).json(), null);
});

test('does not trust a client-supplied forwarded IP before proxy integration', async t => {
  const identity = await createPilotIdentity({ ...fixture(t), allowSignUp: true });
  t.after(() => identity.close());
  const response = await identity.auth.handler(new Request(baseURL + '/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseURL, 'X-Forwarded-For': '203.0.113.99', 'CF-Connecting-IP': '203.0.113.88' },
    body: JSON.stringify({ name: 'Juez', email: 'headers@example.test', password }),
  }));
  assert.equal(response.status, 200);
  assert.equal(identity.database.prepare('SELECT ipAddress FROM session').get().ipAddress, '');
});


test('the hundredth account slot is atomic across simultaneous signups and persists after reopening', async t => {
  const options = { ...fixture(t), allowSignUp: true };
  const identity = await createPilotIdentity(options);
  const insert = identity.database.prepare('INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, 0, ?, ?)');
  for (let i = 0; i < 99; i++) insert.run(`seed-${i}`, 'Quota fixture', `seed-${i}@example.test`, Date.now(), Date.now());
  const responses = await Promise.all([signup(identity.auth, 'last-slot-a@example.test'), signup(identity.auth, 'last-slot-b@example.test')]);
  assert.equal(responses.filter(response => response.status === 200).length, 1);
  assert.equal(identity.database.prepare('SELECT count(*) AS n FROM user').get().n, 100);
  const accepted = responses.find(response => response.status === 200);
  const sessionCookie = cookieOf(accepted);
  assert.ok((await (await request(identity.auth, 'get-session', null, sessionCookie)).json()).user);
  identity.close();
  const reopened = await createPilotIdentity(options);
  const rejected = await signup(reopened.auth, 'over-quota@example.test');
  assert.notEqual(rejected.status, 200);
  assert.equal(reopened.database.prepare('SELECT count(*) AS n FROM user').get().n, 100);
  assert.equal(reopened.database.prepare('SELECT count(*) AS n FROM account').get().n, 1);
});
