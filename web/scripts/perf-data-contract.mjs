#!/usr/bin/env node
/**
 * Contrato de rendimiento de datos (sin servidor).
 *
 * 1. Compila `src/lib` a un build CommonJS temporal.
 * 2. Prepara una base "vieja": esquema actual, datos, pero sin los índices
 *    nuevos, y la cierra.
 * 3. En un proceso limpio abre la base, mide la migración, verifica que los
 *    índices existen, que los planes los usan y que `listOrders` hidrata la
 *    página con consultas fijas (sin N+1).
 *
 * Uso, desde web/:
 *   npm run test:perf-data
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
const TMP = path.join(os.tmpdir(), "opencode", "perf-data", "contract");
const BUILD = path.join(TMP, "build");
const DB_PATH = path.join(TMP, "legacy.db");
const NEW_INDEXES = [
  "idx_order_items_order_id",
  "idx_payments_order_status_method_created",
  "idx_payments_method_status_created",
  "idx_payments_status_created",
  "idx_credit_payments_created",
  "idx_credit_payments_method_created",
  "idx_credits_status_created",
  "idx_orders_created_status",
  "idx_orders_status_created",
  "idx_orders_created_id",
];

function compile() {
  fs.mkdirSync(BUILD, { recursive: true });
  const result = spawnSync(
    process.execPath,
    [
      path.join(WEB, "node_modules", "typescript", "bin", "tsc"),
      "src/lib/db.ts",
      "src/lib/cash.ts",
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
  const required = ["db.js", "cash.js", "config.js", "time.js"];
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

async function prepare() {
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(`${DB_PATH}${suffix}`, { force: true });
  }
  process.env.DATABASE_PATH = DB_PATH;
  process.env.DEMO_MODE = "false";
  const { getDb } = loadBuild("db.js");
  const db = getDb();
  const now = Date.now();
  const insertOrder = db.prepare(
    `INSERT INTO orders
     (id, merchant_id, status, total_cents, paid_cents, payment_method,
      customer_name, credit_cents, created_at, updated_at)
     VALUES (?, 'lupita', ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertItem = db.prepare(
    `INSERT INTO order_items
     (id, order_id, description, quantity, unit_price_cents, total_cents)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertPayment = db.prepare(
    `INSERT INTO payments
     (id, order_id, provider, method, amount_cents, status, transaction_id, created_at)
     VALUES (?, ?, ?, ?, ?, 'paid', ?, ?)`,
  );
  const insertCustomer = db.prepare(
    "INSERT OR IGNORE INTO customers (id, name, phone, created_at) VALUES (?, ?, NULL, ?)",
  );
  const insertCredit = db.prepare(
    `INSERT INTO credits
     (id, customer_id, order_id, original_cents, balance_cents, status, due_date, created_at)
     VALUES (?, ?, ?, ?, ?, 'open', NULL, ?)`,
  );
  db.exec("BEGIN IMMEDIATE");
  try {
    for (let i = 0; i < 3000; i += 1) {
      const createdAt = new Date(
        now - (i % 40) * 24 * 60 * 60 * 1000 - (i % 24) * 60 * 60 * 1000,
      ).toISOString();
      const orderId = `legacy_ord_${i}`;
      const total = 5000 + (i % 7) * 1000;
      insertOrder.run(
        orderId,
        i % 19 === 0 ? "payment_pending" : "paid",
        total,
        i % 19 === 0 ? 0 : total,
        i % 2 === 0 ? "cash" : "codi",
        null,
        0,
        createdAt,
        createdAt,
      );
      insertItem.run(
        `legacy_itm_${i}_0`,
        orderId,
        "Producto",
        1 + (i % 3),
        1800,
        (1 + (i % 3)) * 1800,
      );
      if (i % 19 !== 0) {
        insertPayment.run(
          `legacy_pay_${i}`,
          orderId,
          i % 2 === 0 ? "cash" : "pey",
          i % 2 === 0 ? "cash" : "codi",
          total,
          i % 2 === 0 ? null : `legacy_txn_${i}`,
          createdAt,
        );
      }
      if (i % 7 === 0) {
        const customerId = `legacy_cus_${i}`;
        insertCustomer.run(customerId, `Cliente legado ${i}`, createdAt);
        insertCredit.run(
          `legacy_cred_${i}`,
          customerId,
          orderId,
          1000,
          1000,
          createdAt,
        );
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  for (const name of NEW_INDEXES) db.exec(`DROP INDEX IF EXISTS ${name}`);
  db.close();
  console.log(`DB legada preparada: ${DB_PATH}`);
}

function hasIndex(db, table, name) {
  return db
    .prepare(`PRAGMA index_list(${table})`)
    .all()
    .some((row) => row.name === name);
}

function plan(db, sql, params = []) {
  return db
    .prepare(`EXPLAIN QUERY PLAN ${sql}`)
    .all(...params)
    .map((row) => row.detail)
    .join("\n");
}

async function verify() {
  process.env.DATABASE_PATH = DB_PATH;
  process.env.DEMO_MODE = "false";
  const started = performance.now();
  const { getDb, listOrders } = loadBuild("db.js");
  const { getCashStatus } = loadBuild("cash.js");
  const db = getDb();
  const migrationMs = Number((performance.now() - started).toFixed(1));

  for (const name of NEW_INDEXES) {
    const table = name.includes("order_items")
      ? "order_items"
      : name.includes("credit_payments")
        ? "credit_payments"
        : name.includes("credits")
          ? "credits"
          : name.includes("payments")
            ? "payments"
            : "orders";
    assert.ok(hasIndex(db, table, name), `falta índice ${name} en ${table}`);
  }

  const plans = {
    orderItems: plan(
      db,
      "SELECT * FROM order_items WHERE order_id = ? ORDER BY rowid ASC",
      ["legacy_ord_0"],
    ),
    paymentsDaily: plan(
      db,
      "SELECT p.method, p.provider, p.amount_cents FROM payments p WHERE p.status = 'paid' AND p.created_at >= ? AND p.created_at < ?",
      ["2020-01-01T00:00:00.000Z", "2030-01-01T00:00:00.000Z"],
    ),
    cashSales: plan(
      db,
      `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM payments
       WHERE status IN ('paid','demo_paid') AND method = 'cash' AND provider != 'demo'
         AND created_at >= ? AND created_at < ?`,
      ["2020-01-01T00:00:00.000Z", "2030-01-01T00:00:00.000Z"],
    ),
    cashCredit: plan(
      db,
      `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM credit_payments
       WHERE method = 'cash' AND provider != 'demo'
         AND created_at >= ? AND created_at < ?`,
      ["2020-01-01T00:00:00.000Z", "2030-01-01T00:00:00.000Z"],
    ),
    creditsPage: plan(
      db,
      `SELECT c.*, cu.name AS customer_name
       FROM credits c INDEXED BY idx_credits_status_created
       JOIN customers cu ON cu.id = c.customer_id
       ORDER BY c.status ASC, c.created_at DESC, c.id DESC LIMIT 100`,
    ),
  };

  assert.match(plans.orderItems, /idx_order_items_order_id/);
  assert.match(plans.paymentsDaily, /idx_payments_status_created/);
  assert.match(plans.cashSales, /idx_payments_method_status_created/);
  assert.match(plans.cashCredit, /idx_credit_payments_method_created/);
  assert.match(plans.creditsPage, /idx_credits_status_created/);
  assert.ok(
    migrationMs < 15_000,
    `la migración tardó ${migrationMs} ms; debe quedar por debajo de 15 s`,
  );

  let prepares = 0;
  const originalPrepare = db.prepare.bind(db);
  db.prepare = (sql) => {
    prepares += 1;
    return originalPrepare(sql);
  };
  const page = listOrders(50);
  db.prepare = originalPrepare;
  assert.equal(page.length, 50);
  assert.ok(
    prepares <= 6,
    `listOrders(50) hizo ${prepares} consultas; se esperaban <= 6 (sin N+1)`,
  );

  const date = db
    .prepare("SELECT date('now', '-6 hours') AS d")
    .get().d;
  const legacyCash = db
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total
       FROM payments
       WHERE status IN ('paid', 'demo_paid') AND method = 'cash'
         AND provider != 'demo'
         AND date(created_at, '-6 hours') = ?`,
    )
    .get(date);
  const status = getCashStatus();
  assert.equal(
    status.cashSalesCents,
    Number(legacyCash.total),
    "getCashStatus cambió el resultado del efectivo del día",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        migrationMs,
        preparesFor50Orders: prepares,
        rows: page.length,
        checks: {
          indexes: NEW_INDEXES.length,
          plans: Object.keys(plans),
          cashSalesCents: status.cashSalesCents,
        },
      },
      null,
      2,
    ),
  );
}

if (process.argv.includes("--prepare")) {
  await prepare();
} else if (process.argv.includes("--verify")) {
  await verify();
} else {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  compile();
  const prepareRun = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--prepare"], {
    cwd: WEB,
    stdio: "inherit",
    env: process.env,
  });
  assert.equal(prepareRun.status, 0, "falló la preparación de la DB legada");
  const verifyRun = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--verify"], {
    cwd: WEB,
    stdio: "inherit",
    env: process.env,
  });
  assert.equal(verifyRun.status, 0, "falló la verificación de rendimiento");
}
