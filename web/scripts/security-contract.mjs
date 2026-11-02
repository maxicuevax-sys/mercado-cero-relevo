#!/usr/bin/env node
/**
 * Contrato de seguridad runtime.
 *
 * Arranca un servidor de producción aislado en 127.0.0.1:3121 con una base
 * SQLite temporal, prueba CSRF, token de reset, límites de cuerpo, rate limit,
 * headers, backup y protección de pagos reales. Nunca toca :3000 ni la base
 * de la demo compartida.
 *
 * Uso:
 *   npm run build
 *   node scripts/security-contract.mjs
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const PORT = Number(process.env.SECURITY_PORT ?? 3191);
const BASE = `http://127.0.0.1:${PORT}`;
const ORIGIN = BASE;
const TOKEN = `sec_test_${Date.now().toString(36)}`;
const NEXT_BIN = path.join(WEB, "node_modules", "next", "dist", "bin", "next");

if (!fs.existsSync(path.join(WEB, ".next", "BUILD_ID"))) {
  console.error("FALTA build. Corre `npm run build` antes del contrato de seguridad.");
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mercado-cero-sec-"));
const dbPath = path.join(tmp, "security.db");
const backupDir = path.join(tmp, "backups");

let checks = 0;
let failures = 0;

function check(name, ok, detail = "") {
  checks += 1;
  if (ok) {
    console.log(`PASS  ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startServer(extraEnv = {}) {
  const child = spawn(
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
        DEMO_RESET_TOKEN: TOKEN,
        FORCE_DEMO_RESET: "0",
        ...extraEnv,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  return {
    child,
    output: () => output,
  };
}

async function stopServer(server) {
  if (!server || server.child.exitCode !== null) return;
  server.child.kill("SIGTERM");
  await Promise.race([once(server.child, "exit"), delay(8_000)]);
  if (server.child.exitCode === null) {
    server.child.kill("SIGKILL");
    await Promise.race([once(server.child, "exit"), delay(3_000)]);
  }
}

async function waitForServer(server) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.child.exitCode !== null) {
      throw new Error(`El servidor aislado terminó antes de arrancar.\n${server.output()}`);
    }
    try {
      const response = await fetch(`${BASE}/api/dashboard`, {
        signal: AbortSignal.timeout(3_000),
      });
      if (response.ok) return;
    } catch {
      // Aún no escucha.
    }
    await delay(350);
  }
  throw new Error(`El servidor no respondió en 60s.\n${server.output()}`);
}

async function request(pathname, options = {}) {
  const response = await fetch(`${BASE}${pathname}`, {
    redirect: "manual",
    ...options,
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body, text };
}

const sameOrigin = { origin: ORIGIN, "sec-fetch-site": "same-origin" };
const crossOrigin = { origin: "https://evil.example", "sec-fetch-site": "cross-site" };

function resetHeaders(extra = {}) {
  return {
    ...sameOrigin,
    "x-demo-token": TOKEN,
    ...extra,
  };
}

function countBackups() {
  if (!fs.existsSync(backupDir)) return 0;
  return fs.readdirSync(backupDir).filter((name) => name.endsWith(".db")).length;
}

function readSecurityDb(query, params = []) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return db.prepare(query).all(...params);
  } finally {
    db.close();
  }
}

let server = null;

try {
  // Fase 0: sin token configurado, el botón de reset y el harness deben
  // seguir funcionando con mismo origen (o sin Origin, como un cliente CLI).
  server = startServer({ DEMO_RESET_TOKEN: "" });
  await waitForServer(server);

  let result = await request("/api/demo/reset", {
    method: "POST",
    headers: sameOrigin,
  });
  check(
    "reset sin token configurado → 200 (UI/harness)",
    result.response.status === 200 && result.body?.ok === true,
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );

  result = await request("/api/demo/reset", { method: "POST" });
  check(
    "reset sin Origin → 200 (cliente CLI)",
    result.response.status === 200 && result.body?.ok === true,
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );

  await stopServer(server);
  server = null;

  // Fase 1: token configurado + pruebas completas.
  server = startServer();
  await waitForServer(server);

  // 1. Headers de seguridad en HTML y API.
  const home = await fetch(`${BASE}/`, { redirect: "manual" });
  check(
    "headers: X-Content-Type-Options=nosniff",
    home.headers.get("x-content-type-options") === "nosniff",
    home.headers.get("x-content-type-options") ?? "ausente",
  );
  check(
    "headers: Referrer-Policy",
    (home.headers.get("referrer-policy") ?? "").includes("strict-origin-when-cross-origin"),
    home.headers.get("referrer-policy") ?? "ausente",
  );
  check(
    "headers: X-Frame-Options=DENY",
    home.headers.get("x-frame-options") === "DENY",
    home.headers.get("x-frame-options") ?? "ausente",
  );
  const csp = home.headers.get("content-security-policy") ?? "";
  check("headers: CSP frame-ancestors 'none'", csp.includes("frame-ancestors 'none'"), csp);
  const permissions = home.headers.get("permissions-policy") ?? "";
  check(
    "headers: Permissions-Policy micrófono self",
    permissions.includes("microphone=(self)"),
    permissions,
  );

  // 2. Reset: cross-origin 403, same-origin sin token 401, con token 200.
  result = await request("/api/demo/reset", {
    method: "POST",
    headers: crossOrigin,
  });
  check(
    "reset cross-origin → 403",
    result.response.status === 403 && result.body?.code === "cross_origin",
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );

  result = await request("/api/demo/reset", {
    method: "POST",
    headers: sameOrigin,
  });
  check(
    "reset same-origin sin token → 401",
    result.response.status === 401 && result.body?.code === "demo_token_invalid",
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );

  const backupsBefore = countBackups();
  result = await request("/api/demo/reset", {
    method: "POST",
    headers: resetHeaders(),
  });
  check(
    "reset same-origin con token → 200",
    result.response.status === 200 && result.body?.ok === true,
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );
  const firstBackup = typeof result.body?.backup === "string" ? result.body.backup : "";
  check(
    "reset crea backup timestamped",
    Boolean(firstBackup) && fs.existsSync(path.join(backupDir, firstBackup)),
    firstBackup || "sin nombre",
  );
  check(
    "reset incrementa backups",
    countBackups() > backupsBefore,
    `${backupsBefore} → ${countBackups()}`,
  );

  // 3. Mutadores: CSRF y webhook exento.
  const orderPayload = JSON.stringify({
    items: [{ description: "Quesadilla", quantity: 1, unitPriceCents: 3500 }],
    cashCents: 3500,
  });
  result = await request("/api/orders", {
    method: "POST",
    headers: { ...crossOrigin, "content-type": "application/json" },
    body: orderPayload,
  });
  check(
    "mutador cross-origin → 403",
    result.response.status === 403 && result.body?.code === "cross_origin",
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );

  result = await request("/api/orders", {
    method: "POST",
    headers: { ...sameOrigin, "content-type": "application/json" },
    body: orderPayload,
  });
  check(
    "mutador same-origin → 201",
    result.response.status === 201 && Boolean(result.body?.order?.id),
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );

  result = await request("/api/webhooks/pey", {
    method: "POST",
    headers: { ...crossOrigin, "content-type": "application/json" },
    body: "{}",
  });
  check(
    "webhook exento de CSRF, exige firma → 401",
    result.response.status === 401,
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );

  // 4. Límites de cuerpo antes/durante la lectura.
  result = await request("/api/voice/parse", {
    method: "POST",
    headers: { ...sameOrigin, "content-type": "application/json" },
    body: JSON.stringify({ transcript: "a".repeat(9 * 1024) }),
  });
  check(
    "voice/parse 9 KB → 413",
    result.response.status === 413 && result.body?.code === "body_too_large",
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );

  result = await request("/api/orders", {
    method: "POST",
    headers: { ...sameOrigin, "content-type": "application/json" },
    body: JSON.stringify({
      items: [{ description: "x".repeat(70 * 1024), quantity: 1, unitPriceCents: 1 }],
    }),
  });
  check(
    "orders 70 KB → 413",
    result.response.status === 413 && result.body?.code === "body_too_large",
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );

  result = await request("/api/webhooks/pey", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ x: "a".repeat(70 * 1024) }),
  });
  check(
    "webhook 70 KB → 413",
    result.response.status === 413 && result.body?.code === "body_too_large",
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );

  const audio = new FormData();
  audio.set(
    "audio",
    new Blob([new Uint8Array(12 * 1024 * 1024 + 1)], { type: "audio/webm" }),
    "voice.webm",
  );
  result = await request("/api/voice/transcribe", {
    method: "POST",
    headers: sameOrigin,
    body: audio,
  });
  check(
    "transcribe archivo >12 MB → 413",
    result.response.status === 413,
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );

  // 5. Rate limit por IP + ruta. CF-Connecting-IP evita compartir bucket.
  let last = null;
  for (let index = 0; index <= 60; index += 1) {
    last = await request("/api/verify?transactionId=rate_limit_probe", {
      headers: { "cf-connecting-ip": "203.0.113.77" },
    });
  }
  check(
    "verify: petición 61 → 429",
    last.response.status === 429 && last.body?.code === "rate_limited",
    `status ${last.response.status} ${JSON.stringify(last.body)}`,
  );
  check(
    "rate limit incluye Retry-After",
    Number(last.response.headers.get("retry-after") ?? "0") > 0,
    last.response.headers.get("retry-after") ?? "ausente",
  );

  // 6. Un pago pey real bloquea el reset sin FORCE.
  const createdAt = new Date().toISOString();
  const realOrderId = "ord_security_real";
  const realPaymentId = "pay_security_real";
  const realTransactionId = "txn_security_real";
  const db = new DatabaseSync(dbPath);
  try {
    db.exec("PRAGMA busy_timeout = 5000;");
    db.prepare(
      `INSERT INTO orders
       (id, merchant_id, status, total_cents, paid_cents, payment_method, created_at, updated_at)
       VALUES (?, 'lupita', 'paid', 9900, 9900, 'card', ?, ?)`,
    ).run(realOrderId, createdAt, createdAt);
    db.prepare(
      `INSERT INTO payments
       (id, order_id, provider, method, amount_cents, status, transaction_id, created_at)
       VALUES (?, ?, 'pey', 'card', 9900, 'paid', ?, ?)`,
    ).run(realPaymentId, realOrderId, realTransactionId, createdAt);
    db.prepare(
      `INSERT INTO audit_log (id, action, entity, entity_id, detail, created_at)
       VALUES ('aud_security_real', 'payment.recorded', 'order', ?, ?, ?)`,
    ).run(realOrderId, JSON.stringify({ transactionId: realTransactionId }), createdAt);
  } finally {
    db.close();
  }

  result = await request("/api/demo/reset", {
    method: "POST",
    headers: resetHeaders(),
  });
  check(
    "reset con pago pey real → 409",
    result.response.status === 409 && result.body?.code === "real_payments_present",
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );
  check(
    "reset bloqueado conserva el pago real",
    readSecurityDb("SELECT id FROM payments WHERE id = ?", [realPaymentId]).length === 1,
    "pago desapareció",
  );
  check(
    "reset bloqueado conserva auditoría real",
    readSecurityDb("SELECT id FROM audit_log WHERE id = 'aud_security_real'").length === 1,
    "auditoría desapareció",
  );

  await stopServer(server);
  server = null;

  // 7. FORCE_DEMO_RESET=1 permite limpiar, pero conserva pago y auditoría.
  server = startServer({ FORCE_DEMO_RESET: "1" });
  await waitForServer(server);
  const backupsBeforeForce = countBackups();

  result = await request("/api/demo/reset", {
    method: "POST",
    headers: resetHeaders(),
  });
  check(
    "FORCE_DEMO_RESET=1 → 200",
    result.response.status === 200 && result.body?.ok === true,
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );
  check(
    "force conserva pago real",
    readSecurityDb("SELECT id FROM payments WHERE id = ?", [realPaymentId]).length === 1,
    "pago desapareció",
  );
  check(
    "force conserva auditoría real",
    readSecurityDb("SELECT id FROM audit_log WHERE id = 'aud_security_real'").length === 1,
    "auditoría desapareció",
  );
  check(
    "force crea otro backup",
    countBackups() > backupsBeforeForce,
    `${backupsBeforeForce} → ${countBackups()}`,
  );

  // 8. No se filtra el mensaje interno de validación de SQLite/dominio.
  result = await request("/api/orders", {
    method: "POST",
    headers: { ...sameOrigin, "content-type": "application/json" },
    body: '{"items":[{"description":"x","quantity":1e999,"unitPriceCents":100}]}',
  });
  const leaked = /sqlite|cantidad inválida|constraint|database/i.test(result.text);
  check(
    "error interno no se filtra al cliente",
    !leaked,
    result.text.slice(0, 160),
  );

  console.log("");
  if (failures === 0) {
    console.log(`SEGURIDAD OK: ${checks}/${checks} checks.`);
  } else {
    console.error(`SEGURIDAD FALLÓ: ${checks - failures}/${checks} en verde.`);
  }
} catch (error) {
  failures += 1;
  console.error("");
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  if (server) {
    const output = server.output().trim();
    if (output) console.error(output.split(/\r?\n/).slice(-30).join("\n"));
  }
} finally {
  if (failures > 0 && server) {
    const output = server.output().trim();
    if (output) {
      console.error("---- log del servidor aislado ----");
      console.error(output.split(/\r?\n/).slice(-40).join("\n"));
    }
  }
  await stopServer(server);
  if (failures === 0) {
    fs.rmSync(tmp, { recursive: true, force: true });
  } else {
    console.error(`Datos de depuración en ${tmp}`);
  }
}

process.exit(failures === 0 ? 0 : 1);
