/** Joint judge-account recovery. Node >=24; never copies live WAL files. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const fail = () => { throw new Error('Recovery validation failed; no destination published.'); };
const hash = value => createHash('sha256').update(value).digest('hex');
const digest = file => hash(fs.readFileSync(file));
const identityPath = 'identity/identity.sqlite';
const manifestName = 'manifest.json';
function noLinks(target) {
  let current = path.resolve(target);
  for (;;) {
    if (fs.existsSync(current) || fs.lstatSync(current, { throwIfNoEntry: false })) {
      if (fs.lstatSync(current).isSymbolicLink()) fail();
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}
function pair(source, target) {
  source = path.resolve(source); target = path.resolve(target);
  noLinks(source); noLinks(target);
  const inside = (a, b) => { const r = path.relative(a, b); return !r || (!r.startsWith('..' + path.sep) && r !== '..' && !path.isAbsolute(r)); };
  if (inside(source, target) || inside(target, source) || fs.lstatSync(target, { throwIfNoEntry: false })) fail();
  if (!fs.statSync(source).isDirectory() || !fs.statSync(path.dirname(target)).isDirectory()) fail();
  return [source, target];
}
function database(file, readOnly, action) {
  noLinks(file); noLinks(file + '-wal'); noLinks(file + '-shm');
  if (!fs.statSync(file).isFile()) fail();
  const db = new DatabaseSync(file, { readOnly });
  try { db.exec('PRAGMA busy_timeout=5000'); return action(db); } finally { db.close(); }
}
function integrity(file) {
  database(file, true, db => {
    const rows = db.prepare('PRAGMA integrity_check').all();
    if (rows.length !== 1 || rows[0].integrity_check !== 'ok') fail();
  });
}
function users(file) {
  return database(file, true, db => {
    const ids = db.prepare('SELECT id FROM "user" ORDER BY id LIMIT 101').all().map(row => row.id);
    if (ids.length > 100 || ids.some(id => typeof id !== 'string' || !id.length) || new Set(ids).size !== ids.length) fail();
    return ids;
  });
}
function capture(source, target) {
  noLinks(source); fs.mkdirSync(path.dirname(target), { recursive: true });
  const startedAt = new Date().toISOString();
  database(source, true, db => db.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`));
  integrity(target);
  return { startedAt, completedAt: new Date().toISOString(), sha256: digest(target) };
}
function exactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) fail();
}
function validateRecord(record) {
  exactKeys(record, ['startedAt', 'completedAt', 'sha256']);
  if (!/^[a-f0-9]{64}$/.test(record.sha256) || ![record.startedAt, record.completedAt].every(t => typeof t === 'string' && Number.isFinite(Date.parse(t))) || record.startedAt > record.completedAt) fail();
}
/** Rejects every unexpected file/directory, link, mapping, digest or SQLite failure. */
export function verifySnapshot(root) {
  root = path.resolve(root); noLinks(root);
  const manifestFile = path.join(root, manifestName); noLinks(manifestFile);
  if (fs.statSync(manifestFile).size > 128 * 1024) fail();
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  exactKeys(manifest, ['version', 'identity', 'accounts']);
  if (manifest.version !== 1 || !Array.isArray(manifest.accounts)) fail();
  validateRecord(manifest.identity);
  const expected = new Map([[identityPath, manifest.identity]]);
  const ids = users(path.join(root, identityPath));
  if (ids.length !== manifest.accounts.length) fail();
  for (let i = 0; i < ids.length; i++) {
    const account = manifest.accounts[i];
    if (account?.status === 'captured') exactKeys(account, ['userId', 'directory', 'status', 'database']);
    else exactKeys(account, ['userId', 'directory', 'status']);
    if (account.userId !== ids[i] || account.directory !== hash(ids[i])) fail();
    if (account.status === 'captured') {
      validateRecord(account.database);
      expected.set(`business/${account.directory}/demo.sqlite`, account.database);
    } else if (account.status !== 'notCreated') fail();
  }
  const allowed = new Set([manifestName, ...expected.keys()]);
  for (const name of expected.keys()) {
    let parent = path.posix.dirname(name);
    while (parent !== '.') { allowed.add(parent); parent = path.posix.dirname(parent); }
  }
  function walk(dir, prefix = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix + entry.name;
      if (!allowed.has(rel) || entry.isSymbolicLink()) fail();
      if (entry.isDirectory()) walk(path.join(dir, entry.name), rel + '/');
      else if (!entry.isFile() || !([manifestName, ...expected.keys()].includes(rel))) fail();
    }
  }
  walk(root);
  for (const [relative, record] of expected) {
    const file = path.join(root, relative); noLinks(file);
    if (digest(file) !== record.sha256) fail();
    integrity(file);
  }
  return { manifest, files: [...expected.keys()], hashes: new Map([...expected].map(([file, record]) => [file, record.sha256])) };
}
export function snapshot(sourceRoot, targetDirectory) {
  const [source, target] = pair(sourceRoot, targetDirectory);
  const temporary = fs.mkdtempSync(path.join(path.dirname(target), '.judge-snapshot-'));
  const identity = capture(path.join(source, identityPath), path.join(temporary, identityPath));
  const accounts = users(path.join(temporary, identityPath)).map(userId => {
    const directory = hash(userId);
    const relative = `business/${directory}/demo.sqlite`;
    const live = path.join(source, relative); noLinks(live);
    if (!fs.lstatSync(live, { throwIfNoEntry: false })) return { userId, directory, status: 'notCreated' };
    return { userId, directory, status: 'captured', database: capture(live, path.join(temporary, relative)) };
  });
  fs.writeFileSync(path.join(temporary, manifestName), JSON.stringify({ version: 1, identity, accounts }, null, 2), { flag: 'wx', mode: 0o600 });
  verifySnapshot(temporary);
  if (fs.lstatSync(target, { throwIfNoEntry: false })) fail();
  fs.renameSync(temporary, target);
}
export function restore(snapshotDirectory, restoredRoot) {
  const [source, target] = pair(snapshotDirectory, restoredRoot);
  const { files, hashes } = verifySnapshot(source);
  const temporary = fs.mkdtempSync(path.join(path.dirname(target), '.judge-restore-'));
  for (const relative of files) {
    const from = path.join(source, relative), to = path.join(temporary, relative);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(to, 0o600);
    if (digest(to) !== hashes.get(relative)) fail();
    integrity(to);
  }
  // Revalidate the complete source after copying to catch changes during restore.
  verifySnapshot(source);
  database(path.join(temporary, identityPath), false, db => {
    db.exec('BEGIN IMMEDIATE; DELETE FROM "session"; COMMIT; PRAGMA wal_checkpoint(TRUNCATE);');
    if (db.prepare('SELECT count(*) AS n FROM "session"').get().n !== 0) fail();
  });
  for (const relative of files) integrity(path.join(temporary, relative));
  if (fs.lstatSync(target, { throwIfNoEntry: false })) fail();
  fs.renameSync(temporary, target);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [operation, source, target, ...extra] = process.argv.slice(2);
    if (!source || !target || extra.length || !['snapshot', 'restore'].includes(operation)) throw new Error();
    ({ snapshot, restore })[operation](source, target);
    console.log(`Judge ${operation} verified and published.`);
  } catch {
    console.error('Judge recovery failed. Use snapshot <sourceRoot> <NEWtargetDirectory> or restore <snapshotDirectory> <NEWrestoredRoot>. Destination was not approved for use; inspect any temporary directory privately.');
    process.exitCode = 1;
  }
}
