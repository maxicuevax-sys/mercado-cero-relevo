import { spawnSync } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";

/** Test fixtures must release their listener before reusing the same port. */
export async function stopTestServer(server, { timeoutMs = 5000 } = {}) {
  if (!server) return;
  const { child, log } = server;
  const exited = () => child.exitCode !== null || child.signalCode !== null;
  try {
    if (!exited()) {
      const stopped = once(child, "exit", { signal: AbortSignal.timeout(timeoutMs) });
      try {
        if (process.platform === "win32") {
          spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", timeout: 20000, windowsHide: true });
        } else child.kill("SIGTERM");
        await stopped;
      } catch {
        if (!exited()) {
          const forced = once(child, "exit", { signal: AbortSignal.timeout(timeoutMs) });
          child.kill("SIGKILL");
          await forced;
        }
      }
    }
  } finally {
    if (typeof log === "number") {
      try { fs.closeSync(log); } catch { /* Already closed by the fixture. */ }
    }
  }
}
