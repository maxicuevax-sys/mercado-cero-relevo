import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const rootKey = 'TRANGUI_JUDGE_BROWSER_ROOT';
const secretKey = 'TRANGUI_JUDGE_BROWSER_SECRET';
const configURL = new URL('../playwright.judge.config.ts', import.meta.url).href;
function run(source, additions = {}) {
  const env = { ...process.env };
  delete env[rootKey]; delete env[secretKey];
  return spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '-e', source], {
    env: { ...env, ...additions }, encoding: 'utf8', timeout: 20000,
  });
}
const load = `const config=(await import(${JSON.stringify(configURL)})).default;`;

test('runner, repeated config loads and worker share ephemeral SQLite and secret without serializing it', () => {
  const result = run(`
    import assert from 'node:assert/strict';
    import {spawnSync} from 'node:child_process';
    import {DatabaseSync} from 'node:sqlite';
    import {rmSync} from 'node:fs';
    import path from 'node:path';
    ${load}
    const root=config.webServer.env.JUDGE_DATA_ROOT;
    try {
      assert.equal(process.env.${rootKey},root);
      assert.equal(process.env.${secretKey},config.webServer.env.PILOT_AUTH_SECRET);
      const again=(await import(${JSON.stringify(configURL + '?second-load')})).default;
      assert.equal(again.webServer.env.JUDGE_DATA_ROOT,root);
      assert.equal(again.webServer.env.PILOT_AUTH_SECRET,config.webServer.env.PILOT_AUTH_SECRET);
      const db=new DatabaseSync(path.join(root,'fixture.sqlite'));
      db.exec('CREATE TABLE marker(value INTEGER); INSERT INTO marker VALUES(42)'); db.close();
      const worker=spawnSync(process.execPath,['--no-warnings','--input-type=module','-e',
        ${JSON.stringify(`import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import path from 'node:path';${load}assert.equal(config.webServer.env.JUDGE_DATA_ROOT,process.env.${rootKey});assert.equal(config.webServer.env.PILOT_AUTH_SECRET,process.env.${secretKey});const db=new DatabaseSync(path.join(config.webServer.env.JUDGE_DATA_ROOT,'fixture.sqlite'),{readOnly:true});assert.equal(db.prepare('SELECT value FROM marker').get().value,42);db.close();`)}
      ],{env:process.env,encoding:'utf8'});
      assert.equal(worker.status,0,'worker config/SQLite contract failed');
      console.log(JSON.stringify({root}));
    } finally {rmSync(root,{recursive:true,force:true});}
  `);
  assert.equal(result.status, 0, 'runner/worker ephemeral scope contract failed');
  const first = JSON.parse(result.stdout).root;
  const second = run(`import {rmSync} from 'node:fs';${load}const root=config.webServer.env.JUDGE_DATA_ROOT;console.log(JSON.stringify({root}));rmSync(root,{recursive:true,force:true});`);
  assert.equal(second.status, 0);
  assert.notEqual(JSON.parse(second.stdout).root, first, 'independent invocations must stay isolated');
});

test('rejects partial, foreign and symlink inherited roots before starting a server', () => {
  const foreign = mkdtempSync(path.join(tmpdir(), 'foreign-judge-'));
  const validRoot = mkdtempSync(path.join(realpathSync(tmpdir()), 'trangui-judge-browser-'));
  const linkRoot = validRoot + 'link';
  symlinkSync(validRoot, linkRoot, process.platform === 'win32' ? 'junction' : 'dir');
  try {
    for (const additions of [
      { [rootKey]: foreign },
      { [secretKey]: 'x'.repeat(64) },
      { [rootKey]: foreign, [secretKey]: 'x'.repeat(64) },
      { [rootKey]: path.dirname(foreign), [secretKey]: 'x'.repeat(64) },
      { [rootKey]: foreign, [secretKey]: 'short' },
      { [rootKey]: validRoot, [secretKey]: 'short' },
      { [rootKey]: linkRoot, [secretKey]: 'x'.repeat(64) },
    ]) assert.notEqual(run(load, additions).status, 0, 'unsafe inherited config must fail closed');
  } finally {
    unlinkSync(linkRoot);
    rmSync(validRoot, { recursive: true, force: true });
    rmSync(foreign, { recursive: true, force: true });
  }
});
