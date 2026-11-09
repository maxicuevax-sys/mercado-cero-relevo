import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function invoke(evidence, args = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "trangui-report-contract-"));
  try {
    const scripts = path.join(root, "web", "scripts");
    fs.mkdirSync(scripts, { recursive: true });
    fs.mkdirSync(path.join(root, "harness", "evidence"), { recursive: true });
    const report = path.join(scripts, "harness-report.mjs");
    fs.copyFileSync(new URL("./harness-report.mjs", import.meta.url), report);
    fs.writeFileSync(path.join(root, "harness", "evidence", "latest.json"), JSON.stringify(evidence));
    const result = spawnSync(process.execPath, [report, ...args], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

const malicious = "x|`<script>alert(1)</script>&amp;\\*_[link](javascript:alert(1))\r\n# injected\t\u001b[31m\u202e";
const evidence = {
  mode: malicious, ok: false, complete: false, partial: true, buildBound: false,
  gitAtStart: { sha: malicious, branch: malicious, dirty: false }, gitAtEnd: { dirty: true },
  serverBuildSha: malicious, startedAt: malicious, endedAt: malicious, baseUrl: malicious,
  node: malicious, os: malicious,
  gates: [{ id: malicious, ok: false, exitCode: 17, expected: [malicious, "second"], durationMs: 23, artifacts: [{ path: malicious, exists: false }] }],
  notRun: [malicious], notRunReasons: { [malicious]: malicious }, reasons: [malicious], error: malicious,
};

test("Markdown report confines every evidence value to text without losing gates or control characters", () => {
  const output = invoke(evidence);
  assert(!output.includes("<script>"));
  assert(!output.includes("[link](javascript:"));
  assert(!output.includes("\r"));
  assert(!output.includes("\u001b"));
  assert(!output.includes("\u202e"));
  assert(!output.includes("\n# injected"));
  assert(output.includes("&#124;"), "pipe must be encoded, not partially backslash escaped");
  assert(output.includes("&#96;"));
  assert(output.includes("&lt;") || output.includes("&#60;"));
  assert(output.includes("&#92;r&#92;n"));
  assert(output.includes("&#92;t"));
  assert(output.includes("&#92;u001b"));
  assert(output.includes("&#92;u202e"));
  const rows = output.split("\n").filter(line => line.startsWith("|"));
  assert.equal(rows.length, 3, "untrusted values cannot introduce table rows");
  assert(rows.every(row => (row.match(/\|/g) ?? []).length === 7), "six cells per row");
  assert(rows[2].includes("| FAIL | 17 |"));
  assert(rows[2].includes("| 23 | FALTA"));
  assert(output.includes("ok:no · complete:no · build:no"));
});

test("JSON report retains the complete original evidence including hostile text", () => {
  assert.deepEqual(JSON.parse(invoke(evidence, ["--json"])), evidence);
});

test("normal report preserves all gates and artifact entries without inventing a pass", () => {
  const output = invoke({ mode: "static", ok: false, complete: true, buildBound: false, gates: [
    { id: "lint", ok: true, exitCode: 0, expected: [0], durationMs: 2, artifacts: [{ path: "web/out.json", exists: true }] },
    { id: "types", ok: false, exitCode: 2, expected: [0], durationMs: 3, artifacts: [{ path: "missing.json", exists: false }] },
  ] });
  assert.match(output, /lint.*\| PASS \| 0/);
  assert.match(output, /types.*\| FAIL \| 2/);
  assert(output.includes("web/out.json"));
  assert(output.includes("missing.json"));
});
