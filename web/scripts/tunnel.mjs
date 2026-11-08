#!/usr/bin/env node
/**
 * Levanta un túnel HTTPS con Cloudflare (cloudflared) hacia el servidor local
 * y actualiza APP_URL en web/.env.local para pruebas reales y webhooks de Pey.
 *
 * Uso:
 *   node scripts/tunnel.mjs [--port=3000] [--no-update-env]
 *
 * No imprime secretos ni expone datos sensibles.
 */

import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const ENV_PATH = path.join(WEB, ".env.local");

const args = process.argv.slice(2);
const portArg = args.find((a) => a.startsWith("--port="));
const PORT = portArg ? portArg.split("=")[1] : process.env.PORT ?? "3000";
const updateEnv = !args.includes("--no-update-env");

function findCloudflaredBinary() {
  try {
    const whichCmd = process.platform === "win32" ? "where cloudflared" : "which cloudflared";
    const pathFound = execSync(whichCmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split(/\r?\n/)[0]
      ?.trim();
    if (pathFound && fs.existsSync(pathFound)) return pathFound;
  } catch {
    // Buscar en rutas comunes en Windows
  }

  const commonWinPaths = [
    "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe",
    "C:\\Program Files\\cloudflared\\cloudflared.exe",
  ];

  for (const candidate of commonWinPaths) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return "cloudflared";
}

function updateEnvFile(publicUrl) {
  if (!fs.existsSync(ENV_PATH)) {
    console.log(`[túnel] AVISO: No existe ${ENV_PATH}; creando archivo con APP_URL.`);
    fs.writeFileSync(ENV_PATH, `APP_URL=${publicUrl}\n`, "utf8");
    return;
  }

  const content = fs.readFileSync(ENV_PATH, "utf8");
  const lines = content.split(/\r?\n/);
  let found = false;

  const nextLines = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("APP_URL=")) {
      found = true;
      return `APP_URL=${publicUrl}`;
    }
    return line;
  });

  if (!found) {
    nextLines.push(`APP_URL=${publicUrl}`);
  }

  fs.writeFileSync(ENV_PATH, nextLines.join("\n"), "utf8");
  console.log(`[túnel] APP_URL actualizado en .env.local -> ${publicUrl}`);
}

async function verifyTunnelHealth(publicUrl) {
  try {
    const res = await fetch(`${publicUrl}/api/health`, {
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      console.log(`[túnel] Conectividad HTTPS verificada (GET /api/health -> 200 OK).`);
      return true;
    }
    console.log(`[túnel] El endpoint respondió HTTP ${res.status}.`);
    return true;
  } catch (err) {
    console.log(`[túnel] Esperando tráfico HTTP en el túnel (${err.message})...`);
    return false;
  }
}

async function main() {
  const binary = findCloudflaredBinary();
  console.log(`[túnel] Iniciando túnel Cloudflare hacia http://localhost:${PORT}...`);
  console.log(`[túnel] Binario: ${binary}`);

  const child = spawn(binary, ["tunnel", "--url", `http://localhost:${PORT}`], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  let tunnelUrl = null;
  const urlRegex = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/g;

  function handleData(chunk) {
    const text = chunk.toString();
    const matches = text.match(urlRegex);
    if (matches && !tunnelUrl) {
      tunnelUrl = matches[0];
      onTunnelEstablished(tunnelUrl);
    }
  }

  child.stdout.on("data", handleData);
  child.stderr.on("data", handleData);

  child.on("error", (err) => {
    console.error(`[túnel] Error al ejecutar cloudflared: ${err.message}`);
    console.error(`Asegúrate de tener cloudflared instalado.`);
    process.exit(1);
  });

  child.on("close", (code) => {
    console.log(`[túnel] El proceso de cloudflared finalizó con código ${code}.`);
    process.exit(code ?? 0);
  });

  async function onTunnelEstablished(url) {
    console.log("");
    console.log("=======================================================================");
    console.log("  TÚNEL HTTPS CLOUDFLARE ACTIVO");
    console.log("=======================================================================");
    console.log(`  URL Pública:       ${url}`);
    console.log(`  Webhook para Pey:  ${url}/api/webhooks/pey`);
    console.log(`  Destino local:     http://localhost:${PORT}`);
    console.log("=======================================================================");

    if (updateEnv) {
      updateEnvFile(url);
    }

    // Esperar un segundo y verificar
    setTimeout(async () => {
      await verifyTunnelHealth(url);
      console.log("\nPresiona Ctrl+C en cualquier momento para cerrar el túnel.\n");
    }, 1500);
  }

  const cleanup = () => {
    console.log("\n[túnel] Cerrando túnel Cloudflare...");
    try {
      child.kill("SIGTERM");
    } catch {
      // Ignorar si ya murió
    }
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

main().catch((err) => {
  console.error(`[túnel] Error fatal: ${err.message}`);
  process.exit(1);
});

