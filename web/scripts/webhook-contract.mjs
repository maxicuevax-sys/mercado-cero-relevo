#!/usr/bin/env node
/**
 * Contrato del webhook de pey.
 *
 * Firma payloads como Standard Webhooks y prueba que:
 *   1. un evento válido marca pagado exactamente una vez;
 *   2. un replay no duplica el pago;
 *   3. una firma falsa se rechaza con 401;
 *   4. un monto distinto se rechaza sin tocar la orden;
 *   5. una orden inexistente no crea pagos;
 *   6. un timestamp viejo se rechaza con 401;
 *   7. un evento pending posterior no revierte un pago;
 *   8. un JSON inválido firmado se audita como rechazo;
 *   9. un QR CoDi válido también marca pagado;
 *  10. un 409/404 corregido con el mismo webhook-id sí se reprocesa y cobra.
 *
 * Uso:
 *   node scripts/webhook-contract.mjs
 *
 * Requiere el servidor corriendo y PEY_WEBHOOK_SECRET en .env.local.
 * No imprime el secreto.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const ROOT = process.cwd();
const DB_PATH = process.env.DATABASE_PATH ?? path.join(ROOT, "data", "mercado-cero.db");

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

const env = loadEnv(path.join(ROOT, ".env.local"));
const BASE = (
  process.env.BASE_URL ??
  process.env.APP_URL ??
  env.APP_URL ??
  "http://localhost:3000"
).replace(/\/+$/, "");
const SECRET = process.env.PEY_WEBHOOK_SECRET ?? env.PEY_WEBHOOK_SECRET ?? "";
const WRONG_SECRET = `whsec_${Buffer.from("wrong-secret-for-contract-tests").toString("base64")}`;

if (!SECRET) {
  console.error("Falta PEY_WEBHOOK_SECRET en .env.local. El servidor debe usar el mismo secreto.");
  process.exit(1);
}

const results = [];

function check(name, condition, detail = "") {
  const pass = Boolean(condition);
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function request(pathname, init = {}) {
  const response = await fetch(`${BASE}${pathname}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

function sign(body, id, timestamp, secret) {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signature = crypto
    .createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return {
    "content-type": "application/json",
    "webhook-id": id,
    "webhook-timestamp": String(timestamp),
    "webhook-signature": `v1,${signature}`,
  };
}

async function sendEvent(event, options = {}) {
  const body = JSON.stringify(event);
  return sendRaw(body, options);
}

async function sendRaw(body, options = {}) {
  const id = options.id ?? `msg_${crypto.randomUUID()}`;
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
  const secret = options.secret ?? SECRET;
  const response = await fetch(`${BASE}/api/webhooks/pey`, {
    method: "POST",
    headers: sign(body, id, timestamp, secret),
    body,
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { id, status: response.status, body: parsed };
}

async function createOrder(amountCents) {
  const created = await request("/api/orders", {
    method: "POST",
    body: JSON.stringify({
      items: [{ description: "Prueba webhook", quantity: 1, unitPriceCents: amountCents }],
    }),
  });
  if (created.status !== 201) {
    throw new Error(`No se pudo crear la orden: ${created.status} ${JSON.stringify(created.body)}`);
  }
  return created.body.order;
}

async function createOrderWithLink(amountCents) {
  const order = await createOrder(amountCents);
  const linked = await request(`/api/orders/${order.id}/pay`, {
    method: "POST",
    body: JSON.stringify({ mode: "link" }),
  });
  if (linked.status !== 200) {
    throw new Error(`No se pudo crear el link: ${linked.status} ${JSON.stringify(linked.body)}`);
  }
  return linked.body.order;
}

async function createOrderWithQr(amountCents) {
  const order = await createOrder(amountCents);
  const qr = await request(`/api/orders/${order.id}/pay`, {
    method: "POST",
    body: JSON.stringify({ mode: "qr" }),
  });
  if (qr.status !== 200) {
    throw new Error(`No se pudo crear el QR: ${qr.status} ${JSON.stringify(qr.body)}`);
  }
  return qr.body.order;
}

function linkEvent(order, overrides = {}) {
  return {
    type: "payment_link.status_updated",
    paymentLinkId: order.paymentLinkId,
    status: "paid",
    clientReferenceId: order.id,
    transactions: [
      {
        transactionId: `txn_${crypto.randomUUID()}`,
        paymentMethod: "CODI",
        amount: order.totalCents / 100,
      },
    ],
    ...overrides,
  };
}

async function getOrderDetail(orderId) {
  const response = await request(`/api/orders/${orderId}`);
  if (response.status !== 200) {
    throw new Error(`No se pudo leer la orden: ${response.status}`);
  }
  return response.body;
}

function dbRows(sql, ...params) {
  const database = new DatabaseSync(DB_PATH);
  try {
    return database.prepare(sql).all(...params);
  } finally {
    database.close();
  }
}

function auditRow(idempotencyKey) {
  return (
    dbRows(
      "SELECT result, error, signature_valid FROM payment_events WHERE idempotency_key = ?",
      idempotencyKey,
    )[0] ?? null
  );
}

async function waitForServer() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/api/dashboard`);
      if (response.ok) return;
    } catch {
      // Servidor aún no disponible.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No hay servidor en ${BASE}. Arranca npm run dev primero.`);
}

async function main() {
  console.log("Mercado Cero · contrato de webhook");
  console.log(`Base: ${BASE}`);
  console.log(`DB: ${DB_PATH}`);
  console.log(`Secreto: ${SECRET.length} caracteres (no se imprime)`);
  console.log("");

  await waitForServer();

  const reset = await request("/api/demo/reset", { method: "POST" });
  check("0. reset de demo", reset.status === 200, `status ${reset.status}`);

  // 1. Evento válido.
  const validOrder = await createOrderWithLink(1000);
  const validEvent = linkEvent(validOrder);
  // El checkout puede sumar propina/fee al amount; la venta se valida contra base.
  validEvent.transactions[0].amount = 10.5;
  validEvent.transactions[0].amountBreakdown = { base: 10.0, tip: 0.5, fee: 0 };
  const validResponse = await sendEvent(validEvent);
  check("1. link válido → 200", validResponse.status === 200, `status ${validResponse.status}`);
  check(
    "1. respuesta processed",
    validResponse.body?.result === "processed",
    JSON.stringify(validResponse.body),
  );
  const validDetail = await getOrderDetail(validOrder.id);
  check("1. orden pagada", validDetail.order.status === "paid", validDetail.order.status);
  check(
    "1. base exacta (con propina en el evento)",
    validDetail.order.paidCents === 1000,
    `paidCents=${validDetail.order.paidCents}`,
  );
  check(
    "1. un solo pago",
    validDetail.payments.filter((payment) => payment.status === "paid").length === 1,
    `pagos=${validDetail.payments.length}`,
  );
  const validAudit = auditRow(validResponse.id);
  check(
    "1. evento auditado como processed",
    validAudit?.result === "processed",
    JSON.stringify(validAudit),
  );

  // 2. Replay con el mismo webhook-id.
  const replayResponse = await sendEvent(validEvent, { id: validResponse.id });
  check(
    "2. replay → 200 duplicate",
    replayResponse.status === 200 && replayResponse.body?.duplicate === true,
    JSON.stringify(replayResponse.body),
  );
  const replayDetail = await getOrderDetail(validOrder.id);
  check(
    "2. replay no duplica el pago",
    replayDetail.payments.filter((payment) => payment.status === "paid").length === 1,
    `pagos=${replayDetail.payments.length}`,
  );
  check(
    "2. orden sigue pagada",
    replayDetail.order.status === "paid" && replayDetail.order.paidCents === 1000,
    `${replayDetail.order.status} / ${replayDetail.order.paidCents}`,
  );

  // 3. Firma falsa.
  const badSignatureOrder = await createOrderWithLink(1000);
  const badSignatureEvent = linkEvent(badSignatureOrder);
  const badSignatureResponse = await sendEvent(badSignatureEvent, { secret: WRONG_SECRET });
  check(
    "3. firma falsa → 401",
    badSignatureResponse.status === 401,
    `status ${badSignatureResponse.status}`,
  );
  const badSignatureDetail = await getOrderDetail(badSignatureOrder.id);
  check(
    "3. firma falsa no marca pagado",
    badSignatureDetail.order.status !== "paid" && badSignatureDetail.payments.length === 0,
    `${badSignatureDetail.order.status} / pagos=${badSignatureDetail.payments.length}`,
  );
  const badSignatureAudit = auditRow(`invalid:${badSignatureResponse.id}`);
  check(
    "3. intento auditado como rejected",
    badSignatureAudit?.result === "rejected" && badSignatureAudit?.signature_valid === 0,
    JSON.stringify(badSignatureAudit),
  );

  // 4. Monto distinto.
  const wrongAmountOrder = await createOrderWithLink(1000);
  const wrongAmountEvent = linkEvent(wrongAmountOrder);
  wrongAmountEvent.transactions[0].amount = 1.0;
  const wrongAmountResponse = await sendEvent(wrongAmountEvent);
  check(
    "4. monto distinto → 409",
    wrongAmountResponse.status === 409,
    `status ${wrongAmountResponse.status}`,
  );
  const wrongAmountDetail = await getOrderDetail(wrongAmountOrder.id);
  check(
    "4. monto distinto no marca pagado",
    wrongAmountDetail.order.status !== "paid" &&
      wrongAmountDetail.order.paidCents === 0 &&
      wrongAmountDetail.payments.length === 0,
    `${wrongAmountDetail.order.status} / ${wrongAmountDetail.order.paidCents}`,
  );
  const wrongAmountAudit = auditRow(wrongAmountResponse.id);
  check(
    "4. rechazo auditado con motivo",
    wrongAmountAudit?.result === "rejected" &&
      /monto|saldo/i.test(wrongAmountAudit?.error ?? ""),
    JSON.stringify(wrongAmountAudit),
  );

  // 4b. Reintento corregido con el mismo webhook-id.
  const correctedRetry = {
    ...wrongAmountEvent,
    transactions: [
      {
        ...wrongAmountEvent.transactions[0],
        amount: wrongAmountOrder.totalCents / 100,
      },
    ],
  };
  const correctedRetryResponse = await sendEvent(correctedRetry, {
    id: wrongAmountResponse.id,
  });
  check(
    "4b. reintento corregido con el mismo webhook-id → 200 processed",
    correctedRetryResponse.status === 200 &&
      correctedRetryResponse.body?.result === "processed",
    JSON.stringify(correctedRetryResponse.body),
  );
  const correctedRetryDetail = await getOrderDetail(wrongAmountOrder.id);
  check(
    "4b. reintento corregido marca pagado una sola vez",
    correctedRetryDetail.order.status === "paid" &&
      correctedRetryDetail.order.paidCents === wrongAmountOrder.totalCents &&
      correctedRetryDetail.payments.filter((payment) => payment.status === "paid").length === 1,
    `${correctedRetryDetail.order.status} / ${correctedRetryDetail.order.paidCents} / pagos=${correctedRetryDetail.payments.length}`,
  );
  const correctedRetryAudit = auditRow(wrongAmountResponse.id);
  check(
    "4b. el evento rechazado se reutiliza como processed",
    correctedRetryAudit?.result === "processed" && !correctedRetryAudit?.error,
    JSON.stringify(correctedRetryAudit),
  );

  // 5. Orden inexistente.
  const unknownEvent = {
    type: "payment_link.status_updated",
    paymentLinkId: "link_inexistente",
    status: "paid",
    clientReferenceId: "ord_inexistente",
    transactions: [
      { transactionId: `txn_${crypto.randomUUID()}`, paymentMethod: "CODI", amount: 10.0 },
    ],
  };
  const unknownResponse = await sendEvent(unknownEvent);
  check(
    "5. orden inexistente → 404",
    unknownResponse.status === 404,
    `status ${unknownResponse.status}`,
  );
  const unknownAudit = auditRow(unknownResponse.id);
  check(
    "5. orden inexistente auditada",
    unknownAudit?.result === "rejected",
    JSON.stringify(unknownAudit),
  );

  // 5b. Un 404 corregido con el mismo webhook-id también se puede cobrar.
  const retry404Order = await createOrderWithLink(1200);
  const missingReferenceEvent = {
    type: "payment_link.status_updated",
    paymentLinkId: retry404Order.paymentLinkId,
    status: "paid",
    clientReferenceId: "ord_inexistente_retry",
    transactions: [
      {
        transactionId: `txn_${crypto.randomUUID()}`,
        paymentMethod: "CODI",
        amount: retry404Order.totalCents / 100,
      },
    ],
  };
  const missingReferenceResponse = await sendEvent(missingReferenceEvent);
  check(
    "5b. 404 de referencia → 404",
    missingReferenceResponse.status === 404,
    `status ${missingReferenceResponse.status}`,
  );
  const corrected404Event = {
    ...missingReferenceEvent,
    clientReferenceId: retry404Order.id,
  };
  const corrected404Response = await sendEvent(corrected404Event, {
    id: missingReferenceResponse.id,
  });
  check(
    "5b. reintento corregido con el mismo webhook-id → 200 processed",
    corrected404Response.status === 200 &&
      corrected404Response.body?.result === "processed",
    JSON.stringify(corrected404Response.body),
  );
  const corrected404Detail = await getOrderDetail(retry404Order.id);
  check(
    "5b. reintento corregido marca pagado una sola vez",
    corrected404Detail.order.status === "paid" &&
      corrected404Detail.order.paidCents === retry404Order.totalCents &&
      corrected404Detail.payments.filter((payment) => payment.status === "paid").length === 1,
    `${corrected404Detail.order.status} / ${corrected404Detail.order.paidCents} / pagos=${corrected404Detail.payments.length}`,
  );
  const corrected404Audit = auditRow(missingReferenceResponse.id);
  check(
    "5b. el 404 rechazado se reutiliza como processed",
    corrected404Audit?.result === "processed" && !corrected404Audit?.error,
    JSON.stringify(corrected404Audit),
  );

  // 6. Timestamp viejo.
  const staleOrder = await createOrderWithLink(1000);
  const staleEvent = linkEvent(staleOrder);
  const staleResponse = await sendEvent(staleEvent, {
    timestamp: Math.floor(Date.now() / 1000) - 600,
  });
  check(
    "6. timestamp viejo → 401",
    staleResponse.status === 401,
    `status ${staleResponse.status}`,
  );
  const staleDetail = await getOrderDetail(staleOrder.id);
  check(
    "6. timestamp viejo no marca pagado",
    staleDetail.order.status !== "paid" && staleDetail.payments.length === 0,
    `${staleDetail.order.status} / pagos=${staleDetail.payments.length}`,
  );

  // 7. Evento pending posterior a un pago.
  const pendingEvent = {
    type: "payment_link.status_updated",
    paymentLinkId: validOrder.paymentLinkId,
    status: "pending",
    clientReferenceId: validOrder.id,
    transactions: [],
  };
  const pendingResponse = await sendEvent(pendingEvent);
  check(
    "7. pending posterior → 200 ignored",
    pendingResponse.status === 200 && pendingResponse.body?.result === "ignored",
    JSON.stringify(pendingResponse.body),
  );
  const pendingDetail = await getOrderDetail(validOrder.id);
  check(
    "7. pending no revierte el pago",
    pendingDetail.order.status === "paid" &&
      pendingDetail.payments.filter((payment) => payment.status === "paid").length === 1,
    `${pendingDetail.order.status} / pagos=${pendingDetail.payments.length}`,
  );

  // 8. JSON inválido con firma válida.
  const invalidJson = '{"type": "payment_link.status_updated",';
  const invalidJsonResponse = await sendRaw(invalidJson);
  check(
    "8. JSON inválido → 400",
    invalidJsonResponse.status === 400,
    `status ${invalidJsonResponse.status}`,
  );
  const invalidJsonAudit = auditRow(invalidJsonResponse.id);
  check(
    "8. JSON inválido auditado",
    invalidJsonAudit?.result === "rejected" && /JSON/i.test(invalidJsonAudit?.error ?? ""),
    JSON.stringify(invalidJsonAudit),
  );

  // 9. QR CoDi válido.
  const qrOrder = await createOrderWithQr(700);
  const qrEvent = {
    type: "codi.qr.payment_received",
    amount: qrOrder.totalCents / 100,
    numRef: qrOrder.numRef,
    transactionId: `txn_${crypto.randomUUID()}`,
    metadata: { orderId: qrOrder.id },
  };
  const qrResponse = await sendEvent(qrEvent);
  check("9. QR válido → 200", qrResponse.status === 200, `status ${qrResponse.status}`);
  check(
    "9. QR procesado",
    qrResponse.body?.result === "processed",
    JSON.stringify(qrResponse.body),
  );
  const qrDetail = await getOrderDetail(qrOrder.id);
  check(
    "9. orden QR pagada una vez",
    qrDetail.order.status === "paid" &&
      qrDetail.order.paidCents === 700 &&
      qrDetail.payments.filter((payment) => payment.status === "paid").length === 1,
    `${qrDetail.order.status} / ${qrDetail.order.paidCents} / pagos=${qrDetail.payments.length}`,
  );

  const failed = results.filter((result) => !result.pass);
  console.log("");
  console.log(`${results.length - failed.length}/${results.length} pruebas en verde`);

  if (failed.length > 0) {
    console.log("");
    for (const result of failed) {
      console.log(`FALLÓ: ${result.name}${result.detail ? ` - ${result.detail}` : ""}`);
    }
  } else {
    console.log(`WEBHOOK OK: ${results.length}/${results.length}`);
  }

  if (process.env.KEEP_DATA !== "1") {
    const finalReset = await request("/api/demo/reset", { method: "POST" });
    console.log(
      finalReset.status === 200
        ? "Base de demo reiniciada."
        : `No se pudo reiniciar la base: ${finalReset.status}`,
    );
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("");
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
