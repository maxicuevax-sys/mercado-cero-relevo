const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
// Import has no socket.io-client requirement, stdin read, network or timer.
const { loadRuntimeTarget, buildMonitors, planBuildUpdate, reconcile, targetPathFromArgs } = require('./configure-kuma.cjs');
const target = { version: 1, buildSha: 'a'.repeat(40), requireJudgeAccounts: true };
const desired = buildMonitors(target);
const existing = desired.map((monitor, index) => ({ ...monitor, id: index + 1 }));

test('only target file path is configurable; runtime URLs remain fixed', () => {
    assert.equal(targetPathFromArgs([]), '/opt/mercado-cero/pilot/runtime-target.json');
    assert.equal(targetPathFromArgs(['--target', '/tmp/target.json']), '/tmp/target.json');
    assert.throws(() => targetPathFromArgs(['--host', 'elsewhere']));
    assert.throws(() => targetPathFromArgs(['--target']));
});

test('target contract: missing legacy fallback; malformed files fail closed', t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-runtime-target-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const file = path.join(directory, 'target.json');
    assert.equal(loadRuntimeTarget(file).requireJudgeAccounts, false);
    for (const value of ['{', 'null', JSON.stringify({ ...target, url: 'http://elsewhere' }),
        JSON.stringify({ ...target, version: true }), JSON.stringify({ ...target, buildSha: 'abc' }),
        JSON.stringify({ ...target, requireJudgeAccounts: 'true' }),
        '{"version":1,"version":1,"buildSha":"' + target.buildSha + '","requireJudgeAccounts":true}']) {
        fs.writeFileSync(file, value);
        assert.throws(() => loadRuntimeTarget(file));
    }
    fs.writeFileSync(file, '\uFEFF' + JSON.stringify(target));
    assert.deepEqual(loadRuntimeTarget(file), target);
});

test('unchanged existing monitors cause no API changes', async () => {
    await reconcile(() => assert.fail('Unexpected API call'), existing, target);
});

test('only changed managed SHA is edited, same ID and full settings preserved', async () => {
    const changed = existing.map(item => item.id === 1 ? { ...item, keyword: 'b'.repeat(40) } : item);
    const full = { ...changed[0], notificationIDList: { 8: true }, interval: 91, headers: 'private-preserved' };
    const calls = [];
    await reconcile(async (event, payload) => {
        calls.push([event, payload]);
        return event === 'getMonitor' ? { monitor: full } : { ok: true };
    }, changed, target);
    assert.deepEqual(calls.map(call => call[0]), ['getMonitor', 'editMonitor']);
    assert.equal(calls[0][1], 1);
    assert.deepEqual(calls[1][1], { ...full, keyword: target.buildSha });
    assert.equal(changed[0].keyword, 'b'.repeat(40));
});

test('foreign identity and duplicate managed names fail without an edit', async () => {
    assert.throws(() => planBuildUpdate({ ...existing[0], url: 'http://elsewhere' }, target));
    await assert.rejects(reconcile(() => assert.fail('Unexpected API call'), [existing[0], existing[0]], target));
});

test('missing build is created with desired SHA; existing unrelated monitors untouched', async () => {
    const calls = [];
    await reconcile(async (event, payload) => { calls.push([event, payload]); return { monitorID: 9 }; }, existing.slice(1), target);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'add');
    assert.equal(calls[0][1].keyword, target.buildSha);
    assert.equal(calls[0][1].url, 'http://127.0.0.1:4590/api/health');
});
