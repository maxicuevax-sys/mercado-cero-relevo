import assert from "node:assert/strict";
import { test } from "node:test";
import { clearAppBrowserState } from "./browser-state.ts";

function storageFixture(entries) {
  const values = new Map(Object.entries(entries));
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    removeItem(key) { values.delete(key); },
    entries() { return Object.fromEntries(values); },
  };
}

test("account transitions clear both app namespaces in local and session storage only", () => {
  const local = storageFixture({
    "mercado-cero:caja-draft:v2": "previous user's sale",
    "mercado-cero:onboarding:v1": "previous user's profile",
    "trangui:preferences": "demo preferences",
    "mukani:preferences": "keep",
    "mercado-cero-other:state": "keep",
    "trangui-other:state": "keep",
    unrelated: "keep",
  });
  const session = storageFixture({
    "mercado-cero:route-focus-seen": "1",
    "trangui:dismissed": "1",
    "other-project:session": "keep",
  });
  clearAppBrowserState(local, session);
  assert.deepEqual(local.entries(), {
    "mukani:preferences": "keep",
    "mercado-cero-other:state": "keep",
    "trangui-other:state": "keep",
    unrelated: "keep",
  });
  assert.deepEqual(session.entries(), { "other-project:session": "keep" });
});

test("blocked cleanup fails visibly instead of pretending account state was removed", () => {
  const blocked = { length: 1, key() { return "mercado-cero:caja-draft:v2"; }, removeItem() { throw new Error("blocked"); } };
  assert.throws(() => clearAppBrowserState(blocked, storageFixture({})), /blocked/);
});
