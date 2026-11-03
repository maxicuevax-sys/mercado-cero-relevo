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
import http from "node:http";
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
const PAYMENT_EVENT_CAP = 20;
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
        PAYMENT_EVENT_REJECTED_CAP: String(PAYMENT_EVENT_CAP),
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

/**
 * Sube un cuerpo sobredimensionado en trozos lentos y registra cuándo terminó
 * el cliente vs cuándo llegó la respuesta. Next bufferiza hasta
 * `proxyClientMaxBodySize` (64 KB) y luego el Proxy rechaza por
 * `Content-Length`; no espera a que el cliente termine de subir. Este test
 * documenta ese comportamiento real (no es una defensa "antes de leer").
 */
function oversizedStreamRequest(pathname, totalBytes = 160 * 1024, chunkBytes = 10 * 1024) {
  return new Promise((resolve, reject) => {
    let uploadedAt = null;
    let respondedAt = null;
    let status = null;
    let text = "";
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      resolve({ status, text, uploadedAt, respondedAt });
    };

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: PORT,
        path: pathname,
        method: "POST",
        headers: {
          ...sameOrigin,
          "content-type": "application/json",
          "content-length": String(totalBytes),
        },
      },
      (response) => {
        respondedAt = Date.now();
        status = response.statusCode ?? 0;
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          text += chunk;
        });
        response.on("end", finish);
        response.on("error", finish);
      },
    );

    req.on("error", (error) => {
      if (status !== null) finish();
      else reject(error);
    });
    req.setTimeout(15_000, () => req.destroy(new Error("timeout subiendo el cuerpo")));

    const chunk = Buffer.alloc(chunkBytes, 0x61);
    let sent = 0;
    const writeNext = () => {
      if (sent >= totalBytes) {
        uploadedAt = Date.now();
        req.end();
        return;
      }
      const size = Math.min(chunkBytes, totalBytes - sent);
      req.write(chunk.subarray(0, size), () => {
        sent += size;
        setTimeout(writeNext, 25);
      });
    };
    writeNext();
  });
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
let latestBackup = "";

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

  // P0-1: un pago firmado de pey marcado demo no se puede borrar ni reportar
  // como preservado si el reset termina en 200. Debe bloquear con 409.
  const signedAt = new Date().toISOString();
  const signedOrderId = "ord_security_signed_demo";
  const signedPaymentId = "pay_security_signed_demo";
  {
    const db = new DatabaseSync(dbPath);
    try {
      db.prepare(
        `INSERT INTO orders
         (id, merchant_id, status, total_cents, paid_cents, payment_method, demo, created_at, updated_at)
         VALUES (?, 'lupita', 'paid', 1000, 1000, 'codi', 1, ?, ?)`,
      ).run(signedOrderId, signedAt, signedAt);
      db.prepare(
        `INSERT INTO payments
         (id, order_id, provider, method, amount_cents, status, transaction_id, demo, created_at)
         VALUES (?, ?, 'pey', 'codi', 1000, 'paid', 'txn_security_signed_demo', 1, ?)`,
      ).run(signedPaymentId, signedOrderId, signedAt);
    } finally {
      db.close();
    }
  }

  result = await request("/api/demo/reset", { method: "POST" });
  check(
    "reset con pago pey firmado en demo → 409",
    result.response.status === 409 && result.body?.code === "real_data_present",
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );
  check(
    "reset bloqueado conserva pedido y pago firmado demo",
    result.response.status === 409 &&
      readSecurityDb("SELECT id FROM orders WHERE id = ?", [signedOrderId]).length === 1 &&
      readSecurityDb("SELECT id FROM payments WHERE id = ?", [signedPaymentId]).length === 1,
    JSON.stringify(result.body),
  );
  check(
    "409 reporta el pago firmado real",
    result.response.status === 409 && Number(result.body?.realPayments) === 1,
    JSON.stringify(result.body),
  );

  // P1: un webhook firmado en DEMO_MODE=true es simulación. Ninguna superficie
  // debe presentarlo como verificado ni entregable.
  result = await request(
    `/api/verify?transactionId=txn_security_signed_demo&orderId=${signedOrderId}`,
  );
  check(
    "verify de pago pey demo → verified false y source demo",
    result.response.status === 200 &&
      result.body?.verified === false &&
      result.body?.source === "demo" &&
      result.body?.reason === "demo_payment",
    JSON.stringify(result.body),
  );

  result = await request(`/api/checkout/${signedOrderId}`);
  check(
    "checkout de pago pey demo → payment.demo y 0 verificado",
    result.response.status === 200 &&
      result.body?.payment?.demo === true &&
      Number(result.body?.order?.demoPaidCents) === 1000 &&
      Number(result.body?.order?.verifiedPaidCents) === 0,
    JSON.stringify({
      payment: result.body?.payment,
      demoPaidCents: result.body?.order?.demoPaidCents,
      verifiedPaidCents: result.body?.order?.verifiedPaidCents,
    }),
  );

  result = await request(`/pay/${signedOrderId}`);
  check(
    "checkout HTML de pago pey demo no dice verificado",
    result.response.status === 200 &&
      result.text.includes("Pago demo") &&
      !result.text.includes("Pago verificado por pey") &&
      !result.text.toLowerCase().includes("puede entregar"),
    `status ${result.response.status}`,
  );

  result = await request(`/pay/${signedOrderId}/success`);
  check(
    "success HTML de pago pey demo no dice verificado",
    result.response.status === 200 &&
      result.text.includes("Pago demo") &&
      !result.text.includes("Pago verificado por pey") &&
      !result.text.toLowerCase().includes("puede entregar"),
    `status ${result.response.status}`,
  );

  result = await request("/api/dashboard");
  const signedDashboardOrder = (result.body?.orders ?? []).find(
    (order) => order.id === signedOrderId,
  );
  check(
    "Caja recibe lastPaymentDemo y no lo suma a verificado",
    result.response.status === 200 &&
      signedDashboardOrder?.lastPaymentDemo === true &&
      signedDashboardOrder?.lastPaymentProvider === "pey" &&
      Number(result.body?.summary?.verifiedDigitalCents) >= 0 &&
      Number(result.body?.summary?.demoDigitalCents) >= 1000,
    JSON.stringify({
      order: signedDashboardOrder
        ? {
            lastPaymentProvider: signedDashboardOrder.lastPaymentProvider,
            lastPaymentDemo: signedDashboardOrder.lastPaymentDemo,
          }
        : null,
      verified: result.body?.summary?.verifiedDigitalCents,
      demoDigital: result.body?.summary?.demoDigitalCents,
    }),
  );

  result = await request("/api/analytics?period=today");
  check(
    "analytics separa el pago pey demo de verifiedDigitalCents",
    result.response.status === 200 &&
      Number(result.body?.demoDigitalCents) >= 1000 &&
      Number(result.body?.verifiedDigitalCents) >= 0,
    JSON.stringify({
      verifiedDigitalCents: result.body?.verifiedDigitalCents,
      demoDigitalCents: result.body?.demoDigitalCents,
    }),
  );

  {
    const db = new DatabaseSync(dbPath);
    try {
      db.prepare("DELETE FROM payments WHERE id = ?").run(signedPaymentId);
      db.prepare("DELETE FROM orders WHERE id = ?").run(signedOrderId);
    } finally {
      db.close();
    }
  }

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
  const homeCache = home.headers.get("cache-control") ?? "";
  check(
    "headers: / privado y no-store (sin caché pública)",
    /(?:^|,)\s*private\b/i.test(homeCache) &&
      /\bno-store\b/i.test(homeCache) &&
      !/\bs-maxage\b/i.test(homeCache) &&
      !/(?:^|,)\s*public\b/i.test(homeCache),
    homeCache || "ausente",
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
  latestBackup = firstBackup;
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
  const createdOrderId = result.body?.order?.id ?? "";
  const jsonHeaders = { ...sameOrigin, "content-type": "application/json" };

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

  // 3b. Un X-Forwarded-Host del cliente no puede ampliar el allowlist CSRF.
  result = await request("/api/orders", {
    method: "POST",
    headers: {
      origin: "https://evil.example",
      "x-forwarded-host": "evil.example",
      "x-forwarded-proto": "https",
      "content-type": "application/json",
    },
    body: orderPayload,
  });
  check(
    "CSRF no confía en X-Forwarded-Host → 403",
    result.response.status === 403 && result.body?.code === "cross_origin",
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );

  // 3c. Cuerpos JSON `null` deben ser 400 de validación, no 500.
  result = await request(`/api/orders/${encodeURIComponent(createdOrderId)}`, {
    method: "PATCH",
    headers: jsonHeaders,
    body: "null",
  });
  check(
    "PATCH orders/[id] body null → 400",
    result.response.status === 400,
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );

  result = await request("/api/voice/parse", {
    method: "POST",
    headers: jsonHeaders,
    body: "null",
  });
  check(
    "voice/parse body null → 400",
    result.response.status === 400,
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );

  result = await request("/api/demo/pay", {
    method: "POST",
    headers: jsonHeaders,
    body: "null",
  });
  check(
    "demo/pay body null → 400",
    result.response.status === 400,
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );

  result = await request(`/api/orders/${encodeURIComponent(createdOrderId)}/pay`, {
    method: "POST",
    headers: jsonHeaders,
    body: "null",
  });
  check(
    "orders/[id]/pay body null → 400",
    result.response.status === 400,
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );

  // 3d. Errores de dominio seguros: mensaje estable, nunca SQLite.
  result = await request("/api/orders/ord_missing/pay", {
    method: "POST",
    headers: jsonHeaders,
    body: "{}",
  });
  check(
    "order pay inexistente → 404 con mensaje de dominio",
    result.response.status === 404 &&
      result.body?.error === "Pedido no encontrado." &&
      !/sqlite|constraint|database/i.test(result.text),
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );

  result = await request("/api/demo/pay", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ orderId: "ord_missing", method: "card" }),
  });
  check(
    "demo/pay inexistente → 404 con mensaje de dominio",
    result.response.status === 404 &&
      result.body?.error === "Pedido no encontrado." &&
      !/sqlite|constraint|database/i.test(result.text),
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );

  result = await request("/api/credits/cred_missing/pay", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ amountCents: 100 }),
  });
  check(
    "credit pay inexistente → 404 con mensaje de dominio",
    result.response.status === 404 &&
      result.body?.error === "Fiado no encontrado." &&
      !/sqlite|constraint|database/i.test(result.text),
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );

  result = await request("/api/orders/ord_missing", {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify({ action: "fulfill" }),
  });
  check(
    "fulfill inexistente → 404 con mensaje de dominio",
    result.response.status === 404 &&
      result.body?.error === "Pedido no encontrado." &&
      !/sqlite|constraint|database/i.test(result.text),
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );

  result = await request("/api/orders", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      items: [{ description: "Fiado de prueba", quantity: 1, unitPriceCents: 5000 }],
      creditCents: 5000,
      customerName: "Cliente Seguridad",
    }),
  });
  const creditOrderId = result.body?.order?.id ?? "";
  result = await request(`/api/orders/${encodeURIComponent(creditOrderId)}`, {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify({ action: "fulfill" }),
  });
  check(
    "fulfill con fiado abierto → 409 con mensaje de dominio",
    result.response.status === 409 &&
      result.body?.code === "credit_open" &&
      /fiado sigue abierto/i.test(result.body?.error ?? "") &&
      !/sqlite|constraint|database/i.test(result.text),
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );

  const duplicateRequestId = `sec_dup_${Date.now().toString(36)}`;
  const duplicateBody = {
    items: [{ description: "Quesadilla", quantity: 1, unitPriceCents: 3500 }],
    requestId: duplicateRequestId,
  };
  result = await request("/api/orders", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(duplicateBody),
  });
  const firstDuplicateStatus = result.response.status;
  result = await request("/api/orders", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      ...duplicateBody,
      items: [{ description: "Otra cosa", quantity: 1, unitPriceCents: 3500 }],
    }),
  });
  check(
    "create con requestId reutilizado → 409 con mensaje de dominio",
    firstDuplicateStatus === 201 &&
      result.response.status === 409 &&
      result.body?.code === "request_id_conflict" &&
      !/sqlite|constraint|database/i.test(result.text),
    `primero ${firstDuplicateStatus}, luego ${result.response.status} ${JSON.stringify(result.body)}`,
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
    "transcribe archivo >12 MB → 413 de la ruta (sin truncar a 64 KB)",
    result.response.status === 413 &&
      result.body?.error === "El audio es demasiado grande.",
    `status ${result.response.status} ${JSON.stringify(result.body)}`,
  );

  // 4b. Documenta el comportamiento real: Next bufferiza hasta el tope del
  // Proxy y el 413 se emite en cuanto lo alcanza, sin esperar los 160 KB.
  const slowOversized = await oversizedStreamRequest("/api/orders");
  check(
    "413 al llenar el buffer del Proxy, no al terminar la subida",
    slowOversized.status === 413 &&
      (slowOversized.uploadedAt === null ||
        slowOversized.respondedAt < slowOversized.uploadedAt),
    `status ${slowOversized.status}, subida ${slowOversized.uploadedAt}, respuesta ${slowOversized.respondedAt}`,
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

  // 5b. El token de reset se compara después del rate limit: 30 intentos
  // fallidos no pueden probar tokens ilimitados.
  let firstTokenAttempt = null;
  let lastTokenAttempt = null;
  for (let index = 0; index < 30; index += 1) {
    lastTokenAttempt = await request("/api/demo/reset", {
      method: "POST",
      headers: {
        ...sameOrigin,
        "x-demo-token": "token_incorrecto",
        "cf-connecting-ip": "203.0.113.210",
      },
    });
    if (index === 0) firstTokenAttempt = lastTokenAttempt;
  }
  check(
    "reset token inválido: primer intento → 401",
    firstTokenAttempt?.response.status === 401,
    `status ${firstTokenAttempt?.response.status}`,
  );
  check(
    "reset token: 30 intentos → 429",
    lastTokenAttempt?.response.status === 429 &&
      lastTokenAttempt.body?.code === "rate_limited",
    `status ${lastTokenAttempt?.response.status} ${JSON.stringify(lastTokenAttempt?.body)}`,
  );

  // 5c. Webhooks inválidos: payload truncado + hash y cap de rechazos no
  // firmados, sin borrar auditoría válida.
  const validEventDb = new DatabaseSync(dbPath);
  try {
    validEventDb.exec("PRAGMA busy_timeout = 5000;");
    validEventDb
      .prepare(
        `INSERT INTO payment_events
         (id, provider, event_type, idempotency_key, payload, payload_hash, signature_valid, processed_at, result)
         VALUES ('evt_sec_valid', 'pey', 'audit.valid', 'valid:sec', ?, ?, 1, ?, 'processed')`,
      )
      .run("valid-audit-payload", "valid-audit-hash", new Date().toISOString());
  } finally {
    validEventDb.close();
  }

  let floodLast = null;
  for (let index = 0; index < 30; index += 1) {
    floodLast = await request("/api/webhooks/pey", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.88",
      },
      body: JSON.stringify({ index, junk: "a".repeat(8 * 1024) }),
    });
    if (floodLast.response.status !== 401) break;
  }
  const rejectedRows = readSecurityDb(
    "SELECT payload, payload_hash FROM payment_events WHERE signature_valid = 0 AND result = 'rejected'",
  );
  const validRows = readSecurityDb(
    "SELECT payload FROM payment_events WHERE id = 'evt_sec_valid'",
  );
  check(
    "webhook inválido: payload acotado (≤4 KB) y hash sha256",
    floodLast?.response.status === 401 &&
      rejectedRows.length > 0 &&
      rejectedRows.every(
        (row) =>
          Buffer.byteLength(String(row.payload ?? ""), "utf8") <= 4 * 1024 &&
          /^[a-f0-9]{64}$/.test(String(row.payload_hash ?? "")),
      ),
    `filas ${rejectedRows.length}`,
  );
  check(
    "payment_events: rechazos no firmados acotados",
    rejectedRows.length <= PAYMENT_EVENT_CAP,
    `${rejectedRows.length} > ${PAYMENT_EVENT_CAP}`,
  );
  check(
    "payment_events: la auditoría válida se conserva",
    validRows.length === 1 && validRows[0]?.payload === "valid-audit-payload",
    `filas ${validRows.length}`,
  );

  // 5d. Backups de reset con retención: últimos 5, no crecimiento infinito.
  let retentionReset = null;
  for (let index = 0; index < 7; index += 1) {
    retentionReset = await request("/api/demo/reset", {
      method: "POST",
      headers: resetHeaders({
        "cf-connecting-ip": `198.51.100.${index + 1}`,
      }),
    });
    if (retentionReset.response.status !== 200) break;
  }
  const retainedBackup =
    typeof retentionReset?.body?.backup === "string" ? retentionReset.body.backup : "";
  latestBackup = retainedBackup;
  check(
    "reset retiene como máximo 5 backups",
    retentionReset?.response.status === 200 && countBackups() === 5,
    `${countBackups()} backups`,
  );
  check(
    "el backup más reciente sobrevive a la poda",
    Boolean(retainedBackup) && fs.existsSync(path.join(backupDir, retainedBackup)),
    retainedBackup || "sin nombre",
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
    result.response.status === 409 && result.body?.code === "real_data_present",
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
  const forceBackup =
    typeof result.body?.backup === "string" ? result.body.backup : "";
  check(
    "force crea otro backup (sin crecer más allá de 5)",
    Boolean(forceBackup) &&
      forceBackup !== latestBackup &&
      fs.existsSync(path.join(backupDir, forceBackup)) &&
      countBackups() <= 5,
    `${latestBackup} → ${forceBackup}, ${countBackups()} backups`,
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
