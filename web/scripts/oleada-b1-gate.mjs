#!/usr/bin/env node
/**
 * Gate de regresión de Operación B.1.
 *
 * Levanta `next start` con una SQLite temporal, ejecuta la regresión de
 * Caja/Ventas y apaga el servidor. Nunca usa web/data/mercado-cero.db ni los
 * puertos 3000/3100/3101. No modifica el motor financiero.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stopTestServer } from "./server-lifecycle.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const ROOT = path.resolve(WEB, "..");
const NEXT_BIN = path.join(WEB, "node_modules", "next", "dist", "bin", "next");
const BUILD_SHA_FILE = path.join(WEB, ".next", "BUILD_SHA");
const OUT_DIR = path.resolve(
  process.env.OLEADA_B1_OUT ?? path.join(ROOT, "quality-reports", "oleada-b-estabilizacion", "evidencia"),
);

let PORT = Number(process.env.B1_PORT ?? 3390);
if ([3000, 3100, 3101].includes(PORT)) {
  throw new Error("B1: el puerto del gate no puede ser 3000/3100/3101.");
}
let BASE = `http://127.0.0.1:${PORT}`;

function portAvailable(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => probe.close(() => resolve(true)));
    probe.listen(port, "127.0.0.1");
  });
}

function ephemeralPort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => (port ? resolve(port) : reject(new Error("sin puerto libre"))));
    });
  });
}

const built = JSON.parse(fs.readFileSync(BUILD_SHA_FILE, "utf8"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mercado-cero-b1-"));
const dbPath = path.join(tmp, "b1.db");
const backupDir = path.join(tmp, "backups");

let server = null;
let output = "";

async function waitForHealth(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server?.exitCode !== null) return { error: `next start salió con ${server.exitCode}` };
    try {
      const response = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2_000) });
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
    console.log(`B1 GATE: puerto ${PORT} ocupado; uso ${fallback}.`);
    PORT = fallback;
    BASE = `http://127.0.0.1:${PORT}`;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  server = spawn(process.execPath, [NEXT_BIN, "start", "-H", "127.0.0.1", "-p", String(PORT)], {
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
  });
  server.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  const health = await waitForHealth();
  if (health.error) {
    console.error(`B1 GATE: ${health.error}`);
    if (output.trim()) console.error(output.trim().split(/\r?\n/).slice(-30).join("\n"));
    process.exitCode = 1;
  } else if (health.body?.buildSha !== built.sha) {
    console.error(
      `B1 GATE: buildSha del servidor ${health.body?.buildSha ?? "?"} != ${built.sha}.`,
    );
    process.exitCode = 1;
  } else {
    console.log(`B1 GATE: servidor aislado ${BASE} buildSha=${built.sha}`);
    const result = spawnSync("python", ["scripts/oleada-b1-regression.py"], {
      cwd: WEB,
      env: {
        ...process.env,
        BASE_URL: BASE,
        OLEADA_B1_OUT: OUT_DIR,
        DATABASE_PATH: dbPath,
      },
      stdio: "inherit",
    });
    process.exitCode = result.status ?? 1;
  }
} finally {
  await stopTestServer(server ? { child: server } : null);
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    // Windows puede conservar el WAL un instante; el temporal es descartable.
  }
}
