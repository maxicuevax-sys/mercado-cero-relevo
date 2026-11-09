import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function inspectSyntheticEnv(appUrl) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "trangui-env-display-"));
  try {
    const entry = path.join(root, "verify-env.mjs");
    fs.copyFileSync(new URL("./verify-env.mjs", import.meta.url), entry);
    fs.writeFileSync(path.join(root, ".env.local"), `DEMO_MODE=true\nAPP_URL=${appUrl}\n`);
    // This contract never reads workspace credentials or opens a connection.
    const disableFetch = "data:text/javascript,globalThis.fetch=async()=>{throw new Error('test offline')}";
    return spawnSync(process.execPath, ["--import", disableFetch, entry], { cwd: root, encoding: "utf8" });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test("environment diagnostics omit URL credentials, query values and fragment while retaining target", () => {
  const result = inspectSyntheticEnv("https://QA_USER:QA_PASSWORD@127.0.0.1:4599/base?token=QA_TOKEN&other=QA_OTHER#QA_FRAGMENT");
  assert.equal(result.status, 0, result.stderr);
  for (const sentinel of ["QA_USER", "QA_PASSWORD", "QA_TOKEN", "QA_OTHER", "QA_FRAGMENT"]) {
    assert(!result.stdout.includes(sentinel), sentinel);
    assert(!result.stderr.includes(sentinel), sentinel);
  }
  assert(result.stdout.includes("https://127.0.0.1:4599/base"));
  assert(result.stdout.includes("consulta omitida"));
  assert(result.stdout.includes("fragmento omitido"));
});

test("invalid URL has a safe diagnostic rather than an exception echoing input", () => {
  const result = inspectSyntheticEnv("QA_INVALID_SECRET");
  assert.equal(result.status, 1);
  assert(!result.stdout.includes("QA_INVALID_SECRET"));
  assert(!result.stderr.includes("QA_INVALID_SECRET"));
  assert(result.stdout.includes("APP_URL inválida"));
});
