import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { MERCHANT, isDemoMode } from "./config";
import { mexicoDateKey, startOfMexicoDay } from "./time";
import type {
  Credit,
  Customer,
  DailySummary,
  Order,
  OrderItem,
  Payment,
} from "./types";

const dataDir = path.join(process.cwd(), "data");
const dbPath = process.env.DATABASE_PATH ?? path.join(dataDir, "mercado-cero.db");
const backupDir =
  process.env.DATABASE_BACKUP_DIR ?? path.join(dataDir, "backups");

let db: DatabaseSync | null = null;

export class DemoResetBlockedError extends Error {
  readonly realPaymentCount: number;

  constructor(realPaymentCount: number) {
    super(
      "Hay pagos reales de pey confirmados. El reinicio de demo está bloqueado.",
    );
    this.name = "DemoResetBlockedError";
    this.realPaymentCount = realPaymentCount;
  }
}

export interface DemoResetResult {
  backup: string;
  realPaymentCount: number;
  preservedRealPayments: number;
}

export function newId(prefix = "mc"): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

function ensureDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export function getDb(): DatabaseSync {
  if (db) return db;
  ensureDir();
  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  seed(db);
  seedGoal(db);
  seedDemoHistory(db);
  return db;
}

function migrate(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      merchant_id TEXT NOT NULL DEFAULT 'lupita',
      status TEXT NOT NULL DEFAULT 'draft',
      total_cents INTEGER NOT NULL,
      paid_cents INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT,
      customer_name TEXT,
      credit_id TEXT,
      credit_cents INTEGER NOT NULL DEFAULT 0,
      payment_link_id TEXT,
      payment_url TEXT,
      qr_id TEXT,
      qr_string TEXT,
      qr_image TEXT,
      num_ref TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price_cents INTEGER NOT NULL,
      total_cents INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      method TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      status TEXT NOT NULL,
      transaction_id TEXT UNIQUE,
      payment_link_id TEXT,
      raw_event TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payment_events (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      event_type TEXT NOT NULL,
      idempotency_key TEXT UNIQUE NOT NULL,
      payload TEXT NOT NULL,
      signature_valid INTEGER NOT NULL,
      processed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      phone TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS credits (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      order_id TEXT,
      original_cents INTEGER NOT NULL,
      balance_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      due_date TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS credit_payments (
      id TEXT PRIMARY KEY,
      credit_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      method TEXT NOT NULL DEFAULT 'cash',
      note TEXT,
      request_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (credit_id) REFERENCES credits(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cash_closes (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      opening_cents INTEGER NOT NULL DEFAULT 0,
      cash_sales_cents INTEGER NOT NULL DEFAULT 0,
      cash_credit_cents INTEGER NOT NULL DEFAULT 0,
      expenses_cents INTEGER NOT NULL DEFAULT 0,
      withdrawals_cents INTEGER NOT NULL DEFAULT 0,
      expected_cents INTEGER NOT NULL DEFAULT 0,
      counted_cents INTEGER NOT NULL DEFAULT 0,
      difference_cents INTEGER NOT NULL DEFAULT 0,
      base_next_cents INTEGER NOT NULL DEFAULT 0,
      withdrawal_next_cents INTEGER NOT NULL DEFAULT 0,
      snapshot_cash_cents INTEGER NOT NULL DEFAULT 0,
      snapshot_credit_cents INTEGER NOT NULL DEFAULT 0,
      snapshot_pending_digital_cents INTEGER NOT NULL DEFAULT 0,
      snapshot_known INTEGER NOT NULL DEFAULT 1,
      reason TEXT,
      request_id TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(date, version)
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      target_cents INTEGER NOT NULL,
      saved_cents INTEGER NOT NULL DEFAULT 0,
      deadline TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS goal_contributions (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      due_at TEXT,
      postponed_until TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
    CREATE INDEX IF NOT EXISTS idx_credits_customer ON credits(customer_id);
    CREATE INDEX IF NOT EXISTS idx_cash_closes_date ON cash_closes(date);
    CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal ON goal_contributions(goal_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_at);
  `);

  const columns = database.prepare("PRAGMA table_info(orders)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "credit_cents")) {
    database.exec("ALTER TABLE orders ADD COLUMN credit_cents INTEGER NOT NULL DEFAULT 0;");
  }
  if (!columns.some((column) => column.name === "qr_id")) {
    database.exec("ALTER TABLE orders ADD COLUMN qr_id TEXT;");
  }

  const eventColumns = database.prepare("PRAGMA table_info(payment_events)").all() as Array<{
    name: string;
  }>;
  if (!eventColumns.some((column) => column.name === "result")) {
    database.exec("ALTER TABLE payment_events ADD COLUMN result TEXT;");
  }
  if (!eventColumns.some((column) => column.name === "error")) {
    database.exec("ALTER TABLE payment_events ADD COLUMN error TEXT;");
  }

  const creditPaymentColumns = database
    .prepare("PRAGMA table_info(credit_payments)")
    .all() as Array<{ name: string }>;
  if (!creditPaymentColumns.some((column) => column.name === "note")) {
    database.exec("ALTER TABLE credit_payments ADD COLUMN note TEXT;");
  }
  if (!creditPaymentColumns.some((column) => column.name === "request_id")) {
    database.exec("ALTER TABLE credit_payments ADD COLUMN request_id TEXT;");
  }
  // La llave es opcional: los abonos viejos y los que no traen requestId
  // conservan request_id NULL y no compiten en el índice parcial.
  database.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_payments_request_id ON credit_payments(request_id) WHERE request_id IS NOT NULL;",
  );

  migrateCashCloses(database);
}

/**
 * `cash_closes` nació con una fila por fecha. El corte versionado necesita
 * conservar cada guardado. La migración es atómica y también recupera una
 * `cash_closes_legacy` que haya quedado de un intento anterior.
 */
function migrateCashCloses(database: DatabaseSync) {
  const columns = tableColumns(database, "cash_closes");
  const hasVersion = columns.some((column) => column.name === "version");

  database.exec("BEGIN IMMEDIATE");
  try {
    if (!hasVersion) {
      // Si quedó una legacy de un intento previo, primero se recuperan sus
      // filas en la tabla vieja y después se hace la reconstrucción completa.
      if (tableExists(database, "cash_closes_legacy")) {
        const legacyColumns = tableColumns(database, "cash_closes_legacy").map(
          (column) => column.name,
        );
        const common = columns
          .map((column) => column.name)
          .filter((name) => legacyColumns.includes(name));
        if (common.length > 0) {
          const list = common.join(", ");
          database.exec(
            `INSERT OR IGNORE INTO cash_closes (${list})
             SELECT ${list} FROM cash_closes_legacy;
             DROP TABLE cash_closes_legacy;`,
          );
        } else {
          database.exec("DROP TABLE cash_closes_legacy;");
        }
      }

      database.exec(`
        DROP INDEX IF EXISTS idx_cash_closes_date;
        DROP INDEX IF EXISTS idx_cash_closes_date_version;
        DROP INDEX IF EXISTS idx_cash_closes_request_id;
        ALTER TABLE cash_closes RENAME TO cash_closes_legacy;
        CREATE TABLE cash_closes (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          opening_cents INTEGER NOT NULL DEFAULT 0,
          cash_sales_cents INTEGER NOT NULL DEFAULT 0,
          cash_credit_cents INTEGER NOT NULL DEFAULT 0,
          expenses_cents INTEGER NOT NULL DEFAULT 0,
          withdrawals_cents INTEGER NOT NULL DEFAULT 0,
          expected_cents INTEGER NOT NULL DEFAULT 0,
          counted_cents INTEGER NOT NULL DEFAULT 0,
          difference_cents INTEGER NOT NULL DEFAULT 0,
          base_next_cents INTEGER NOT NULL DEFAULT 0,
          withdrawal_next_cents INTEGER NOT NULL DEFAULT 0,
          snapshot_cash_cents INTEGER NOT NULL DEFAULT 0,
          snapshot_credit_cents INTEGER NOT NULL DEFAULT 0,
          snapshot_pending_digital_cents INTEGER NOT NULL DEFAULT 0,
          snapshot_known INTEGER NOT NULL DEFAULT 1,
          reason TEXT,
          request_id TEXT,
          created_at TEXT NOT NULL,
          UNIQUE(date, version)
        );
        INSERT INTO cash_closes
          (id, date, version, opening_cents, cash_sales_cents, cash_credit_cents,
           expenses_cents, withdrawals_cents, expected_cents, counted_cents,
           difference_cents, base_next_cents, withdrawal_next_cents,
           snapshot_cash_cents, snapshot_credit_cents, snapshot_pending_digital_cents,
           snapshot_known, reason, request_id, created_at)
        SELECT
          id, date, 1, opening_cents, cash_sales_cents, cash_credit_cents,
          expenses_cents, withdrawals_cents, expected_cents, counted_cents,
          difference_cents, base_next_cents, withdrawal_next_cents,
          cash_sales_cents + cash_credit_cents, 0, 0,
          0, NULL, NULL, created_at
        FROM cash_closes_legacy;
        DROP TABLE cash_closes_legacy;
        CREATE INDEX IF NOT EXISTS idx_cash_closes_date ON cash_closes(date);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_closes_date_version
          ON cash_closes(date, version);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_closes_request_id
          ON cash_closes(request_id) WHERE request_id IS NOT NULL;
      `);
      database.exec("COMMIT");
      return;
    }

    const addColumn = (name: string, definition: string) => {
      const current = tableColumns(database, "cash_closes");
      if (!current.some((column) => column.name === name)) {
        database.exec(`ALTER TABLE cash_closes ADD COLUMN ${name} ${definition};`);
      }
    };
    addColumn("snapshot_cash_cents", "INTEGER NOT NULL DEFAULT 0");
    addColumn("snapshot_credit_cents", "INTEGER NOT NULL DEFAULT 0");
    addColumn("snapshot_pending_digital_cents", "INTEGER NOT NULL DEFAULT 0");
    // En una tabla ya versionada no sabemos si un 0 significaba “cero real”;
    // se marca desconocido y se hace backfill solo cuando hay una foto > 0.
    addColumn("snapshot_known", "INTEGER NOT NULL DEFAULT 0");
    addColumn("reason", "TEXT");
    addColumn("request_id", "TEXT");

    if (tableExists(database, "cash_closes_legacy")) {
      copyLegacyIntoVersioned(database);
    }

    database.exec(`
      UPDATE cash_closes
      SET snapshot_known = 1
      WHERE snapshot_known = 0
        AND (snapshot_credit_cents != 0
          OR snapshot_pending_digital_cents != 0);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_closes_date_version
        ON cash_closes(date, version);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_closes_request_id
        ON cash_closes(request_id) WHERE request_id IS NOT NULL;
    `);
    database.exec("COMMIT");
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // Si SQLite ya cerró la transacción, conservamos el error original.
    }
    throw error;
  }
}

function tableExists(database: DatabaseSync, table: string): boolean {
  const row = database
    .prepare("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) as unknown as { found: number } | undefined;
  return Boolean(row);
}

function tableColumns(database: DatabaseSync, table: string): Array<{ name: string }> {
  return database.prepare(`PRAGMA table_info(${table})`).all() as unknown as Array<{
    name: string;
  }>;
}

/** Recupera filas de una legacy parcial en una tabla ya versionada. */
function copyLegacyIntoVersioned(database: DatabaseSync) {
  const legacyColumns = tableColumns(database, "cash_closes_legacy").map(
    (column) => column.name,
  );
  const has = (name: string) => legacyColumns.includes(name);
  const version = has("version") ? "version" : "1";
  const snapshotCash = has("snapshot_cash_cents")
    ? "snapshot_cash_cents"
    : "cash_sales_cents + cash_credit_cents";
  const snapshotCredit = has("snapshot_credit_cents") ? "snapshot_credit_cents" : "0";
  const snapshotPending = has("snapshot_pending_digital_cents")
    ? "snapshot_pending_digital_cents"
    : "0";
  const snapshotKnown = has("snapshot_known") ? "snapshot_known" : "0";
  const reason = has("reason") ? "reason" : "NULL";
  const requestId = has("request_id") ? "request_id" : "NULL";

  database.exec(`
    INSERT OR IGNORE INTO cash_closes
      (id, date, version, opening_cents, cash_sales_cents, cash_credit_cents,
       expenses_cents, withdrawals_cents, expected_cents, counted_cents,
       difference_cents, base_next_cents, withdrawal_next_cents,
       snapshot_cash_cents, snapshot_credit_cents, snapshot_pending_digital_cents,
       snapshot_known, reason, request_id, created_at)
    SELECT
      id, date, ${version}, opening_cents, cash_sales_cents, cash_credit_cents,
      expenses_cents, withdrawals_cents, expected_cents, counted_cents,
      difference_cents, base_next_cents, withdrawal_next_cents,
      ${snapshotCash}, ${snapshotCredit}, ${snapshotPending},
      ${snapshotKnown}, ${reason}, ${requestId}, created_at
    FROM cash_closes_legacy;
    DROP TABLE cash_closes_legacy;
  `);
}

function seed(database: DatabaseSync) {
  const count = database.prepare("SELECT COUNT(*) AS n FROM customers").get() as { n: number };
  if (count.n > 0) return;

  const createdAt = nowIso();
  const juanId = newId("cus");
  database
    .prepare("INSERT INTO customers (id, name, phone, created_at) VALUES (?, ?, ?, ?)")
    .run(juanId, "Juan", null, createdAt);

  const creditId = newId("cred");
  database
    .prepare(
      "INSERT INTO credits (id, customer_id, order_id, original_cents, balance_cents, status, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(creditId, juanId, null, 5000, 5000, "open", null, createdAt);

  const orderId = newId("ord");
  database
    .prepare(
      "INSERT INTO orders (id, merchant_id, status, total_cents, paid_cents, payment_method, customer_name, credit_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(orderId, MERCHANT.id, "paid", 7000, 7000, "cash", null, null, createdAt, createdAt);
  database
    .prepare(
      "INSERT INTO order_items (id, order_id, description, quantity, unit_price_cents, total_cents) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(newId("itm"), orderId, "Quesadilla", 2, 3500, 7000);
  database
    .prepare(
      "INSERT INTO payments (id, order_id, provider, method, amount_cents, status, transaction_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(newId("pay"), orderId, "cash", "cash", 7000, "paid", null, createdAt);
}

function seedGoal(database: DatabaseSync) {
  const count = database.prepare("SELECT COUNT(*) AS n FROM goals").get() as { n: number };
  if (count.n > 0) return;

  const targetCents = 180000;
  const savedCents = 30000;
  const deadline = new Date(Date.now() + 56 * 24 * 60 * 60 * 1000).toISOString();
  database
    .prepare(
      "INSERT INTO goals (id, title, target_cents, saved_cents, deadline, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      newId("goal"),
      "Mi primera sombrilla",
      targetCents,
      savedCents,
      deadline,
      "active",
      nowIso(),
    );
}

function seedDemoHistory(database: DatabaseSync) {
  if (!isDemoMode()) return;

  const existing = database
    .prepare("SELECT COUNT(*) AS n FROM orders WHERE id LIKE 'demo_hist_%'")
    .get() as { n: number };
  if (existing.n > 0) return;

  const history: Array<{
    daysAgo: number;
    method: "cash" | "card" | "codi";
    items: Array<[string, number, number]>;
  }> = [
    { daysAgo: 1, method: "cash", items: [["Quesadillas", 3, 3500], ["Agua de horchata", 2, 2500]] },
    { daysAgo: 2, method: "card", items: [["Tlayuda", 2, 5500], ["Refresco", 2, 2500]] },
    { daysAgo: 3, method: "cash", items: [["Tacos al pastor", 4, 3000], ["Agua de jamaica", 2, 2000]] },
    { daysAgo: 4, method: "codi", items: [["Quesadilla", 2, 3500], ["Café de olla", 1, 2500]] },
    { daysAgo: 5, method: "cash", items: [["Tortas", 3, 4500], ["Refresco", 3, 2500]] },
    { daysAgo: 6, method: "card", items: [["Enchiladas", 2, 6000], ["Agua", 2, 2000]] },
    { daysAgo: 8, method: "cash", items: [["Tamales", 6, 2500], ["Atole", 4, 2000]] },
    { daysAgo: 10, method: "codi", items: [["Tlayuda", 2, 5500], ["Agua de horchata", 2, 2500]] },
    { daysAgo: 12, method: "cash", items: [["Quesadillas", 4, 3500], ["Refresco", 4, 2500]] },
    { daysAgo: 15, method: "card", items: [["Pozole", 2, 7500], ["Agua", 2, 2000]] },
    { daysAgo: 18, method: "cash", items: [["Tacos dorados", 5, 3000], ["Agua de jamaica", 2, 2000]] },
    { daysAgo: 21, method: "codi", items: [["Tortas", 2, 4500], ["Café", 2, 2000]] },
    { daysAgo: 25, method: "cash", items: [["Quesadillas", 3, 3500], ["Atole", 3, 2000]] },
  ];

  for (const day of history) {
    const createdAt = new Date(Date.now() - day.daysAgo * 24 * 60 * 60 * 1000);
    createdAt.setHours(13 + (day.daysAgo % 5), 20, 0, 0);
    const id = `demo_hist_${day.daysAgo}_${newId("ord")}`;
    const totalCents = day.items.reduce(
      (sum, [, quantity, unitPrice]) => sum + quantity * unitPrice,
      0,
    );

    database
      .prepare(
        `INSERT INTO orders
         (id, merchant_id, status, total_cents, paid_cents, payment_method, created_at, updated_at)
         VALUES (?, ?, 'demo_paid', ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        MERCHANT.id,
        totalCents,
        totalCents,
        day.method,
        createdAt.toISOString(),
        createdAt.toISOString(),
      );

    for (const [description, quantity, unitPriceCents] of day.items) {
      database
        .prepare(
          `INSERT INTO order_items
           (id, order_id, description, quantity, unit_price_cents, total_cents)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(newId("itm"), id, description, quantity, unitPriceCents, quantity * unitPriceCents);
    }

    database
      .prepare(
        `INSERT INTO payments
         (id, order_id, provider, method, amount_cents, status, transaction_id, created_at)
         VALUES (?, ?, 'demo', ?, ?, 'paid', ?, ?)`,
      )
      .run(
        newId("pay"),
        id,
        day.method,
        totalCents,
        `demo_hist_txn_${id}`,
        createdAt.toISOString(),
      );
  }

  const pendingCreatedAt = new Date(Date.now() - 10 * 60 * 1000);
  const pendingId = `demo_hist_pending_${newId("ord")}`;
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  database
    .prepare(
      `INSERT INTO orders
       (id, merchant_id, status, total_cents, paid_cents, payment_method,
        payment_link_id, payment_url, created_at, updated_at)
       VALUES (?, ?, 'payment_pending', 12000, 0, NULL, ?, ?, ?, ?)`,
    )
    .run(
      pendingId,
      MERCHANT.id,
      `demo_link_${pendingId}`,
      `${appUrl}/pay/${pendingId}?demo=1`,
      pendingCreatedAt.toISOString(),
      pendingCreatedAt.toISOString(),
    );
  database
    .prepare(
      `INSERT INTO order_items
       (id, order_id, description, quantity, unit_price_cents, total_cents)
       VALUES (?, ?, 'Pedido para llevar', 1, 12000, 12000)`,
    )
    .run(newId("itm"), pendingId);

  // Un corte de ayer deja una base de cambio para hoy.
  const yesterday = mexicoDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const existingClose = database
    .prepare("SELECT COUNT(*) AS n FROM cash_closes WHERE date = ?")
    .get(yesterday) as { n: number };
  if (existingClose.n === 0) {
    const closedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    database
      .prepare(
        `INSERT INTO cash_closes
         (id, date, version, opening_cents, cash_sales_cents, cash_credit_cents, expenses_cents,
          withdrawals_cents, expected_cents, counted_cents, difference_cents,
          base_next_cents, withdrawal_next_cents, snapshot_cash_cents,
          snapshot_credit_cents, snapshot_pending_digital_cents, reason, created_at)
         VALUES (?, ?, 1, 50000, 0, 0, 0, 0, 50000, 50000, 0, 50000, 0, 0, 0, 0, NULL, ?)`,
      )
      .run("cash_demo_prev", yesterday, closedAt);
  }
}

export function audit(action: string, entity: string, entityId: string, detail?: unknown) {
  const database = getDb();
  database
    .prepare(
      "INSERT INTO audit_log (id, action, entity, entity_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(newId("aud"), action, entity, entityId, detail ? JSON.stringify(detail) : null, nowIso());
}

function mapOrder(row: Record<string, unknown>): Order {
  const database = getDb();
  const items = database
    .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY rowid ASC")
    .all(row.id as string) as Record<string, unknown>[];
  const digital = database
    .prepare(
      "SELECT COALESCE(SUM(amount_cents), 0) AS total FROM payments WHERE order_id = ? AND status = 'paid' AND method != 'cash'",
    )
    .get(row.id as string) as { total: number };
  const lastPayment = database
    .prepare(
      "SELECT provider FROM payments WHERE order_id = ? AND status = 'paid' ORDER BY CASE WHEN method != 'cash' THEN 0 ELSE 1 END, created_at DESC LIMIT 1",
    )
    .get(row.id as string) as { provider: string } | undefined;

  return {
    id: row.id as string,
    merchantId: row.merchant_id as string,
    status: row.status as Order["status"],
    totalCents: Number(row.total_cents),
    paidCents: Number(row.paid_cents),
    digitalPaidCents: Number(digital.total),
    paymentMethod: (row.payment_method as Order["paymentMethod"]) ?? null,
    lastPaymentProvider: lastPayment?.provider ?? null,
    customerName: (row.customer_name as string) ?? null,
    creditId: (row.credit_id as string) ?? null,
    creditCents: Number(row.credit_cents ?? 0),
    paymentLinkId: (row.payment_link_id as string) ?? null,
    paymentUrl: (row.payment_url as string) ?? null,
    qrId: (row.qr_id as string) ?? null,
    qrString: (row.qr_string as string) ?? null,
    qrImage: (row.qr_image as string) ?? null,
    numRef: (row.num_ref as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    items: items.map(
      (item): OrderItem => ({
        id: item.id as string,
        description: item.description as string,
        quantity: Number(item.quantity),
        unitPriceCents: Number(item.unit_price_cents),
        totalCents: Number(item.total_cents),
      }),
    ),
  };
}

export function listOrders(limit = 30): Order[] {
  const database = getDb();
  const rows = database
    .prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT ?")
    .all(limit) as Record<string, unknown>[];
  return rows.map(mapOrder);
}

/**
 * Cobros pendientes de cualquier fecha. No usa el resumen diario, que solo
 * mira pedidos creados hoy. La franja de P0-E lista estos pedidos.
 */
export function listPendingOrders(limit = 50): Order[] {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT * FROM orders
       WHERE status IN ('confirmed', 'payment_pending', 'partially_paid')
       ORDER BY created_at ASC
       LIMIT ?`,
    )
    .all(limit) as Record<string, unknown>[];
  return rows.map(mapOrder);
}

export function getOrder(id: string): Order | null {
  const database = getDb();
  const row = database.prepare("SELECT * FROM orders WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? mapOrder(row) : null;
}

export function getOrderByPaymentLink(paymentLinkId: string): Order | null {
  const database = getDb();
  const row = database
    .prepare("SELECT * FROM orders WHERE payment_link_id = ?")
    .get(paymentLinkId) as Record<string, unknown> | undefined;
  return row ? mapOrder(row) : null;
}

export function getOrderByNumRef(numRef: string): Order | null {
  const database = getDb();
  const row = database
    .prepare("SELECT * FROM orders WHERE num_ref = ? ORDER BY created_at DESC LIMIT 1")
    .get(numRef) as Record<string, unknown> | undefined;
  return row ? mapOrder(row) : null;
}

export function listPayments(orderId: string): Payment[] {
  const database = getDb();
  const rows = database
    .prepare("SELECT * FROM payments WHERE order_id = ? ORDER BY created_at ASC")
    .all(orderId) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row.id as string,
    orderId: row.order_id as string,
    provider: row.provider as string,
    method: row.method as Payment["method"],
    amountCents: Number(row.amount_cents),
    status: row.status as Payment["status"],
    transactionId: (row.transaction_id as string) ?? null,
    paymentLinkId: (row.payment_link_id as string) ?? null,
    createdAt: row.created_at as string,
  }));
}

export function listCustomers(): Customer[] {
  const database = getDb();
  const rows = database
    .prepare("SELECT * FROM customers ORDER BY name ASC")
    .all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    phone: (row.phone as string) ?? null,
    createdAt: row.created_at as string,
  }));
}

export function findOrCreateCustomer(name: string): Customer {
  const database = getDb();
  const normalized = name.trim();
  const existing = database
    .prepare("SELECT * FROM customers WHERE lower(name) = lower(?)")
    .get(normalized) as Customer | undefined;
  if (existing) return existing;

  const customer: Customer = {
    id: newId("cus"),
    name: normalized,
    phone: null,
    createdAt: nowIso(),
  };
  database
    .prepare("INSERT INTO customers (id, name, phone, created_at) VALUES (?, ?, ?, ?)")
    .run(customer.id, customer.name, customer.phone, customer.createdAt);
  return customer;
}

export function listCredits(): Credit[] {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT c.*, cu.name AS customer_name
       FROM credits c JOIN customers cu ON cu.id = c.customer_id
       ORDER BY c.status ASC, c.created_at DESC`,
    )
    .all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row.id as string,
    customerId: row.customer_id as string,
    customerName: row.customer_name as string,
    orderId: (row.order_id as string) ?? null,
    originalCents: Number(row.original_cents),
    balanceCents: Number(row.balance_cents),
    status: row.status as Credit["status"],
    dueDate: (row.due_date as string) ?? null,
    createdAt: row.created_at as string,
  }));
}

export function getCredit(id: string): Credit | null {
  const database = getDb();
  const row = database
    .prepare(
      `SELECT c.*, cu.name AS customer_name
       FROM credits c JOIN customers cu ON cu.id = c.customer_id
       WHERE c.id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    customerName: row.customer_name as string,
    orderId: (row.order_id as string) ?? null,
    originalCents: Number(row.original_cents),
    balanceCents: Number(row.balance_cents),
    status: row.status as Credit["status"],
    dueDate: (row.due_date as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export function getDailySummary(): DailySummary {
  const database = getDb();
  const startIso = startOfMexicoDay(0).toISOString();

  const payments = database
    .prepare(
      `SELECT p.method, p.provider, p.amount_cents
       FROM payments p JOIN orders o ON o.id = p.order_id
       WHERE p.status = 'paid' AND o.created_at >= ?`,
    )
    .all(startIso) as Array<{ method: string; provider: string; amount_cents: number }>;

  let verifiedDigitalCents = 0;
  let demoDigitalCents = 0;
  let cashCents = 0;
  const methods: Record<string, number> = {};

  for (const payment of payments) {
    const amount = Number(payment.amount_cents);
    methods[payment.method] = (methods[payment.method] ?? 0) + amount;
    if (payment.method === "cash") cashCents += amount;
    else if (payment.provider === "pey") verifiedDigitalCents += amount;
    else if (payment.provider === "demo") demoDigitalCents += amount;
  }

  const orderRow = database
    .prepare("SELECT COUNT(*) AS n FROM orders WHERE created_at >= ?")
    .get(startIso) as { n: number };

  const paidRow = database
    .prepare(
      "SELECT COUNT(*) AS n FROM orders WHERE created_at >= ? AND status IN ('paid', 'demo_paid', 'fulfilled')",
    )
    .get(startIso) as { n: number };

  const pendingRow = database
    .prepare(
      "SELECT COALESCE(SUM(MAX(total_cents - paid_cents - credit_cents, 0)), 0) AS total FROM orders WHERE created_at >= ? AND status IN ('confirmed', 'payment_pending', 'partially_paid')",
    )
    .get(startIso) as { total: number };

  const creditRow = database
    .prepare("SELECT COALESCE(SUM(balance_cents), 0) AS total FROM credits WHERE status != 'settled'")
    .get() as { total: number };

  return {
    date: mexicoDateKey(),
    verifiedDigitalCents,
    demoDigitalCents,
    cashCents,
    pendingCents: Number(pendingRow.total),
    creditCents: Number(creditRow.total),
    orderCount: Number(orderRow.n),
    paidOrderCount: Number(paidRow.n),
    methods,
  };
}

interface RealPaymentRow {
  payment_id: string;
  order_id: string;
  transaction_id: string | null;
}

function listRealPeyPayments(database: DatabaseSync): RealPaymentRow[] {
  return database
    .prepare(
      `SELECT p.id AS payment_id, p.order_id, p.transaction_id
       FROM payments p
       WHERE p.provider = 'pey' AND p.status = 'paid'`,
    )
    .all() as unknown as RealPaymentRow[];
}

/**
 * Copia consistente de SQLite antes de cualquier borrado. `VACUUM INTO`
 * incluye el WAL y deja un archivo standalone que se puede restaurar sin
 * detener el servidor.
 */
function backupDatabase(database: DatabaseSync): string {
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  let target = path.join(backupDir, `mercado-cero-${stamp}.db`);
  let attempt = 1;
  while (fs.existsSync(target)) {
    target = path.join(backupDir, `mercado-cero-${stamp}-${attempt}.db`);
    attempt += 1;
  }

  const escaped = target.replaceAll("'", "''");
  database.exec(`VACUUM INTO '${escaped}'`);
  return target;
}

/**
 * Reinicia los datos de demostración.
 *
 * - Si hay un pago real (`pey` + `paid`), se niega salvo `force`.
 * - Siempre hace backup timestamped antes de borrar.
 * - Con `force`, conserva los pedidos/pagos reales y toda la auditoría; solo
 *   limpia lo que pertenece a la demo. Nunca borra la evidencia de un pago
 *   real para “dejar limpio” el escenario.
 */
export function resetDemoData(options: { force?: boolean } = {}): DemoResetResult {
  const database = getDb();
  const realPayments = listRealPeyPayments(database);

  if (realPayments.length > 0 && !options.force) {
    throw new DemoResetBlockedError(realPayments.length);
  }

  const backupPath = backupDatabase(database);
  const realOrderIds = [...new Set(realPayments.map((payment) => payment.order_id))];

  if (realOrderIds.length === 0) {
    database.exec(`
      DELETE FROM payment_events;
      DELETE FROM tasks;
      DELETE FROM goal_contributions;
      DELETE FROM goals;
      DELETE FROM cash_closes;
      DELETE FROM payments;
      DELETE FROM order_items;
      DELETE FROM orders;
      DELETE FROM credit_payments;
      DELETE FROM credits;
      DELETE FROM customers;
      DELETE FROM audit_log;
    `);
  } else {
    const placeholders = realOrderIds.map(() => "?").join(", ");
    database.exec("BEGIN IMMEDIATE");
    try {
      database
        .prepare(`DELETE FROM payments WHERE order_id NOT IN (${placeholders})`)
        .run(...realOrderIds);
      database
        .prepare(`DELETE FROM order_items WHERE order_id NOT IN (${placeholders})`)
        .run(...realOrderIds);
      database
        .prepare(
          `DELETE FROM credit_payments
           WHERE credit_id NOT IN (
             SELECT id FROM credits WHERE order_id IN (${placeholders})
           )`,
        )
        .run(...realOrderIds);
      database
        .prepare(
          `DELETE FROM credits
           WHERE order_id IS NULL OR order_id NOT IN (${placeholders})`,
        )
        .run(...realOrderIds);
      database.exec(
        "DELETE FROM customers WHERE id NOT IN (SELECT customer_id FROM credits)",
      );
      database
        .prepare(`DELETE FROM orders WHERE id NOT IN (${placeholders})`)
        .run(...realOrderIds);

      // Los eventos del webhook y la auditoría de pagos reales se conservan.
      database.exec("DELETE FROM payment_events WHERE provider != 'pey'");
      database.exec(`
        DELETE FROM tasks;
        DELETE FROM goal_contributions;
        DELETE FROM goals;
        DELETE FROM cash_closes;
      `);
      database.exec("COMMIT");
    } catch (error) {
      try {
        database.exec("ROLLBACK");
      } catch {
        // SQLite pudo cerrar la transacción sola.
      }
      throw error;
    }
  }

  seed(database);
  seedGoal(database);
  seedDemoHistory(database);

  audit("demo.reset", "demo", "reset", {
    backup: path.basename(backupPath),
    force: Boolean(options.force),
    realPaymentCount: realPayments.length,
    preservedRealPayments: realOrderIds.length,
  });

  return {
    backup: path.basename(backupPath),
    realPaymentCount: realPayments.length,
    preservedRealPayments: realOrderIds.length,
  };
}
