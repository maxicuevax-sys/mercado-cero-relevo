#!/usr/bin/env node
/**
 * Ejecuta checkout-audit.py contra un servidor aislado.
 *
 * El checkout crea un pedido demo y lo paga; no debe contaminar la DB de la
 * demo compartida ni depender de un servidor ya levantado. Este wrapper
 * arranca `next start` en 127.0.0.1:3215 con SQLite temporal, comprueba que
 * `/api/health` sirve el mismo build que `.next/BUILD_SHA` y limpia servidor y
 * temporales en `finally`. Nunca usa :3000 ni :3101.
 */

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const NEXT_BIN = path.join(WEB, "node_modules", "next", "dist", "bin", "next");
const PORT = Number(process.env.CHECKOUT_PORT ?? 3215);
const BASE = `http://127.0.0.1:${PORT}`;
const BUILD_SHA_FILE = path.join(WEB, ".next", "BUILD_SHA");

if (PORT === 3000 || PORT === 3101) {
  console.error("CHECKOUT GATE: puerto reservado; usa un puerto aislado.");
  process.exit(1);
}
if (
  !fs.existsSync(path.join(WEB, ".next", "BUILD_ID")) ||
  !fs.existsSync(BUILD_SHA_FILE)
) {
  console.error("CHECKOUT GATE: falta build con identidad. Corre `npm run build`.");
  process.exit(1);
}

const built = JSON.parse(fs.readFileSync(BUILD_SHA_FILE, "utf8"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mercado-cero-checkout-gate-"));
const dbPath = path.join(tmp, "checkout.db");
const backupDir = path.join(tmp, "backups");

let server = null;
let serverOutput = "";

function stopServer() {
  if (!server || server.killed) return;
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], {
        stdio: "ignore",
        timeout: 20_000,
      });
    } else {
      server.kill();
    }
  } catch {
    // best effort
  }
}

function cleanup() {
  stopServer();
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    // Windows puede tardar en soltar WAL; no invalida el gate.
  }
}

async function waitForHealth(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server?.exitCode !== null) {
      return { error: `next start salió con ${server.exitCode}` };
    }
    try {
      const response = await fetch(`${BASE}/api/health`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) return { body: await response.json() };
    } catch {
      // todavía arrancando
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return { error: "timeout esperando /api/health" };
}

async function main() {
  server = spawn(
    process.execPath,
    [NEXT_BIN, "start", "-H", "127.0.0.1", "-p", String(PORT)],
    {
      cwd: WEB,
      env: {
        ...process.env,
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        DEMO_MODE: "true",
        DATABASE_PATH: dbPath,
        DATABASE_BACKUP_DIR: backupDir,
        APP_URL: BASE,
        OPENAI_API_KEY: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
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
    console.error(`CHECKOUT GATE: ${health.error}`);
    if (serverOutput.trim()) {
      console.error(serverOutput.trim().split(/\r?\n/).slice(-30).join("\n"));
    }
    return 1;
  }
  if (health.body?.buildSha !== built.sha) {
    console.error(
      `CHECKOUT GATE: buildSha del servidor ${health.body?.buildSha ?? "?"} != ${built.sha}.`,
    );
    return 1;
  }

  console.log(`CHECKOUT GATE: servidor aislado ${BASE} buildSha=${built.sha}`);
  const result = spawnSync("python", ["scripts/checkout-audit.py"], {
    cwd: WEB,
    env: {
      ...process.env,
      CHECKOUT_BASE_URL: BASE,
      BASE_URL: BASE,
      DATABASE_PATH: dbPath,
      DATABASE_BACKUP_DIR: backupDir,
      DEMO_MODE: "true",
    },
    stdio: "inherit",
    timeout: 240_000,
  });
  if (result.error) {
    console.error(`CHECKOUT GATE: ${result.error.message}`);
    return 1;
  }
  if (result.status !== 0) {
    console.error(
      `CHECKOUT GATE: contrato falló con ${result.status ?? result.signal}`,
    );
    return result.status ?? 1;
  }
  console.log("CHECKOUT GATE OK");
  return 0;
}

let exitCode = 1;
try {
  exitCode = await main();
} finally {
  cleanup();
}
process.exitCode = exitCode;
