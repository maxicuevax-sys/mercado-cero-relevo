#!/usr/bin/env node
/**
 * Ejecuta p0-venta-e2e.py contra un servidor aislado.
 *
 * El script Python original asume un servidor ya levantado en P0_BASE_URL.
 * Este wrapper levanta `next start` con una SQLite temporal, verifica que el
 * build servido coincide con el HEAD y limpia todo al terminar. Nunca usa
 * :3000 ni la base de la demo compartida.
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
let PORT = Number(process.env.P0_VENTA_PORT ?? 3211);
let BASE = `http://127.0.0.1:${PORT}`;
const BUILD_SHA_FILE = path.join(WEB, ".next", "BUILD_SHA");

if (PORT === 3000 || PORT === 3101) {
  console.error("P0 VENTA GATE: puerto reservado; usa un puerto aislado.");
  process.exit(1);
}
if (!fs.existsSync(path.join(WEB, ".next", "BUILD_ID")) || !fs.existsSync(BUILD_SHA_FILE)) {
  console.error("P0 VENTA GATE: falta build con identidad. Corre `npm run build`.");
  process.exit(1);
}

function portAvailable(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.unref();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => probe.close(() => resolve(true)));
    probe.listen(port);
  });
}

function ephemeralPort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => (port ? resolve(port) : reject(new Error("sin puerto libre"))));
    });
  });
}

const built = JSON.parse(fs.readFileSync(BUILD_SHA_FILE, "utf8"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mercado-cero-p0-venta-gate-"));
const dbPath = path.join(tmp, "p0-venta.db");
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
  if (!(await portAvailable(PORT))) {
    const fallback = await ephemeralPort();
    console.log(
      `P0 VENTA GATE: puerto ${PORT} ocupado por otro servidor; uso el puerto libre ${fallback}.`,
    );
    PORT = fallback;
    BASE = `http://127.0.0.1:${PORT}`;
  }

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
    console.error(`P0 VENTA GATE: ${health.error}`);
    if (serverOutput.trim()) console.error(serverOutput.trim().split(/\r?\n/).slice(-30).join("\n"));
    process.exitCode = 1;
  } else if (health.body?.buildSha !== built.sha) {
    console.error(
      `P0 VENTA GATE: buildSha del servidor ${health.body?.buildSha ?? "?"} != ${built.sha}.`,
    );
    process.exitCode = 1;
  } else {
    console.log(`P0 VENTA GATE: servidor aislado ${BASE} buildSha=${built.sha}`);
    const result = spawnSync("python", ["scripts/p0-venta-e2e.py"], {
      cwd: WEB,
      env: {
        ...process.env,
        P0_BASE_URL: BASE,
        P0_EXTERNAL_SERVER: "0",
        DATABASE_PATH: dbPath,
        DEMO_MODE: "true",
      },
      stdio: "inherit",
      timeout: 600_000,
    });
    if (result.error) {
      console.error(`P0 VENTA GATE: ${result.error.message}`);
      process.exitCode = 1;
    } else {
      process.exitCode = result.status ?? 1;
    }
  }
} finally {
  stopServer();
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    // Windows puede tardar en soltar WAL; no invalida el gate.
  }
}
