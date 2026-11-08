import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { snapshot, restore, verifySnapshot } from './judge-snapshot.mjs';

const sha = id => createHash('sha256').update(id).digest('hex');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'judge-recovery-test-'));
  const live = path.join(root, 'live');
  fs.mkdirSync(path.join(live, 'identity'), { recursive: true });
  const identity = new DatabaseSync(path.join(live, 'identity/identity.sqlite'));
  identity.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE "user"(id TEXT PRIMARY KEY, password TEXT); CREATE TABLE session(id TEXT PRIMARY KEY, userId TEXT);');
  for (const id of ['alice', 'bob', 'new-account']) {
    identity.prepare('INSERT INTO "user" VALUES (?, ?)').run(id, 'preserved-password-' + id);
    identity.prepare('INSERT INTO session VALUES (?, ?)').run('old-session-' + id, id);
  }
  const tenants = ['alice', 'bob', 'orphan'].map(id => {
    const dir = path.join(live, 'business', sha(id)); fs.mkdirSync(dir, { recursive: true });
    const db = new DatabaseSync(path.join(dir, 'demo.sqlite'));
    db.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE entries(owner TEXT, value TEXT);');
    db.prepare('INSERT INTO entries VALUES (?, ?)').run(id, 'private-' + id);
    return db;
  });
  t.after(() => {
    identity.close(); for (const db of tenants) db.close();
    // Test-owned absolute mkdtemp root only; no production paths enter this cleanup.
    assert.ok(path.dirname(root) === os.tmpdir() && path.basename(root).startsWith('judge-recovery-test-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  return { root, live, identity, tenants, shot: path.join(root, 'snapshot'), restored: path.join(root, 'restored') };
}
function query(file, sql) { const db = new DatabaseSync(file, { readOnly: true }); try { return db.prepare(sql).all().map(r => ({ ...r })); } finally { db.close(); } }
function manifest(f) { return JSON.parse(fs.readFileSync(path.join(f.shot, 'manifest.json'), 'utf8')); }
function changeManifest(f, value) { fs.writeFileSync(path.join(f.shot, 'manifest.json'), JSON.stringify(value)); }

test('WAL snapshots preserve separate ownership, passwords, missing-account state; restore revokes every session', t => {
  const f = fixture(t);
  const beforeUsers = f.identity.prepare('SELECT * FROM "user" ORDER BY id').all();
  const beforeSessions = f.identity.prepare('SELECT * FROM session ORDER BY id').all();
  assert.ok(fs.statSync(path.join(f.live, 'identity/identity.sqlite-wal')).size > 0);
  snapshot(f.live, f.shot);
  const m = manifest(f);
  assert.equal(m.accounts.length, 3);
  assert.equal(m.accounts.find(a => a.userId === 'new-account').status, 'notCreated');
  assert.equal(fs.existsSync(path.join(f.shot, 'business', sha('orphan'))), false);
  f.identity.prepare('INSERT INTO "user" VALUES (?, ?)').run('later-user', 'later-password');
  assert.equal(verifySnapshot(f.shot).manifest.accounts.length, 3);
  restore(f.shot, f.restored);
  assert.deepEqual(query(path.join(f.restored, 'identity/identity.sqlite'), 'SELECT * FROM "user" ORDER BY id'), beforeUsers.map(r => ({ ...r })));
  assert.deepEqual(query(path.join(f.restored, 'identity/identity.sqlite'), 'SELECT * FROM session'), []);
  assert.deepEqual(f.identity.prepare('SELECT * FROM session ORDER BY id').all(), beforeSessions);
  assert.equal(f.identity.prepare('SELECT count(*) AS n FROM "user"').get().n, 4);
  for (const id of ['alice', 'bob']) {
    assert.deepEqual(query(path.join(f.restored, 'business', sha(id), 'demo.sqlite'), 'SELECT * FROM entries'), [{ owner: id, value: 'private-' + id }]);
  }
  assert.equal(fs.existsSync(path.join(f.restored, 'business', sha('new-account'))), false);
  assert.equal(verifySnapshot(f.shot).manifest.accounts.length, 3);
});
test('tampered hash is rejected with no restored target', t => {
  const f = fixture(t); snapshot(f.live, f.shot); const m = manifest(f); m.identity.sha256 = '0'.repeat(64); changeManifest(f, m);
  assert.throws(() => restore(f.shot, f.restored)); assert.equal(fs.existsSync(f.restored), false);
});
test('missing file is rejected', t => {
  const f = fixture(t); snapshot(f.live, f.shot);
  fs.unlinkSync(path.join(f.shot, 'business', sha('bob'), 'demo.sqlite'));
  assert.throws(() => restore(f.shot, f.restored)); assert.equal(fs.existsSync(f.restored), false);
});
test('extra file and extra directory are rejected', t => {
  const f = fixture(t); snapshot(f.live, f.shot);
  const extra = path.join(f.shot, 'unexpected'); fs.writeFileSync(extra, 'extra');
  assert.throws(() => restore(f.shot, f.restored)); fs.unlinkSync(extra);
  fs.mkdirSync(extra); assert.throws(() => restore(f.shot, f.restored));
});
test('manifest traversal, unknown paths and account remapping are rejected', t => {
  const f = fixture(t); snapshot(f.live, f.shot); const original = manifest(f);
  for (const modify of [m => { m.accounts[0].directory = '../escape'; }, m => { m.accounts[0].database.path = '../../escape'; }, m => { m.accounts[0].userId = 'bob'; }, m => { m.identity.sha256 = 'x'; }]) {
    const m = structuredClone(original); modify(m); changeManifest(f, m); assert.throws(() => restore(f.shot, f.restored));
  }
  assert.equal(fs.existsSync(path.join(f.root, 'escape')), false);
});
test('same, nested and existing targets are refused without source changes', t => {
  const f = fixture(t); snapshot(f.live, f.shot);
  for (const target of [f.live, path.join(f.live, 'nested'), f.root, f.shot]) assert.throws(() => snapshot(f.live, target));
  for (const target of [f.shot, path.join(f.shot, 'nested'), f.root, f.live]) assert.throws(() => restore(f.shot, target));
  assert.equal(f.identity.prepare('SELECT count(*) AS n FROM session').get().n, 3);
  assert.equal(verifySnapshot(f.shot).manifest.accounts.length, 3);
});
test('file symlinks in snapshots are refused', t => {
  const f = fixture(t); snapshot(f.live, f.shot);
  const link = path.join(f.shot, 'linked');
  try { fs.symlinkSync(path.join(f.live, 'identity/identity.sqlite'), link, 'file'); }
  catch (error) { if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) { t.skip('Windows symlink privilege unavailable'); return; } throw error; }
  assert.throws(() => restore(f.shot, f.restored)); fs.unlinkSync(link);
});
test('directory junctions or symlinks in source account paths are refused', t => {
  const f = fixture(t);
  const business = path.join(f.live, 'business', sha('new-account'));
  fs.symlinkSync(path.join(f.live, 'identity'), business, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => snapshot(f.live, path.join(f.root, 'second')));
});
test('valid digest cannot conceal invalid SQLite and missing session table prevents restore publication', t => {
  const f = fixture(t); snapshot(f.live, f.shot);
  const business = path.join(f.shot, 'business', sha('alice'), 'demo.sqlite');
  fs.writeFileSync(business, 'not sqlite'); const m = manifest(f);
  m.accounts.find(a => a.userId === 'alice').database.sha256 = createHash('sha256').update(fs.readFileSync(business)).digest('hex'); changeManifest(f, m);
  assert.throws(() => restore(f.shot, f.restored));
  const second = path.join(f.root, 'second'); f.identity.exec('DROP TABLE session'); snapshot(f.live, second);
  assert.throws(() => restore(second, f.restored)); assert.equal(fs.existsSync(f.restored), false);
});
test('restore binds copied bytes to the initially verified manifest despite a transient source change', t => {
  const f = fixture(t); snapshot(f.live, f.shot);
  const source = path.join(f.shot, 'business', sha('alice'), 'demo.sqlite');
  const originalBytes = fs.readFileSync(source);
  const originalCopy = fs.copyFileSync;
  let intercepted = false;
  fs.copyFileSync = function(from, to, flags) {
    if (path.resolve(from) !== source) return originalCopy(from, to, flags);
    intercepted = true;
    const db = new DatabaseSync(source);
    try { db.exec("UPDATE entries SET value='transient-tampered-value'"); } finally { db.close(); }
    try { return originalCopy(from, to, flags); } finally { fs.writeFileSync(source, originalBytes); }
  };
  try { assert.throws(() => restore(f.shot, f.restored)); } finally { fs.copyFileSync = originalCopy; }
  assert.equal(intercepted, true);
  assert.equal(fs.existsSync(f.restored), false);
  assert.deepEqual(fs.readFileSync(source), originalBytes);
  verifySnapshot(f.shot);
});
test('account catalogs over 100 and manifests over 128 KiB fail closed', t => {
  const f = fixture(t); snapshot(f.live, f.shot);
  fs.appendFileSync(path.join(f.shot, 'manifest.json'), ' '.repeat(128 * 1024));
  assert.throws(() => restore(f.shot, f.restored));
  for (let i = 0; i < 98; i++) f.identity.prepare('INSERT INTO "user" VALUES (?, ?)').run('extra-' + i, 'password');
  assert.throws(() => snapshot(f.live, path.join(f.root, 'too-many')));
  assert.equal(fs.existsSync(path.join(f.root, 'too-many')), false);
});
