#!/usr/bin/env node
/**
 * Revisa la configuración antes de cambiar entre demo y modo real.
 *
 * Uso:
 *   node scripts/verify-env.mjs
 *
 * No imprime secretos: solo presencia, longitud y estado del servidor.
 * No llama a la API de pey ni crea cobros.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, ".env.local");

function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  const values = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equals = trimmed.indexOf("=");
    if (equals === -1) continue;
    const key = trimmed.slice(0, equals).trim();
    let value = trimmed.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const env = loadEnv(ENV_PATH);
const requireProd = process.argv.includes("--prod");
const apiKey = env.PEY_API_KEY ?? "";
const secret = env.PEY_WEBHOOK_SECRET ?? "";
const openAiKey = env.OPENAI_API_KEY ?? "";
const operatorToken = env.OPERATOR_ACCESS_TOKEN ?? "";
const appUrl = (env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const configuredDemo =
  env.DEMO_MODE === "true" ? true : env.DEMO_MODE === "false" ? false : !apiKey;
const isQuickTunnel = /\.trycloudflare\.com$/i.test(new URL(appUrl).hostname);

const checks = [];
function check(name, ok, detail, level = "FAIL") {
  checks.push({ name, ok, detail, level: ok ? "PASS" : level });
}

if (requireProd) {
  check(
    "DEMO_MODE desactivado (--prod)",
    !configuredDemo,
    configuredDemo ? "DEMO_MODE sigue activo" : "DEMO_MODE=false (modo real)",
    "FAIL",
  );
}

check(
  "PEY_API_KEY",
  !configuredDemo ? apiKey.length >= 20 : true,
  apiKey
    ? `configurada (${apiKey.length} caracteres)`
    : "vacía (correcto en demo, obligatoria en real)",
  configuredDemo && !requireProd ? "WARN" : "FAIL",
);
check(
  "PEY_WEBHOOK_SECRET",
  secret.length >= 16,
  secret ? `configurado (${secret.length} caracteres)` : "vacío",
  configuredDemo && !requireProd ? "WARN" : "FAIL",
);
check(
  "OPENAI_API_KEY",
  openAiKey.length >= 20,
  openAiKey ? `configurada (${openAiKey.length} caracteres)` : "vacía (voz/transcripción deshabilitada)",
  requireProd ? "FAIL" : "WARN",
);
check(
  "APP_URL HTTPS",
  (configuredDemo && !requireProd) || appUrl.startsWith("https://"),
  appUrl,
  configuredDemo && !requireProd ? "WARN" : "FAIL",
);
check(
  "Dominio estable (sin quick tunnel efímero)",
  !isQuickTunnel,
  isQuickTunnel
    ? `${appUrl} es un quick tunnel efímero (*.trycloudflare.com)`
    : appUrl,
  requireProd ? "FAIL" : "WARN",
);
check(
  "OPERATOR_ACCESS_TOKEN (perímetro privado)",
  operatorToken.length >= 16,
  operatorToken
    ? `configurado (${operatorToken.length} caracteres)`
    : "no configurado (depende exclusivamente de Cloudflare Access)",
  "WARN",
);
check(
  "Modo de la app",
  true,
  configuredDemo
    ? "DEMO — los pagos se simulan y se marcan como demo"
    : "REAL — los links se crean con pey y solo el webhook confirma",
);

let server = null;
try {
  const healthRes = await fetch(`${appUrl}/api/health`, {
    signal: AbortSignal.timeout(8000),
  });
  if (healthRes.ok) {
    const health = await healthRes.json();
    if (typeof health?.demoMode === "boolean") {
      server = health;
    }
  }
  if (!server) {
    const response = await fetch(`${appUrl}/api/dashboard`, {
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) server = await response.json();
  }
} catch {
  // Se reporta abajo.
}

check(
  "Servidor alcanzable",
  Boolean(server),
  server ? appUrl : `sin respuesta en ${appUrl}`,
  "WARN",
);
if (server) {
  check(
    "Modo del servidor coincide con .env.local",
    server.demoMode === configuredDemo,
    server.demoMode
      ? "servidor en demo"
      : "servidor en real (reinicia si acabas de cambiar el archivo)",
  );
}

for (const item of checks) {
  console.log(`${item.level.padEnd(4)}  ${item.name} — ${item.detail}`);
}

const failed = checks.filter((item) => !item.ok && item.level === "FAIL");
const warnings = checks.filter((item) => !item.ok && item.level === "WARN");

console.log("");
if (failed.length > 0) {
  console.log(`${failed.length} problema(s) bloqueante(s).`);
  process.exitCode = 1;
} else if (warnings.length > 0) {
  console.log(`${warnings.length} aviso(s). La demo puede correr; el modo real no está completo.`);
} else {
  console.log("Configuración consistente.");
}

if (!configuredDemo) {
  console.log("");
  console.log("Antes de un pago real:");
  console.log("  1. Usa una DATABASE_PATH limpia o reinicia la demo.");
  console.log("  2. Confirma que APP_URL es el túnel HTTPS vivo.");
  console.log("  3. Cobra $0.01 y verifica el webhook firmado y la conciliación.");
  console.log("  4. No presentes un pago simulado como real.");
}
