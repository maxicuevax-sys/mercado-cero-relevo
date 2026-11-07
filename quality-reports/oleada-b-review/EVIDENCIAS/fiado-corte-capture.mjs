// Read-only evidence capture for the fiado/corte audit.
// Usage: node fiado-corte-capture.mjs <label> [marker]
// Writes quality-reports/oleada-b-review/EVIDENCIAS/fiado-corte-<label>.json
// It only reads the HTTP API and opens SQLite in readOnly mode.
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const label = process.argv[2] || "snapshot";
const marker = process.argv[3] || "";
const base = process.env.CAPTURE_BASE || "http://127.0.0.1:3100";
const dbPath = path.resolve(process.env.CAPTURE_DB || "data/mercado-cero.db");
const outDir = path.resolve("..", "quality-reports", "oleada-b-review", "EVIDENCIAS");
fs.mkdirSync(outDir, { recursive: true });

async function getJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  return { status: response.status, body: await response.json() };
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

const health = await getJson(`${base}/api/health`);
const cash = await getJson(`${base}/api/cash`);
const dashboard = await getJson(`${base}/api/dashboard?ordersLimit=5&pendingLimit=5&creditsLimit=10`);
const preview = await postJson(`${base}/api/cash/preview`, {
  openingCents: cash.body.openingCents ?? 0,
  expensesCents: 0,
  withdrawalsCents: 0,
  countedCents: cash.body.openingCents ?? 0,
  baseNextCents: cash.body.openingCents ?? 0,
});

const db = new DatabaseSync(dbPath, { readOnly: true });
const all = (sql, ...params) => db.prepare(sql).all(...params);
const one = (sql, ...params) => db.prepare(sql).get(...params);

const orders = all(
  `SELECT id, status, total_cents, paid_cents, credit_cents, payment_method,
          customer_name, credit_id, request_id, request_hash, demo, created_at, updated_at
   FROM orders ORDER BY created_at DESC, id DESC LIMIT 40`,
);
const markerOrders = marker
  ? all(
      `SELECT o.id, o.status, o.total_cents, o.paid_cents, o.credit_cents, o.payment_method,
              o.customer_name, o.credit_id, o.request_id, o.demo, o.created_at, o.updated_at
       FROM orders o
       WHERE o.customer_name LIKE ? OR o.id IN (
         SELECT order_id FROM order_items WHERE description LIKE ?
       )
       ORDER BY o.created_at DESC`,
      `%${marker}%`,
      `%${marker}%`,
    )
  : [];
const markerOrderIds = markerOrders.map((order) => order.id);
const placeholders = markerOrderIds.map(() => "?").join(",") || "''";
const payments = marker
  ? all(
      `SELECT id, order_id, provider, method, amount_cents, status, transaction_id, demo, created_at
       FROM payments WHERE order_id IN (${placeholders}) ORDER BY created_at`,
      ...markerOrderIds,
    )
  : all(
      `SELECT id, order_id, provider, method, amount_cents, status, transaction_id, demo, created_at
       FROM payments ORDER BY created_at DESC LIMIT 20`,
    );
const credits = marker
  ? all(
      `SELECT c.id, c.customer_id, c.order_id, c.original_cents, c.balance_cents, c.status,
              c.demo, c.created_at, cu.name AS customer_name
       FROM credits c JOIN customers cu ON cu.id = c.customer_id
       WHERE cu.name LIKE ? OR c.order_id IN (${placeholders})
       ORDER BY c.created_at`,
      `%${marker}%`,
      ...markerOrderIds,
    )
  : all(
      `SELECT c.id, c.customer_id, c.order_id, c.original_cents, c.balance_cents, c.status,
              c.demo, c.created_at, cu.name AS customer_name
       FROM credits c JOIN customers cu ON cu.id = c.customer_id
       ORDER BY c.created_at DESC LIMIT 20`,
    );
const markerCreditIds = credits.map((credit) => credit.id);
const creditPlaceholders = markerCreditIds.map(() => "?").join(",") || "''";
const creditPayments = marker
  ? all(
      `SELECT id, credit_id, amount_cents, method, provider, note, request_id, demo, created_at
       FROM credit_payments WHERE credit_id IN (${creditPlaceholders}) ORDER BY created_at`,
      ...markerCreditIds,
    )
  : all(
      `SELECT id, credit_id, amount_cents, method, provider, note, request_id, demo, created_at
       FROM credit_payments ORDER BY created_at DESC LIMIT 20`,
    );
const auditLog = all(
  `SELECT id, action, entity, entity_id, detail, created_at
   FROM audit_log ORDER BY created_at DESC LIMIT 30`,
);
const counts = {
  orders: one("SELECT COUNT(*) AS n FROM orders"),
  payments: one("SELECT COUNT(*) AS n FROM payments"),
  credits: one("SELECT COUNT(*) AS n FROM credits"),
  creditPayments: one("SELECT COUNT(*) AS n FROM credit_payments"),
  cashCloses: one("SELECT COUNT(*) AS n FROM cash_closes"),
  sums: one(
    `SELECT
       (SELECT COALESCE(SUM(amount_cents),0) FROM payments WHERE method='cash' AND provider!='demo') AS cash_sales_all,
       (SELECT COALESCE(SUM(amount_cents),0) FROM credit_payments WHERE method='cash' AND provider!='demo') AS cash_credit_all`,
  ),
};
const cashCloses = all(
  `SELECT id, date, version, opening_cents, cash_sales_cents, cash_credit_cents,
          expenses_cents, withdrawals_cents, expected_cents, counted_cents,
          snapshot_cash_cents, snapshot_credit_cents, snapshot_pending_digital_cents,
          demo, created_at
   FROM cash_closes ORDER BY date DESC, version DESC`,
);
db.close();

const output = {
  label,
  marker,
  capturedAt: new Date().toISOString(),
  health,
  cash,
  dashboard: { status: dashboard.status, summary: dashboard.body.summary, demoMode: dashboard.body.demoMode },
  preview,
  db: { counts, orders, markerOrders, payments, credits, creditPayments, auditLog, cashCloses },
};

const file = path.join(outDir, `fiado-corte-${label}.json`);
fs.writeFileSync(file, JSON.stringify(output, null, 2) + "\n");
console.log(file);
console.log(
  JSON.stringify({
    cash: {
      opening: cash.body.openingCents,
      cashSales: cash.body.cashSalesCents,
      cashCredit: cash.body.cashCreditCents,
      expected: cash.body.expectedCents,
    },
    preview: preview.body.preview,
    summary: dashboard.body.summary,
    counts,
    markerOrders: markerOrders.map((o) => ({
      id: o.id,
      status: o.status,
      total: o.total_cents,
      paid: o.paid_cents,
      credit: o.credit_cents,
      customer: o.customer_name,
    })),
    payments: payments.map((p) => ({
      id: p.id,
      order_id: p.order_id,
      provider: p.provider,
      method: p.method,
      amount_cents: p.amount_cents,
      status: p.status,
      transaction_id: p.transaction_id,
      demo: p.demo,
      created_at: p.created_at,
    })),
    credits: credits.map((c) => ({
      id: c.id,
      order_id: c.order_id,
      original_cents: c.original_cents,
      balance_cents: c.balance_cents,
      status: c.status,
      customer: c.customer_name,
    })),
    creditPayments: creditPayments.map((p) => ({
      id: p.id,
      credit_id: p.credit_id,
      amount_cents: p.amount_cents,
      method: p.method,
      request_id: p.request_id,
    })),
  }),
);
