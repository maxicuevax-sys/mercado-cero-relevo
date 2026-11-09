import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

async function fixture({ blocked = false, denied = false } = {}) {
  const values = new Map();
  const events = new EventTarget();
  const storage = {
    getItem: key => { if (denied) throw new DOMException("QA storage denied", "SecurityError"); return values.get(key) ?? null; },
    setItem: (key, value) => { if (blocked) throw new DOMException('QA full storage', 'QuotaExceededError'); values.set(key, value); },
  };
  globalThis.window = Object.assign(events, { localStorage: storage });
  globalThis.document = { documentElement: { dataset: {} } };
  const source = await fs.readFile(new URL('../src/lib/browser-preferences.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const preferences = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}#${Math.random()}`);
  return { ...preferences, values, events, allowWrites() { blocked = false; } };
}

test('visual and voice choices survive a failed write and same-tab notifications', async () => {
  const p = await fixture({ blocked: true });
  let observed;
  const stop = p.subscribeBrowserPreferences(() => { observed = p.readBrowserPreferences(); });
  p.updateBrowserPreferences({ textSize: 'xlarge', contrast: 'high', muted: true, voiceRate: 'slow' });
  assert.deepEqual(observed, { textSize: 'xlarge', contrast: 'high', muted: true, voiceRate: 'slow' });
  assert.deepEqual(p.readBrowserPreferences(), observed);
  assert.equal(document.documentElement.dataset.textSize, 'xlarge');
  assert.equal(document.documentElement.dataset.contrast, 'high');
  assert.equal(p.values.size, 0);
  stop();
});

test('normal writes merge persisted peer preferences without overwriting unrelated choices', async () => {
  const p = await fixture();
  p.values.set(p.PREFERENCE_KEYS.textSize, 'large');
  p.values.set(p.PREFERENCE_KEYS.voiceRate, 'fast');
  p.updateBrowserPreferences({ muted: true });
  assert.deepEqual(p.readBrowserPreferences(), { textSize: 'large', contrast: 'normal', voiceRate: 'fast', muted: true });
  assert.equal(p.values.get(p.PREFERENCE_KEYS.textSize), 'large');
});

test('cross-tab storage updates notify consumers and clear only the changed fallback', async () => {
  const p = await fixture({ blocked: true });
  p.updateBrowserPreferences({ textSize: 'xlarge', muted: true });
  let observed;
  const stop = p.subscribeBrowserPreferences(() => { observed = p.readBrowserPreferences(); });
  p.values.set(p.PREFERENCE_KEYS.textSize, 'large');
  const event = new Event('storage');
  Object.defineProperty(event, 'key', { value: p.PREFERENCE_KEYS.textSize });
  p.events.dispatchEvent(event);
  assert.equal(observed.textSize, 'large');
  assert.equal(observed.muted, true);
  stop();
});

test('storage clear from peer removes session fallbacks and successful later writes recover persistence', async () => {
  const p = await fixture({ blocked: true });
  p.updateBrowserPreferences({ muted: true });
  const stop = p.subscribeBrowserPreferences(() => {});
  const clear = new Event('storage'); Object.defineProperty(clear, 'key', { value: null });
  p.events.dispatchEvent(clear);
  assert.equal(p.readBrowserPreferences().muted, false);
  p.allowWrites(); p.updateBrowserPreferences({ muted: true });
  assert.equal(p.values.get(p.PREFERENCE_KEYS.muted), '1');
  stop();
});

test('visual updates preserve forced high contrast', async () => {
  const p = await fixture();
  document.documentElement.dataset.forcedContrast = '1';
  document.documentElement.dataset.contrast = 'high';
  p.updateBrowserPreferences({ textSize: 'large', contrast: 'normal' });
  assert.equal(document.documentElement.dataset.contrast, 'high');
  assert.equal(document.documentElement.dataset.textSize, 'large');
});

test('denied reads and writes still share the selected voice and visual session state', async () => {
  const p = await fixture({ blocked: true, denied: true });
  p.updateBrowserPreferences({ muted: true, voiceRate: 'fast', textSize: 'large' });
  assert.equal(p.readBrowserPreferences().muted, true);
  assert.equal(p.readBrowserPreferences().voiceRate, 'fast');
  assert.equal(p.readBrowserPreferences().textSize, 'large');
});

test('an unrelated storage event does not clear the current session choice', async () => {
  const p = await fixture({ blocked: true });
  p.updateBrowserPreferences({ muted: true });
  let notifications = 0;
  const stop = p.subscribeBrowserPreferences(() => { notifications++; });
  const event = new Event('storage'); Object.defineProperty(event, 'key', { value: 'another-app:key' });
  p.events.dispatchEvent(event);
  assert.equal(p.readBrowserPreferences().muted, true);
  assert.equal(notifications, 0); stop();
});
