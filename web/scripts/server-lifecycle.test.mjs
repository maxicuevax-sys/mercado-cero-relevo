import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { stopTestServer } from "./server-lifecycle.mjs";

test("shutdown waits for a delayed child exit before the next server can start", async () => {
  const child = spawn(process.execPath, ["-e", `process.on('SIGTERM', () => setTimeout(() => process.exit(0), 180)); console.log('ready'); setInterval(() => {}, 1000);`], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  await once(child.stdout, "data");
  const started = Date.now();
  await stopTestServer({ child });
  assert.ok(child.exitCode !== null || child.signalCode !== null, "Stop must await actual exit, not merely send a signal");
  if (process.platform !== "win32") assert.ok(Date.now() - started >= 150);
});

test("a child ignoring SIGTERM is terminated within the bounded fallback", { skip: process.platform === "win32" ? "Windows uses taskkill instead of POSIX signal handlers" : false }, async () => {
  const child = spawn(process.execPath, ["-e", `process.on('SIGTERM', () => {}); console.log('ready'); setInterval(() => {}, 1000);`], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  await once(child.stdout, "data");
  await stopTestServer({ child }, { timeoutMs: 100 });
  assert.equal(child.signalCode, "SIGKILL");
});
