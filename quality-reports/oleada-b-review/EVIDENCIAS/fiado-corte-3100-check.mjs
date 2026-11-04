// Minimal 3100 (shared demo server) corroboration. Read/write only demo data.
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const base = "http://127.0.0.1:3100";
const marker = `AUD-FC-3100-${Date.now().toString(36)}`;
const dbPath = path.resolve("..", "web", "data", "mercado-cero.db");
const out = path.resolve("..", "quality-reports", "oleada-b-review", "EVIDENCIAS", "fiado-corte-3100.json");

async function get(url) {
  const r = await fetch(base + url, { cache: "no-store" });
  return { status: r.status, body: await r.json() };
}
async function post(url, body) {
  const r = await fetch(base + url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}

const before = await get("/api/cash");
const created = await post("/api/orders", {
  items: [{ description: `Fiado 3100 ${marker}`, quantity: 1, unitPriceCents: 3000 }],
  cashCents: 0,
  creditCents: 3000,
  customerName: `Cliente 3100 ${marker}`,
  requestId: `sale-${marker}`,
});
const order = created.body.order;
const detailAfterCreate = await get(`/api/orders/${order.id}`);
const cashAfterCreate = await get("/api/cash");
const abono = await post(`/api/credits/${order.creditId}/pay`, {
  amountCents: 1000,
  method: "cash",
  note: `Abono 3100 ${marker}`,
  requestId: `cp-${marker}`,
});
const detailAfterAbono = await get(`/api/orders/${order.id}`);
const cashAfterAbono = await get("/api/cash");
const ordersTotal = (await get("/api/orders?limit=1")).body.total;

const db = new DatabaseSync(dbPath, { readOnly: true });
const dbOrder = db
  .prepare("SELECT id,status,total_cents,paid_cents,credit_cents,customer_name,credit_id,demo FROM orders WHERE id = ?")
  .get(order.id);
const dbCredit = db
  .prepare("SELECT id,order_id,original_cents,balance_cents,status,demo FROM credits WHERE id = ?")
  .get(order.creditId);
const dbPayments = db.prepare("SELECT id,provider,method,amount_cents,status,demo FROM payments WHERE order_id = ?").all(order.id);
const dbCreditPayments = db
  .prepare("SELECT id,amount_cents,method,provider,request_id,demo FROM credit_payments WHERE credit_id = ?")
  .all(order.creditId);
db.close();

const result = {
  marker,
  capturedAt: new Date().toISOString(),
  before: before.body,
  created,
  detailAfterCreate: detailAfterCreate.body,
  cashAfterCreate: cashAfterCreate.body,
  abono,
  detailAfterAbono: detailAfterAbono.body,
  cashAfterAbono: cashAfterAbono.body,
  ordersTotal,
  db: { order: dbOrder, credit: dbCredit, payments: dbPayments, creditPayments: dbCreditPayments },
};
fs.writeFileSync(out, JSON.stringify(result, null, 2) + "\n");

const checks = {
  fiadoNoPayment: dbPayments.length === 0,
  fiadoCredit3000: Number(dbCredit?.original_cents) === 3000 && Number(dbCredit?.balance_cents) === 2000,
  fiadoNoCashSale: Number(dbOrder?.paid_cents) === 0 && Number(dbOrder?.credit_cents) === 3000,
  abonoOneRow: dbCreditPayments.length === 1 && Number(dbCreditPayments[0]?.amount_cents) === 1000,
  orderCreditOriginal: Number(dbOrder?.credit_cents) === 3000,
  cashSalesUnchangedAfterFiado:
    cashAfterCreate.body.cashSalesCents === before.body.cashSalesCents,
  cashCreditPlus1000: cashAfterAbono.body.cashCreditCents === cashAfterCreate.body.cashCreditCents + 1000,
  cashSalesUnchangedAfterAbono: cashAfterAbono.body.cashSalesCents === cashAfterCreate.body.cashSalesCents,
};
console.log(JSON.stringify({ marker, orderId: order.id, creditId: order.creditId, checks, cash: { before: before.body, afterCreate: cashAfterCreate.body, afterAbono: cashAfterAbono.body } }, null, 2));
console.log(out);
