#!/usr/bin/env node
/**
 * Ejecuta mobile-320-e2e.py contra un servidor aislado.
 *
 * El script del carril mobile QA exige un servidor ya levantado en
 * P0_BASE_URL. Este wrapper levanta `next start` con SQLite temporal,
 * verifica que el buildSha servido es el del build local y limpia todo.
 * Nunca usa :3000 ni :3101.
 */

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stopTestServer } from "./server-lifecycle.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const NEXT_BIN = path.join(WEB, "node_modules", "next", "dist", "bin", "next");
const PORT = Number(process.env.MOBILE_320_PORT ?? 3214);
const BASE = `http://127.0.0.1:${PORT}`;
const BUILD_SHA_FILE = path.join(WEB, ".next", "BUILD_SHA");

if (PORT === 3000 || PORT === 3101) {
  console.error("MOBILE 320 GATE: puerto reservado; usa un puerto aislado.");
  process.exit(1);
}
if (!fs.existsSync(path.join(WEB, ".next", "BUILD_ID")) || !fs.existsSync(BUILD_SHA_FILE)) {
  console.error("MOBILE 320 GATE: falta build con identidad. Corre `npm run build`.");
  process.exit(1);
}

const built = JSON.parse(fs.readFileSync(BUILD_SHA_FILE, "utf8"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mercado-cero-mobile-320-gate-"));
const dbPath = path.join(tmp, "mobile-320.db");
const backupDir = path.join(tmp, "backups");

let server = null;
let serverOutput = "";

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
      // todavía no escucha
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return { error: "timeout esperando /api/health" };
}

try {
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
    console.error(`MOBILE 320 GATE: ${health.error}`);
    if (serverOutput.trim()) console.error(serverOutput.trim().split(/\r?\n/).slice(-30).join("\n"));
    process.exitCode = 1;
  } else if (health.body?.buildSha !== built.sha) {
    console.error(
      `MOBILE 320 GATE: buildSha del servidor ${health.body?.buildSha ?? "?"} != ${built.sha}.`,
    );
    process.exitCode = 1;
  } else {
    console.log(`MOBILE 320 GATE: servidor aislado ${BASE} buildSha=${built.sha}`);
    const result = spawnSync("python", ["scripts/mobile-320-e2e.py"], {
      cwd: WEB,
      env: {
        ...process.env,
        P0_BASE_URL: BASE,
        BASE_URL: BASE,
        DATABASE_PATH: dbPath,
        DEMO_MODE: "true",
      },
      stdio: "inherit",
      timeout: 600_000,
    });
    if (result.error) {
      console.error(`MOBILE 320 GATE: ${result.error.message}`);
      process.exitCode = 1;
    } else {
      process.exitCode = result.status ?? 1;
    }
  }
} finally {
  await stopTestServer(server ? { child: server } : null);
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    // Windows puede tardar en soltar WAL; no invalida el gate.
  }
}
