#!/usr/bin/env node
/**
 * Preflight de demo: servidor, túnel, datos sembrados, QR y respaldos.
 *
 * Uso:
 *   node scripts/preflight.mjs
 *
 * Solo lee. No reinicia datos y no imprime secretos.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DEMO = path.join(ROOT, "..", "demo");
const ENV_PATH = path.join(ROOT, ".env.local");
const LOCAL = "http://localhost:3000";

function loadEnv(file) {
  const values = {};
  if (!fs.existsSync(file)) return values;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equals = trimmed.indexOf("=");
    if (equals === -1) continue;
    let value = trimmed.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[trimmed.slice(0, equals).trim()] = value;
  }
  return values;
}

const env = loadEnv(ENV_PATH);
const appUrl = (env.APP_URL ?? LOCAL).replace(/\/+$/, "");
const checks = [];

function check(name, ok, detail = "") {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function get(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return { error: `HTTP ${response.status}` };
    return await response.json();
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : String(cause) };
  }
}

console.log(`Local:  ${LOCAL}`);
console.log(`Público: ${appUrl}`);
console.log("");

const localDash = await get(`${LOCAL}/api/dashboard`);
check("Servidor local responde", !localDash.error, localDash.error ?? "200");

const pubDash = await get(`${appUrl}/api/dashboard`);
check("Túnel público responde", !pubDash.error, pubDash.error ?? "200");

if (!pubDash.error) {
  check("La app está en modo demo", pubDash.demoMode === true);
  const summary = pubDash.summary ?? {};
  const sales =
    (summary.cashCents ?? 0) +
    (summary.verifiedDigitalCents ?? 0) +
    (summary.demoDigitalCents ?? 0) +
    (summary.pendingCents ?? 0);
  check("Ventas de hoy = $190.00", sales === 19000, `$${(sales / 100).toFixed(2)}`);
  check("Cobrado = $70.00", summary.cashCents === 7000, `$${((summary.cashCents ?? 0) / 100).toFixed(2)}`);
  check("Por cobrar = $120.00", summary.pendingCents === 12000, `$${((summary.pendingCents ?? 0) / 100).toFixed(2)}`);
  check("Fiado = $50.00", summary.creditCents === 5000, `$${((summary.creditCents ?? 0) / 100).toFixed(2)}`);
}

const goals = await get(`${appUrl}/api/goals`);
if (goals.error) {
  check("Meta legible", false, goals.error);
} else {
  const goal = goals.goals?.[0];
  check("Meta = $300 de $1,800", goal?.savedCents === 30000 && goal?.targetCents === 180000,
    goal ? `$${(goal.savedCents / 100).toFixed(2)} / $${(goal.targetCents / 100).toFixed(2)}` : "sin meta");
}

const cash = await get(`${appUrl}/api/cash`);
if (cash.error) {
  check("Corte legible", false, cash.error);
} else {
  check("Corte: base $500, esperado $570", cash.openingCents === 50000 && cash.expectedCents === 57000,
    `base $${(cash.openingCents / 100).toFixed(2)} · esperado $${(cash.expectedCents / 100).toFixed(2)}`);
}

const files = [
  ["Video MP4", path.join(DEMO, "mercado-cero-demo.mp4")],
  ["QR PNG", path.join(DEMO, "qr-demo.png")],
  ["QR PDF", path.join(DEMO, "qr-demo.pdf")],
  ["QR HTML", path.join(DEMO, "qr-demo.html")],
  ["Auditoría móvil", path.join(DEMO, "mobile-audit.json")],
  ["Auditoría checkout", path.join(DEMO, "checkout-audit.json")],
  ["Humo del túnel", path.join(DEMO, "tunnel-smoke.json")],
];
for (const [label, file] of files) {
  const exists = fs.existsSync(file);
  check(label, exists, exists ? `${(fs.statSync(file).size / 1024).toFixed(0)} KB` : "falta");
}

const qrHtml = path.join(DEMO, "qr-demo.html");
if (fs.existsSync(qrHtml)) {
  const html = fs.readFileSync(qrHtml, "utf8");
  check("El QR apunta al túnel actual", html.includes(appUrl), appUrl);
}

check("APP_URL es HTTPS", appUrl.startsWith("https://"), appUrl);

const failed = checks.filter((item) => !item.ok);
console.log("");
console.log(failed.length === 0 ? `Preflight OK: ${checks.length}/${checks.length}.` : `${failed.length} falla(s) de ${checks.length}.`);
process.exitCode = failed.length === 0 ? 0 : 1;
