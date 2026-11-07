/** Real production build on a temporary demo SQLite; never the candidate DB. */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mercado-cero-a2-"));
const port = await new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", () => {
    const port = probe.address().port;
    probe.close(() => resolve(port));
  });
});
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], {
  env: { ...process.env, DEMO_MODE: "true", DATABASE_PATH: path.join(tmp, "a2.db"), DATABASE_BACKUP_DIR: path.join(tmp, "backups"), APP_URL: base },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
server.stdout.on("data", chunk => { output += chunk; });
server.stderr.on("data", chunk => { output += chunk; });
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw Error(output);
    try {
      const response = await fetch(base + "/api/health");
      if (response.ok) { ready = true; console.log("A2 isolated build", await response.text()); break; }
    } catch { /* wait for owned temporary server */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!ready) throw Error("A2 isolated server did not start");
  const env = { ...process.env, BASE_URL: base, CAPTURE_PHASE: "isolated-after", A2_EPHEMERAL: "true" };
  const capture = spawnSync("python", ["scripts/parity-a2.py"], { env, stdio: "inherit" });
  if (capture.status !== 0) throw Error("A2 captures/accessibility failed");
  const flows = spawnSync("python", ["scripts/parity-a2-flows.py"], { env, stdio: "inherit" });
  if (flows.status !== 0) throw Error("A2 functional flows failed");
  console.log("A2 RUNTIME OK");
} finally {
  server.kill();
}
