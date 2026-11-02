#!/usr/bin/env node
/**
 * Contrato atómico de pedidos (sin servidor).
 *
 * 1. Un attach tardío de link/QR no degrada un pedido pagado.
 * 2. recordPayment es atómico: si falla el UPDATE, el pago no queda huérfano.
 * 3. Un reintento con la misma transacción repara `paid_cents` desde payments.
 * 4. Un pago demo no se puede marcar como entregado.
 *
 * Compila `src/lib` a CommonJS temporal y usa una DB temporal.
 *
 * Uso, desde web/:
 *   node scripts/p0-orders-atomic-contract.mjs
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const TMP = path.join(os.tmpdir(), "opencode", "orders-atomic", "contract");
const BUILD = path.join(TMP, "build");
const DB_PATH = path.join(TMP, "orders.db");

let checks = 0;
let failures = 0;
const results = [];

function check(name, ok, detail = "") {
  checks += 1;
  if (!ok) failures += 1;
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` · ${detail}` : ""}`);
}

function compile() {
  fs.mkdirSync(BUILD, { recursive: true });
  const result = spawnSync(
    process.execPath,
    [
      path.join(WEB, "node_modules", "typescript", "bin", "tsc"),
      "src/lib/orders.ts",
      "--outDir",
      BUILD,
      "--module",
      "commonjs",
      "--moduleResolution",
      "node",
      "--target",
      "ES2022",
      "--esModuleInterop",
      "--skipLibCheck",
      "--types",
      "node",
      "--noEmitOnError",
      "false",
    ],
    { cwd: WEB, encoding: "utf8" },
  );
  const required = ["orders.js", "db.js", "config.js"];
  for (const file of required) {
    assert.ok(
      fs.existsSync(path.join(BUILD, file)),
      `compilación incompleta: falta ${file}\n${result.stderr ?? ""}`,
    );
  }
}

const requireBuild = createRequire(import.meta.url);

function loadBuild(file) {
  return requireBuild(path.join(BUILD, file));
}

function main() {
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(`${DB_PATH}${suffix}`, { force: true });
  }
  process.env.DATABASE_PATH = DB_PATH;
  process.env.DEMO_MODE = "false";

  const { getDb } = loadBuild("db.js");
  const {
    attachPaymentLink,
    attachQr,
    createOrder,
    fulfillOrder,
    recordPayment,
  } = loadBuild("orders.js");
  const db = getDb();

  // ---------------------------------------------------------------- P0-1
  const paidOrder = createOrder({
    items: [{ description: "Pagado", quantity: 1, unitPriceCents: 5000 }],
    cashCents: 5000,
  });
  assert.equal(paidOrder.status, "paid");
  const afterLateLink = attachPaymentLink(paidOrder.id, {
    id: "link_late",
    url: "https://example.test/late",
  });
  const lateLinkRow = db
    .prepare("SELECT status, payment_url, payment_link_id FROM orders WHERE id = ?")
    .get(paidOrder.id);
  check(
    "attach link tardío no degrada un pedido paid",
    afterLateLink.status === "paid" && lateLinkRow.payment_url === null,
    JSON.stringify(lateLinkRow),
  );
  const afterLateQr = attachQr(
    paidOrder.id,
    { id: "qr_late", qrString: "qr-late", qrImage: null },
    "700001",
  );
  const lateQrRow = db
    .prepare("SELECT status, qr_string, num_ref FROM orders WHERE id = ?")
    .get(paidOrder.id);
  check(
    "attach QR tardío no degrada un pedido paid",
    afterLateQr.status === "paid" && lateQrRow.qr_string === null,
    JSON.stringify(lateQrRow),
  );

  const openOrder = createOrder({
    items: [{ description: "Pendiente", quantity: 1, unitPriceCents: 1200 }],
  });
  const linkedOpen = attachPaymentLink(openOrder.id, {
    id: "link_open",
    url: "https://example.test/open",
  });
  check(
    "un pedido con saldo sí pasa a payment_pending al adjuntar link",
    linkedOpen.status === "payment_pending" && Boolean(linkedOpen.paymentUrl),
    `${linkedOpen.status} · ${linkedOpen.paymentUrl}`,
  );

  // ---------------------------------------------------------------- P0-2
  const atomicOrder = createOrder({
    items: [{ description: "Atómico", quantity: 1, unitPriceCents: 5000 }],
  });
  db.exec(`
    CREATE TRIGGER fail_order_update
    BEFORE UPDATE ON orders
    WHEN NEW.id = '${atomicOrder.id}'
    BEGIN SELECT RAISE(ABORT, 'fallo forzado de update'); END;
  `);
  let failed = false;
  try {
    recordPayment(atomicOrder.id, {
      provider: "pey",
      method: "codi",
      amountCents: 5000,
      transactionId: "tx_atomic_1",
    });
  } catch {
    failed = true;
  }
  const orphanRows = db
    .prepare("SELECT COUNT(*) AS n FROM payments WHERE transaction_id = 'tx_atomic_1'")
    .get();
  const atomicRow = db
    .prepare("SELECT paid_cents, status FROM orders WHERE id = ?")
    .get(atomicOrder.id);
  check(
    "recordPayment: si el UPDATE falla, el pago no queda huérfano",
    failed && Number(orphanRows.n) === 0 && Number(atomicRow.paid_cents) === 0,
    `failed=${failed} pagos=${orphanRows.n} paid=${atomicRow.paid_cents}`,
  );

  db.exec("DROP TRIGGER fail_order_update;");
  const retried = recordPayment(atomicOrder.id, {
    provider: "pey",
    method: "codi",
    amountCents: 5000,
    transactionId: "tx_atomic_1",
  });
  const retriedRows = db
    .prepare("SELECT COUNT(*) AS n FROM payments WHERE transaction_id = 'tx_atomic_1'")
    .get();
  check(
    "recordPayment: el reintento completa la orden sin duplicar el pago",
    retried.status === "paid" &&
      retried.paidCents === 5000 &&
      Number(retriedRows.n) === 1,
    `${retried.status} · ${retried.paidCents} · ${retriedRows.n}`,
  );

  // Pago durable insertado antes, con la orden sin actualizar: el reintento
  // con el mismo transactionId debe curar paid_cents/status.
  const healOrder = createOrder({
    items: [{ description: "Curar", quantity: 1, unitPriceCents: 3000 }],
  });
  db.prepare(
    `INSERT INTO payments
     (id, order_id, provider, method, amount_cents, status, transaction_id, created_at)
     VALUES ('pay_orphan', ?, 'pey', 'codi', 3000, 'paid', 'tx_orphan', ?)`,
  ).run(healOrder.id, new Date().toISOString());
  const healed = recordPayment(healOrder.id, {
    provider: "pey",
    method: "codi",
    amountCents: 3000,
    transactionId: "tx_orphan",
  });
  const healRows = db
    .prepare("SELECT COUNT(*) AS n FROM payments WHERE transaction_id = 'tx_orphan'")
    .get();
  const healAudit = db
    .prepare(
      "SELECT COUNT(*) AS n FROM audit_log WHERE action = 'payment.reconciled' AND entity_id = ?",
    )
    .get(healOrder.id);
  check(
    "recordPayment: un reintento cura la orden desde payments",
    healed.status === "paid" &&
      healed.paidCents === 3000 &&
      Number(healRows.n) === 1 &&
      Number(healAudit.n) === 1,
    `${healed.status} · ${healed.paidCents} · pagos=${healRows.n} audit=${healAudit.n}`,
  );

  // ---------------------------------------------------------------- demo
  process.env.DEMO_MODE = "true";
  const demoOrder = createOrder({
    items: [{ description: "Demo", quantity: 1, unitPriceCents: 2500 }],
  });
  const demoPaid = recordPayment(demoOrder.id, {
    provider: "demo",
    method: "codi",
    amountCents: 2500,
    transactionId: "tx_demo_fulfill",
  });
  let demoFulfillCode = "";
  try {
    fulfillOrder(demoOrder.id);
  } catch (error) {
    demoFulfillCode = error?.code ?? "sin_code";
  }
  const demoAfter = db
    .prepare("SELECT status FROM orders WHERE id = ?")
    .get(demoOrder.id);
  check(
    "un pedido demo_paid no se puede marcar fulfilled",
    demoPaid.status === "demo_paid" &&
      demoFulfillCode === "demo_not_deliverable" &&
      demoAfter.status === "demo_paid",
    `${demoPaid.status} · ${demoFulfillCode} · ${demoAfter.status}`,
  );
  process.env.DEMO_MODE = "false";

  db.close();
}

compile();
try {
  main();
} catch (error) {
  check("contrato sin excepción", false, String(error?.stack ?? error));
}

console.log("");
console.log(
  `P0 ORDERS ATOMIC · ${checks - failures} PASS · ${failures} FAIL · ${checks} checks`,
);
if (failures > 0) {
  for (const result of results.filter((item) => !item.ok)) {
    console.log(`  - ${result.name}${result.detail ? ` · ${result.detail}` : ""}`);
  }
}
process.exitCode = failures === 0 ? 0 : 1;
