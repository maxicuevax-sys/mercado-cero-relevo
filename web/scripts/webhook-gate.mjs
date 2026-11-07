#!/usr/bin/env node
/**
 * Ejecuta el contrato del webhook contra un servidor aislado con SQLite
 * temporal. El webhook crea pagos `pey` reales (firma HMAC válida), por lo que
 * no debe contaminar la DB de la demo compartida ni bloquear el reset de
 * `preflight`. Nunca usa :3000 ni :3101.
 */

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const NEXT_BIN = path.join(WEB, "node_modules", "next", "dist", "bin", "next");
const REQUESTED_PORT = Number(process.env.WEBHOOK_PORT ?? 0);
let PORT = REQUESTED_PORT || 3193;
let BASE = `http://127.0.0.1:${PORT}`;
const BUILD_SHA_FILE = path.join(WEB, ".next", "BUILD_SHA");
// El gate es autocontenido: no depende de .env.local. Si hay un secreto en el
// entorno se respeta; si no, se genera uno solo para este proceso aislado.
const WEBHOOK_SECRET =
  process.env.PEY_WEBHOOK_SECRET ??
  `whsec_${Buffer.from("mercado-cero-webhook-gate").toString("base64")}`;

if (PORT === 3000 || PORT === 3101) {
  console.error("WEBHOOK GATE: puerto reservado; usa un puerto aislado.");
  process.exit(1);
}
if (!fs.existsSync(path.join(WEB, ".next", "BUILD_ID")) || !fs.existsSync(BUILD_SHA_FILE)) {
  console.error("WEBHOOK GATE: falta build con identidad. Corre `npm run build`.");
  process.exit(1);
}

const built = JSON.parse(fs.readFileSync(BUILD_SHA_FILE, "utf8"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mercado-cero-webhook-gate-"));
const dbPath = path.join(tmp, "webhook.db");
const backupDir = path.join(tmp, "backups");

let server = null;
let serverOutput = "";

function stopServer() {
  if (!server || server.killed) return;
  try {
    server.kill();
  } catch {
    // best effort
  }
}

function cleanup() {
  stopServer();
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    // best effort
  }
}

async function findFreePort(start) {
  for (let port = start; port < start + 50; port += 1) {
    const free = await new Promise((resolve) => {
      const probe = net.createServer();
      probe.once("error", () => resolve(false));
      probe.once("listening", () => probe.close(() => resolve(true)));
      probe.listen(port, "127.0.0.1");
    });
    if (free) return port;
  }
  throw new Error(`no hay puerto libre desde ${start}`);
}

async function waitForHealth(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server?.exitCode !== null) return { error: `next start salió con ${server.exitCode}` };
    try {
      const response = await fetch(`${BASE}/api/health`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) return { body: await response.json() };
    } catch {
      // aún arrancando
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return { error: "timeout esperando /api/health" };
}

async function main() {
  PORT = await findFreePort(PORT);
  BASE = `http://127.0.0.1:${PORT}`;
  server = spawn(
    process.execPath,
    [NEXT_BIN, "start", "-H", "127.0.0.1", "-p", String(PORT)],
    {
      cwd: WEB,
      env: {
        ...process.env,
        DATABASE_PATH: dbPath,
        DATABASE_BACKUP_DIR: backupDir,
        DEMO_MODE: "true",
        PEY_WEBHOOK_SECRET: WEBHOOK_SECRET,
        // El contrato firma eventos pey reales en modo demo. Al terminar, el
        // reset normal debe bloquearse por precaución; este gate usa una DB
        // temporal y fuerza la limpieza conservando esos pagos firmados.
        FORCE_DEMO_RESET: "1",
        APP_URL: BASE,
        OPENAI_API_KEY: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });

  const health = await waitForHealth();
  if (health.error) {
    console.error(`WEBHOOK GATE: ${health.error}`);
    if (serverOutput.trim()) {
      console.error(serverOutput.trim().split(/\r?\n/).slice(-30).join("\n"));
    }
    return 1;
  }
  if (health.body?.buildSha !== built.sha) {
    console.error(
      `WEBHOOK GATE: buildSha del servidor ${health.body?.buildSha ?? "?"} != ${built.sha}`,
    );
    return 1;
  }

  console.log(`WEBHOOK GATE: servidor aislado ${BASE} buildSha=${built.sha}`);
  const result = spawnSync(process.execPath, ["scripts/webhook-contract.mjs"], {
    cwd: WEB,
    env: {
      ...process.env,
      BASE_URL: BASE,
      APP_URL: BASE,
      PEY_WEBHOOK_SECRET: WEBHOOK_SECRET,
      DATABASE_PATH: dbPath,
      DATABASE_BACKUP_DIR: backupDir,
    },
    stdio: "inherit",
    timeout: 150_000,
  });
  if (result.status !== 0) {
    console.error(`WEBHOOK GATE: contrato falló con ${result.status ?? result.signal}`);
    return result.status ?? 1;
  }
  console.log("WEBHOOK OK");
  return 0;
}

let exitCode = 1;
try {
  exitCode = await main();
} finally {
  cleanup();
}
process.exitCode = exitCode;
