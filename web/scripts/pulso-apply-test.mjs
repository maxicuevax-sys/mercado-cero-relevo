import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

function transpile(relative) {
  const sourcePath = fileURLToPath(new URL(relative, import.meta.url));
  return ts.transpileModule(readFileSync(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

const timelineUrl = `data:text/javascript;base64,${Buffer.from(transpile("../src/lib/pulso-timeline.ts")).toString("base64")}`;
const applyJs = transpile("../src/lib/pulso-apply.ts").replaceAll(
  'from "./pulso-timeline"',
  `from "${timelineUrl}"`,
);
const apply = await import(`data:text/javascript;base64,${Buffer.from(applyJs).toString("base64")}`);
const timeline = await import(timelineUrl);

function memoryDb() {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE orders (id TEXT PRIMARY KEY, status TEXT NOT NULL);
    CREATE TABLE payments (order_id TEXT, provider TEXT, demo INTEGER, status TEXT, amount_cents INTEGER);
    CREATE TABLE order_items (order_id TEXT, description TEXT, quantity REAL);
    CREATE TABLE stall_products (id TEXT PRIMARY KEY, stall_id TEXT, name TEXT, stock INTEGER, price_cents INTEGER);
    CREATE TABLE inventory_moves (
      id TEXT PRIMARY KEY, order_id TEXT, product_id TEXT, quantity INTEGER,
      webhook_id TEXT, created_at TEXT, UNIQUE(order_id, product_id)
    );
    CREATE TABLE order_timeline (
      id TEXT PRIMARY KEY, order_id TEXT, step TEXT, at TEXT, detail TEXT,
      webhook_id TEXT, UNIQUE(order_id, step)
    );
  `);
  database.prepare(
    "INSERT INTO stall_products (id, stall_id, name, stock, price_cents) VALUES ('pulso_quesadilla', 'lupita', 'Quesadilla', 12, 4500)",
  ).run();
  database.prepare("INSERT INTO orders (id, status) VALUES ('ord_pulso', 'paid')").run();
  database.prepare(
    "INSERT INTO payments (order_id, provider, demo, status, amount_cents) VALUES ('ord_pulso', 'pey', 0, 'paid', 4500)",
  ).run();
  database.prepare(
    "INSERT INTO order_items (order_id, description, quantity) VALUES ('ord_pulso', 'Quesadillas', 2)",
  ).run();
  return database;
}

test("el inventario baja una vez y el segundo llamado no hace nada", () => {
  const database = memoryDb();
  const first = apply.applyPulsoAfterVerifiedPayment(database, {
    orderId: "ord_pulso",
    webhookId: "msg_one",
    at: "2026-11-14T18:00:00.000Z",
  });
  const second = apply.applyPulsoAfterVerifiedPayment(database, {
    orderId: "ord_pulso",
    webhookId: "msg_one",
    at: "2026-11-14T18:01:00.000Z",
  });
  const stock = database.prepare("SELECT stock FROM stall_products WHERE id = 'pulso_quesadilla'").get();
  const moves = database.prepare("SELECT COUNT(*) AS n FROM inventory_moves").get();
  const steps = database.prepare("SELECT step FROM order_timeline ORDER BY step").all().map((row) => row.step);
  assert.equal(first.started, true);
  assert.equal(first.decremented, 2);
  assert.equal(second.duplicate, true);
  assert.equal(second.decremented, 0);
  assert.equal(stock.stock, 10);
  assert.equal(moves.n, 1);
  assert.deepEqual(steps, [
    "fulfillment.started",
    "payment.received",
    "pey.webhook.verified",
  ]);
});

test("un pago demo no produce ni descuenta", () => {
  const database = memoryDb();
  database.prepare("UPDATE payments SET demo = 1").run();
  database.prepare("UPDATE orders SET status = 'demo_paid'").run();
  const result = apply.applyPulsoAfterVerifiedPayment(database, {
    orderId: "ord_pulso",
    webhookId: "msg_demo",
  });
  const stock = database.prepare("SELECT stock FROM stall_products WHERE id = 'pulso_quesadilla'").get();
  assert.equal(result.started, false);
  assert.equal(stock.stock, 12);
});

test("la línea de tiempo no marca el webhook si no ocurrió", () => {
  const marks = timeline.presentTimeline([], {
    createdAt: "2026-11-14T17:00:00.000Z",
    codiInactive: true,
  });
  const byStep = Object.fromEntries(marks.map((mark) => [mark.step, mark]));
  assert.equal(byStep["order.created"].done, true);
  assert.equal(byStep["payment.requested"].done, false);
  assert.match(byStep["payment.requested"].detail, /CoDi no activo/);
  assert.equal(byStep["pey.webhook.verified"].done, false);
  assert.match(byStep["pey.webhook.verified"].detail, /firma válida/i);
  assert.match(byStep["pey.webhook.verified"].detail, /webhook-id/i);
  assert.equal(byStep["fulfillment.started"].done, false);
});
