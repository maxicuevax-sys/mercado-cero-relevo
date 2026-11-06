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
/** Retención local: se conservan los backups más recientes, no todos. */
const MAX_BACKUPS = 5;

let db: DatabaseSync | null = null;

export interface DemoResetRealData {
  orders: number;
  payments: number;
  credits: number;
  cashCloses: number;
  goals: number;
  tasks: number;
}

export class DemoResetBlockedError extends Error {
  readonly realDataCount: number;
  readonly realPaymentCount: number;
  readonly breakdown: DemoResetRealData;

  constructor(data: DemoResetRealData, realPaymentCount: number) {
    super(
      "Hay datos reales o un pago firmado de pey. El reinicio de demo está bloqueado; usa FORCE solo si conservas lo real.",
    );
    this.name = "DemoResetBlockedError";
    this.breakdown = data;
    this.realDataCount =
      data.orders +
      data.payments +
      data.credits +
      data.cashCloses +
      data.goals +
      data.tasks;
    this.realPaymentCount = realPaymentCount;
  }
}

export interface DemoResetResult {
  backup: string;
  realPaymentCount: number;
  preservedRealPayments: number;
  realDataCount: number;
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

  // La conexión solo se publica cuando la migración y el seed terminaron.
  // Si algo falla, se cierra y `db` sigue en null: la siguiente petición
  // vuelve a intentar el arranque completo en vez de servir una base a medias.
  const database = new DatabaseSync(dbPath);
  try {
    database.exec("PRAGMA journal_mode = WAL;");
    database.exec("PRAGMA busy_timeout = 5000;");
    database.exec("PRAGMA foreign_keys = ON;");
    migrate(database);
    seed(database);
    seedGoal(database);
    seedDemoHistory(database);
  } catch (error) {
    try {
      database.close();
    } catch {
      // La conexión pudo quedar inutilizable; conservamos el error original.
    }
    db = null;
    throw error;
  }

  db = database;
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
      request_id TEXT,
      request_hash TEXT,
      demo INTEGER NOT NULL DEFAULT 0,
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
      demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payment_events (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      event_type TEXT NOT NULL,
      idempotency_key TEXT UNIQUE NOT NULL,
      payload TEXT NOT NULL,
      payload_hash TEXT,
      signature_valid INTEGER NOT NULL,
      processed_at TEXT NOT NULL
    );

    -- El nombre es único por modo: la demo y la caja real pueden tener cada
    -- una su "Juan" sin compartir cliente ni crédito.
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      demo INTEGER NOT NULL DEFAULT 0,
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
      demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS credit_payments (
      id TEXT PRIMARY KEY,
      credit_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      method TEXT NOT NULL DEFAULT 'cash',
      provider TEXT NOT NULL DEFAULT 'cash',
      note TEXT,
      request_id TEXT,
      request_hash TEXT,
      demo INTEGER NOT NULL DEFAULT 0,
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
      demo INTEGER NOT NULL DEFAULT 0,
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
      demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS goal_contributions (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      note TEXT,
      request_id TEXT,
      request_hash TEXT,
      demo INTEGER NOT NULL DEFAULT 0,
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
      demo INTEGER NOT NULL DEFAULT 0,
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

    -- Índices de lectura del mostrador. Se crean con IF NOT EXISTS para que
    -- una base vieja migre al arrancar sin intervención manual. El orden de
    -- columnas sigue las consultas reales: primero la igualdad, luego el
    -- rango/fecha y al final la columna que evita volver a la tabla.
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id
      ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_payments_order_status_method_created
      ON payments(order_id, status, method, created_at);
    CREATE INDEX IF NOT EXISTS idx_payments_method_status_created
      ON payments(method, status, created_at);
    CREATE INDEX IF NOT EXISTS idx_payments_status_created
      ON payments(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_credit_payments_created
      ON credit_payments(created_at);
    CREATE INDEX IF NOT EXISTS idx_credit_payments_method_created
      ON credit_payments(method, created_at);
    CREATE INDEX IF NOT EXISTS idx_credits_status_created
      ON credits(status, created_at, id);
    CREATE INDEX IF NOT EXISTS idx_orders_created_status
      ON orders(created_at, status);
    CREATE INDEX IF NOT EXISTS idx_orders_status_created
      ON orders(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_created_id
      ON orders(created_at, id);
  `);

  // `customers` nació con `name UNIQUE` global. Eso impedía que un cliente
  // real "Juan" conviviera con el fixture "Juan" de la demo. La migración
  // reconstruye la tabla con `demo` y unicidad por (name, demo).
  migrateCustomers(database);

  const columns = database.prepare("PRAGMA table_info(orders)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "credit_cents")) {
    database.exec("ALTER TABLE orders ADD COLUMN credit_cents INTEGER NOT NULL DEFAULT 0;");
  }
  if (!columns.some((column) => column.name === "qr_id")) {
    database.exec("ALTER TABLE orders ADD COLUMN qr_id TEXT;");
  }
  if (!columns.some((column) => column.name === "request_id")) {
    database.exec("ALTER TABLE orders ADD COLUMN request_id TEXT;");
  }
  if (!columns.some((column) => column.name === "request_hash")) {
    database.exec("ALTER TABLE orders ADD COLUMN request_hash TEXT;");
  }
  if (!columns.some((column) => column.name === "demo")) {
    database.exec("ALTER TABLE orders ADD COLUMN demo INTEGER NOT NULL DEFAULT 0;");
  }
  const paymentColumns = database.prepare("PRAGMA table_info(payments)").all() as Array<{
    name: string;
  }>;
  if (!paymentColumns.some((column) => column.name === "demo")) {
    database.exec("ALTER TABLE payments ADD COLUMN demo INTEGER NOT NULL DEFAULT 0;");
  }
  // La llave de idempotencia es opcional: los pedidos viejos quedan NULL.
  // Si un arranque anterior quedó a medias, deduplicamos antes del índice.
  // El índice viejo era global; ahora la llave se limita al comercio para que
  // dos comercios puedan usar el mismo requestId sin chocar.
  database.exec("DROP INDEX IF EXISTS idx_orders_request_id;");
  dedupeRequestIds(database, {
    table: "orders",
    index: "idx_orders_merchant_request_id",
    keyColumns: ["merchant_id", "request_id"],
    action: "order.request_id_deduped",
    entity: "order",
  });
  database.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_merchant_request_id ON orders(merchant_id, request_id) WHERE request_id IS NOT NULL;",
  );

  const creditColumns = database.prepare("PRAGMA table_info(credits)").all() as Array<{
    name: string;
  }>;
  if (!creditColumns.some((column) => column.name === "demo")) {
    // Las filas viejas de demo se siguen detectando por sus ids `demo_seed_*`
    // y por el pedido demo; las nuevas quedan marcadas explícitamente.
    database.exec("ALTER TABLE credits ADD COLUMN demo INTEGER NOT NULL DEFAULT 0;");
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
  if (!eventColumns.some((column) => column.name === "payload_hash")) {
    // Hash del cuerpo original. Los eventos con firma inválida guardan solo
    // un prefijo acotado; el hash permite correlacionar sin retener el payload.
    database.exec("ALTER TABLE payment_events ADD COLUMN payload_hash TEXT;");
  }
  database.exec(
    "CREATE INDEX IF NOT EXISTS idx_payment_events_rejected ON payment_events(signature_valid, result, processed_at);",
  );

  const creditPaymentColumns = database
    .prepare("PRAGMA table_info(credit_payments)")
    .all() as Array<{ name: string }>;
  if (!creditPaymentColumns.some((column) => column.name === "note")) {
    database.exec("ALTER TABLE credit_payments ADD COLUMN note TEXT;");
  }
  if (!creditPaymentColumns.some((column) => column.name === "request_id")) {
    database.exec("ALTER TABLE credit_payments ADD COLUMN request_id TEXT;");
  }
  if (!creditPaymentColumns.some((column) => column.name === "request_hash")) {
    database.exec("ALTER TABLE credit_payments ADD COLUMN request_hash TEXT;");
  }
  if (!creditPaymentColumns.some((column) => column.name === "demo")) {
    database.exec(
      "ALTER TABLE credit_payments ADD COLUMN demo INTEGER NOT NULL DEFAULT 0;",
    );
  }
  if (!creditPaymentColumns.some((column) => column.name === "provider")) {
    database.exec(
      "ALTER TABLE credit_payments ADD COLUMN provider TEXT NOT NULL DEFAULT 'cash';",
    );
  }
  // Los abonos digitales viejos se registraron sin proveedor. No son pagos
  // verificados por pey: se conservan como “declarado”, no como efectivo.
  database.exec(
    "UPDATE credit_payments SET provider = 'declared' WHERE method != 'cash' AND provider = 'cash';",
  );

  // Una DB vieja pudo escribir la misma llave más de una vez antes de que
  // existiera el índice. Si no se deduplica, el arranque falla al crear el
  // índice único. Se conserva el primer abono y se anulan las llaves repetidas
  // (los montos y saldos no se tocan), dejando rastro en audit_log.
  dedupeRequestIds(database, {
    table: "credit_payments",
    index: "idx_credit_payments_request_id",
    action: "credit_payment.request_id_deduped",
    entity: "credit_payment",
  });
  // La llave es opcional: los abonos viejos y los que no traen requestId
  // conservan request_id NULL y no compiten en el índice parcial.
  database.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_payments_request_id ON credit_payments(request_id) WHERE request_id IS NOT NULL;",
  );

  const goalContributionColumns = database
    .prepare("PRAGMA table_info(goal_contributions)")
    .all() as Array<{ name: string }>;
  if (!goalContributionColumns.some((column) => column.name === "request_id")) {
    database.exec("ALTER TABLE goal_contributions ADD COLUMN request_id TEXT;");
  }
  if (!goalContributionColumns.some((column) => column.name === "request_hash")) {
    database.exec("ALTER TABLE goal_contributions ADD COLUMN request_hash TEXT;");
  }
  dedupeRequestIds(database, {
    table: "goal_contributions",
    index: "idx_goal_contributions_request_id",
    action: "goal_contribution.request_id_deduped",
    entity: "goal_contribution",
  });
  database.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_goal_contributions_request_id ON goal_contributions(request_id) WHERE request_id IS NOT NULL;",
  );

  const goalColumns = database.prepare("PRAGMA table_info(goals)").all() as Array<{
    name: string;
  }>;
  if (!goalColumns.some((column) => column.name === "demo")) {
    database.exec("ALTER TABLE goals ADD COLUMN demo INTEGER NOT NULL DEFAULT 0;");
  }
  if (!goalContributionColumns.some((column) => column.name === "demo")) {
    database.exec(
      "ALTER TABLE goal_contributions ADD COLUMN demo INTEGER NOT NULL DEFAULT 0;",
    );
  }
  const taskColumns = database.prepare("PRAGMA table_info(tasks)").all() as Array<{
    name: string;
  }>;
  if (!taskColumns.some((column) => column.name === "demo")) {
    database.exec("ALTER TABLE tasks ADD COLUMN demo INTEGER NOT NULL DEFAULT 0;");
  }

  migrateCashCloses(database);

  // Las filas viejas de la demo se reconocen por sus prefijos reservados.
  // No se marca por cliente: un crédito real puede apuntar a un cliente demo
  // (el P0 que esta migración repara) y debe seguir siendo real.
  database.exec(`
    UPDATE orders SET demo = 1
    WHERE demo = 0 AND (id LIKE 'demo\\_%' ESCAPE '\\' OR status = 'demo_paid');
    UPDATE payments SET demo = 1
    WHERE demo = 0 AND (provider = 'demo' OR transaction_id LIKE 'demo\\_%' ESCAPE '\\');
    UPDATE credit_payments SET demo = 1
    WHERE demo = 0 AND credit_id LIKE 'demo\\_%' ESCAPE '\\';
    UPDATE credits SET demo = 1
    WHERE demo = 0 AND (id LIKE 'demo\\_%' ESCAPE '\\'
      OR order_id LIKE 'demo\\_%' ESCAPE '\\');
    UPDATE cash_closes SET demo = 1
    WHERE demo = 0 AND (id LIKE 'demo\\_%' ESCAPE '\\'
      OR id LIKE 'cash\\_demo\\_%' ESCAPE '\\');
    UPDATE goals SET demo = 1
    WHERE demo = 0 AND id LIKE 'demo\\_%' ESCAPE '\\';
  `);
}

/**
 * Reconstruye `customers` si viene del esquema viejo con `name UNIQUE`.
 *
 * La unicidad global impedía crear un cliente real con el mismo nombre que
 * un fixture de demo. La copia se hace con `foreign_keys=OFF` para que
 * `credits.customer_id` siga apuntando a la tabla `customers` nueva, y se
 * verifica la integridad antes de confirmar.
 */
function migrateCustomers(database: DatabaseSync) {
  const columns = tableColumns(database, "customers");
  const hasDemo = columns.some((column) => column.name === "demo");
  if (hasDemo) {
    database.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_name_demo ON customers(name, demo);",
    );
    database.exec(
      "UPDATE customers SET demo = 1 WHERE demo = 0 AND id LIKE 'demo\\_%' ESCAPE '\\';",
    );
    return;
  }

  database.exec("PRAGMA foreign_keys = OFF;");
  try {
    database.exec("BEGIN IMMEDIATE;");
    database.exec(`
      CREATE TABLE customers_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        demo INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      INSERT INTO customers_new (id, name, phone, demo, created_at)
      SELECT id, name, phone,
             CASE WHEN id LIKE 'demo\\_%' ESCAPE '\\' THEN 1 ELSE 0 END,
             created_at
      FROM customers;
      DROP TABLE customers;
      ALTER TABLE customers_new RENAME TO customers;
      CREATE UNIQUE INDEX idx_customers_name_demo ON customers(name, demo);
    `);
    const violations = database.prepare("PRAGMA foreign_key_check").all();
    if (violations.length > 0) {
      throw new Error(
        `La migración de customers dejó ${violations.length} referencias huérfanas.`,
      );
    }
    database.exec("COMMIT");
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // SQLite pudo cerrar la transacción sola.
    }
    throw error;
  } finally {
    database.exec("PRAGMA foreign_keys = ON;");
  }
}

/**
 * Antes de crear un índice único parcial, conserva la primera fila de cada
 * llave repetida y anula la llave de las demás. Es idempotente: si el índice
 * ya existe, no hay nada que deduplicar.
 *
 * Usa un SAVEPOINT para poder ejecutarse dentro de una migración que ya abrió
 * su propia transacción (por ejemplo, `cash_closes`). Al anular solo la llave
 * nunca se borran filas ni se tocan montos.
 */
function dedupeRequestIds(
  database: DatabaseSync,
  options: {
    table: string;
    index: string;
    action: string;
    entity: string;
    keyColumns?: string[];
  },
) {
  const indexExists = database
    .prepare("SELECT 1 AS found FROM sqlite_master WHERE type = 'index' AND name = ?")
    .get(options.index) as { found: number } | undefined;
  if (indexExists) return;

  const keyColumns = options.keyColumns ?? ["request_id"];
  const keyList = keyColumns.join(", ");
  const duplicates = database
    .prepare(
      `SELECT ${keyList}, COUNT(*) AS n
       FROM ${options.table}
       WHERE request_id IS NOT NULL
       GROUP BY ${keyList}
       HAVING COUNT(*) > 1`,
    )
    .all() as Array<Record<string, string | number>>;
  if (duplicates.length === 0) return;

  database.exec("SAVEPOINT dedupe_request_ids");
  try {
    const rowsStmt = database.prepare(
      `SELECT id FROM ${options.table}
       WHERE ${keyColumns.map((column) => `${column} = ?`).join(" AND ")}
       ORDER BY created_at ASC, rowid ASC`,
    );
    const clearStmt = database.prepare(
      `UPDATE ${options.table} SET request_id = NULL WHERE id = ?`,
    );
    const auditStmt = database.prepare(
      "INSERT INTO audit_log (id, action, entity, entity_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    );

    for (const duplicate of duplicates) {
      const keyValues = Object.fromEntries(
        keyColumns.map((column) => [column, duplicate[column]]),
      );
      const rows = rowsStmt.all(
        ...keyColumns.map((column) => duplicate[column]),
      ) as Array<{ id: string }>;
      const [kept, ...cleared] = rows;
      if (!kept || cleared.length === 0) continue;
      for (const row of cleared) clearStmt.run(row.id);
      auditStmt.run(
        newId("aud"),
        options.action,
        options.entity,
        kept.id,
        JSON.stringify({
          ...keyValues,
          keptId: kept.id,
          clearedIds: cleared.map((row) => row.id),
          clearedCount: cleared.length,
        }),
        nowIso(),
      );
      console.warn(
        `[db] ${options.table}: request_id repetido ${keyValues.request_id}; conservé ${kept.id} y anulé ${cleared.length}.`,
      );
    }

    database.exec("RELEASE SAVEPOINT dedupe_request_ids");
  } catch (error) {
    try {
      database.exec("ROLLBACK TO SAVEPOINT dedupe_request_ids");
      database.exec("RELEASE SAVEPOINT dedupe_request_ids");
    } catch {
      // Si SQLite ya cerró la transacción, conservamos el error original.
    }
    throw error;
  }
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
          demo INTEGER NOT NULL DEFAULT 0,
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
      `);
      // Las llaves de corte también se deduplican antes del índice único.
      // La migración vieja inserta request_id NULL, pero una recuperación
      // interrumpida pudo haber conservado llaves repetidas.
      dedupeRequestIds(database, {
        table: "cash_closes",
        index: "idx_cash_closes_request_id",
        action: "cash_close.request_id_deduped",
        entity: "cash_close",
      });
      database.exec(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_closes_request_id ON cash_closes(request_id) WHERE request_id IS NOT NULL;",
      );
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
    addColumn("demo", "INTEGER NOT NULL DEFAULT 0");

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
    `);
    // El merge de la legacy pudo traer la misma llave dos veces, o una llave
    // que ya existía en la tabla versionada. Se conserva la primera y se anula
    // el resto antes de crear el índice único.
    dedupeRequestIds(database, {
      table: "cash_closes",
      index: "idx_cash_closes_request_id",
      action: "cash_close.request_id_deduped",
      entity: "cash_close",
    });
    database.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_closes_request_id ON cash_closes(request_id) WHERE request_id IS NOT NULL;",
    );
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

/**
 * Recupera filas de una `cash_closes_legacy` parcial en una tabla ya
 * versionada sin borrar ni pisar versiones existentes.
 *
 * - Mismo `id`, misma `(date, version)` y legacy más nueva: actualiza esa fila.
 * - Mismo `id` en otra `(date, version)` o legacy más vieja/igual: inserta la
 *   legacy como versión nueva, con id nuevo si el id ya está ocupado.
 * - `(date, version)` ocupada por otra fila: usa la siguiente versión libre.
 *
 * Cada fila mergeada queda auditada con la acción y las versiones de origen y
 * destino. Una llave `request_id` que ya pertenece a otra fila no se duplica:
 * se deja NULL y se registra en la auditoría.
 */
function copyLegacyIntoVersioned(database: DatabaseSync) {
  const legacyColumns = tableColumns(database, "cash_closes_legacy").map(
    (column) => column.name,
  );
  const has = (name: string) => legacyColumns.includes(name);
  const rows = database
    .prepare("SELECT * FROM cash_closes_legacy ORDER BY rowid ASC")
    .all() as unknown as Array<Record<string, unknown>>;

  const findById = database.prepare(
    "SELECT date, version, created_at, request_id, demo FROM cash_closes WHERE id = ?",
  );
  const findByDateVersion = database.prepare(
    "SELECT id FROM cash_closes WHERE date = ? AND version = ?",
  );
  const maxVersion = database.prepare(
    "SELECT COALESCE(MAX(version), 0) AS version FROM cash_closes WHERE date = ?",
  );
  const findRequestOwner = database.prepare(
    "SELECT id FROM cash_closes WHERE request_id = ?",
  );
  const upsert = database.prepare(
    `INSERT INTO cash_closes
      (id, date, version, opening_cents, cash_sales_cents, cash_credit_cents,
       expenses_cents, withdrawals_cents, expected_cents, counted_cents,
       difference_cents, base_next_cents, withdrawal_next_cents,
       snapshot_cash_cents, snapshot_credit_cents, snapshot_pending_digital_cents,
       snapshot_known, reason, request_id, demo, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       date = excluded.date,
       version = excluded.version,
       opening_cents = excluded.opening_cents,
       cash_sales_cents = excluded.cash_sales_cents,
       cash_credit_cents = excluded.cash_credit_cents,
       expenses_cents = excluded.expenses_cents,
       withdrawals_cents = excluded.withdrawals_cents,
       expected_cents = excluded.expected_cents,
       counted_cents = excluded.counted_cents,
       difference_cents = excluded.difference_cents,
       base_next_cents = excluded.base_next_cents,
       withdrawal_next_cents = excluded.withdrawal_next_cents,
       snapshot_cash_cents = excluded.snapshot_cash_cents,
       snapshot_credit_cents = excluded.snapshot_credit_cents,
       snapshot_pending_digital_cents = excluded.snapshot_pending_digital_cents,
       snapshot_known = excluded.snapshot_known,
       reason = excluded.reason,
       request_id = excluded.request_id,
       demo = excluded.demo,
       created_at = excluded.created_at`,
  );
  const auditStmt = database.prepare(
    "INSERT INTO audit_log (id, action, entity, entity_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  );

  const isNewer = (candidate: string, current: string): boolean => {
    const candidateTime = Date.parse(candidate);
    const currentTime = Date.parse(current);
    if (
      Number.isFinite(candidateTime) &&
      Number.isFinite(currentTime) &&
      candidateTime !== currentTime
    ) {
      return candidateTime > currentTime;
    }
    return candidate > current;
  };

  const nextFreeVersion = (targetDate: string, preferred: number): number => {
    let candidate = Math.max(1, Math.trunc(preferred));
    for (let guard = 0; guard < 10_000; guard += 1) {
      const occupant = findByDateVersion.get(targetDate, candidate) as
        | { id: string }
        | undefined;
      if (!occupant) return candidate;
      const max = maxVersion.get(targetDate) as { version: number };
      candidate = Math.max(candidate + 1, Number(max.version) + 1);
    }
    throw new Error(
      `No pude encontrar una versión libre para cash_closes_legacy en ${targetDate}.`,
    );
  };

  for (const row of rows) {
    const id = row.id == null ? "" : String(row.id);
    const date = row.date == null ? "" : String(row.date);
    if (!id || !date) {
      throw new Error("cash_closes_legacy tiene una fila sin id o sin fecha.");
    }

    const num = (name: string, fallback = 0) => {
      if (!has(name)) return fallback;
      const value = Number(row[name] ?? fallback);
      return Number.isFinite(value) ? value : fallback;
    };
    const text = (name: string) => {
      if (!has(name) || row[name] == null) return null;
      return String(row[name]);
    };

    const originalVersion = Math.max(1, Math.trunc(num("version", 1)));
    const createdAt = text("created_at") ?? nowIso();
    const existingById = findById.get(id) as
      | {
          date: string;
          version: number;
          created_at: string;
          request_id: string | null;
          demo: number;
        }
      | undefined;

    let targetId = id;
    let version = originalVersion;
    let action: "updated" | "version_bumped" | "id_reassigned" | "inserted" =
      "inserted";
    let existingRequestId: string | null = null;
    let existingDemo = 0;

    if (existingById) {
      existingRequestId = existingById.request_id ?? null;
      existingDemo = Number(existingById.demo ?? 0);
      const sameSlot =
        existingById.date === date &&
        Number(existingById.version) === originalVersion;
      if (sameSlot && isNewer(createdAt, existingById.created_at)) {
        // La legacy es la misma fila y es más nueva: se actualiza sin moverla.
        action = "updated";
      } else {
        // El id ya pertenece a otra versión, o la legacy es más vieja. Nunca
        // se pisa: se conserva lo existente y la legacy entra como versión
        // nueva con un id distinto.
        action = sameSlot ? "version_bumped" : "id_reassigned";
        targetId = newId("cash_legacy");
        version = nextFreeVersion(date, originalVersion);
      }
    } else {
      const occupant = findByDateVersion.get(date, originalVersion) as
        | { id: string }
        | undefined;
      if (occupant) {
        action = "version_bumped";
        version = nextFreeVersion(date, originalVersion);
      }
    }

    const stillOccupied = findByDateVersion.get(date, version) as
      | { id: string }
      | undefined;
    if (stillOccupied && stillOccupied.id !== targetId) {
      throw new Error(
        `No pude acomodar cash_closes_legacy ${id}: (${date}, ${version}) sigue ocupada.`,
      );
    }

    let requestId = text("request_id");
    // Al actualizar una fila, una legacy de esquema viejo sin request_id no
    // debe borrar la llave que ya estaba guardada.
    if (!requestId && action === "updated") requestId = existingRequestId;
    let demo = has("demo") ? num("demo") : 0;
    if (!has("demo") && action === "updated") demo = existingDemo;
    let requestIdDropped = false;
    if (requestId) {
      const owner = findRequestOwner.get(requestId) as
        | { id: string }
        | undefined;
      if (owner && owner.id !== targetId) {
        requestId = null;
        requestIdDropped = true;
      }
    }

    upsert.run(
      targetId,
      date,
      version,
      num("opening_cents"),
      num("cash_sales_cents"),
      num("cash_credit_cents"),
      num("expenses_cents"),
      num("withdrawals_cents"),
      num("expected_cents"),
      num("counted_cents"),
      num("difference_cents"),
      num("base_next_cents"),
      num("withdrawal_next_cents"),
      num("snapshot_cash_cents", num("cash_sales_cents") + num("cash_credit_cents")),
      num("snapshot_credit_cents"),
      num("snapshot_pending_digital_cents"),
      num("snapshot_known"),
      text("reason"),
      requestId,
      demo,
      createdAt,
    );

    auditStmt.run(
      newId("aud"),
      "cash_close.legacy_merged",
      "cash_close",
      targetId,
      JSON.stringify({
        action,
        legacyId: id,
        idChanged: targetId !== id,
        date,
        fromVersion: originalVersion,
        toVersion: version,
        existing: existingById
          ? {
              date: existingById.date,
              version: Number(existingById.version),
              createdAt: existingById.created_at,
            }
          : null,
        requestIdDropped,
      }),
      nowIso(),
    );
  }

  database.exec("DROP TABLE cash_closes_legacy;");
}

/**
 * Fixtures de demo. Nunca se siembran en modo real: una caja que arranca en
 * producción debe tener 0 pedidos, 0 efectivo, 0 fiado y 0 metas.
 * Los ids y el proveedor quedan marcados para que los reportes reales los
 * puedan excluir incluso si alguien cambia DEMO_MODE sobre una base vieja.
 */
function seed(database: DatabaseSync) {
  if (!isDemoMode()) return;
  const count = database
    .prepare(
      "SELECT COUNT(*) AS n FROM customers WHERE demo = 1 AND lower(name) = 'juan'",
    )
    .get() as { n: number };
  if (count.n > 0) return;

  const createdAt = nowIso();
  const juanId = newId("demo_seed_cus");
  database
    .prepare(
      "INSERT INTO customers (id, name, phone, demo, created_at) VALUES (?, ?, ?, 1, ?)",
    )
    .run(juanId, "Juan", null, createdAt);

  const creditId = newId("demo_seed_cred");
  database
    .prepare(
      "INSERT INTO credits (id, customer_id, order_id, original_cents, balance_cents, status, due_date, demo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)",
    )
    .run(creditId, juanId, null, 5000, 5000, "open", null, createdAt);

  const orderId = newId("demo_seed_ord");
  database
    .prepare(
      "INSERT INTO orders (id, merchant_id, status, total_cents, paid_cents, payment_method, customer_name, credit_id, demo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
    )
    .run(orderId, MERCHANT.id, "demo_paid", 7000, 7000, "cash", null, null, createdAt, createdAt);
  database
    .prepare(
      "INSERT INTO order_items (id, order_id, description, quantity, unit_price_cents, total_cents) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(newId("demo_seed_itm"), orderId, "Quesadilla", 2, 3500, 7000);
  database
    .prepare(
      "INSERT INTO payments (id, order_id, provider, method, amount_cents, status, transaction_id, demo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)",
    )
    .run(
      newId("demo_seed_pay"),
      orderId,
      "demo",
      "cash",
      7000,
      "paid",
      `demo_seed_txn_${orderId}`,
      createdAt,
    );
}

function seedGoal(database: DatabaseSync) {
  if (!isDemoMode()) return;
  const count = database
    .prepare("SELECT COUNT(*) AS n FROM goals WHERE demo = 1")
    .get() as { n: number };
  if (count.n > 0) return;

  const targetCents = 180000;
  const savedCents = 30000;
  const deadline = new Date(Date.now() + 56 * 24 * 60 * 60 * 1000).toISOString();
  database
    .prepare(
      "INSERT INTO goals (id, title, target_cents, saved_cents, deadline, status, demo, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
    )
    .run(
      newId("demo_seed_goal"),
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
         (id, merchant_id, status, total_cents, paid_cents, payment_method, demo, created_at, updated_at)
         VALUES (?, ?, 'demo_paid', ?, ?, ?, 1, ?, ?)`,
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
         (id, order_id, provider, method, amount_cents, status, transaction_id, demo, created_at)
         VALUES (?, ?, 'demo', ?, ?, 'paid', ?, 1, ?)`,
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

  // A las 00:00–00:10, "hace 10 minutos" cae en el día anterior y el fixture
  // deja de contar como pendiente de hoy. Se ancla al menos a las 00:01 de
  // México para que la demo y el preflight no dependan de la hora de arranque.
  const pendingCreatedAt = new Date(
    Math.max(
      Date.now() - 10 * 60 * 1000,
      startOfMexicoDay(0).getTime() + 60 * 1000,
    ),
  );
  const pendingId = `demo_hist_pending_${newId("ord")}`;
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  database
    .prepare(
      `INSERT INTO orders
       (id, merchant_id, status, total_cents, paid_cents, payment_method,
        payment_link_id, payment_url, demo, created_at, updated_at)
       VALUES (?, ?, 'payment_pending', 12000, 0, NULL, ?, ?, 1, ?, ?)`,
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
          snapshot_credit_cents, snapshot_pending_digital_cents, reason, demo, created_at)
         VALUES (?, ?, 1, 50000, 0, 0, 0, 0, 50000, 50000, 0, 50000, 0, 0, 0, 0, NULL, 1, ?)`,
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

/**
 * Hidrata una página de pedidos con 3 consultas fijas, no 3 por pedido.
 * SQLite no acepta un `IN` arbitrariamente grande: se parte en lotes.
 */
const ORDER_HYDRATION_CHUNK = 400;

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

function loadOrderItems(
  database: DatabaseSync,
  ids: string[],
): Map<string, OrderItem[]> {
  const byOrder = new Map<string, OrderItem[]>(ids.map((id) => [id, []]));
  for (const chunk of chunks(ids, ORDER_HYDRATION_CHUNK)) {
    const rows = database
      .prepare(
        `SELECT * FROM order_items
         WHERE order_id IN (${placeholders(chunk.length)})
         ORDER BY rowid ASC`,
      )
      .all(...chunk) as Record<string, unknown>[];
    for (const item of rows) {
      const orderId = item.order_id as string;
      const list = byOrder.get(orderId);
      if (!list) continue;
      list.push({
        id: item.id as string,
        description: item.description as string,
        quantity: Number(item.quantity),
        unitPriceCents: Number(item.unit_price_cents),
        totalCents: Number(item.total_cents),
      });
    }
  }
  return byOrder;
}

function loadDigitalTotals(
  database: DatabaseSync,
  ids: string[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const chunk of chunks(ids, ORDER_HYDRATION_CHUNK)) {
    const rows = database
      .prepare(
        `SELECT order_id, COALESCE(SUM(amount_cents), 0) AS total
         FROM payments
         WHERE order_id IN (${placeholders(chunk.length)})
           AND status = 'paid' AND method != 'cash'
         GROUP BY order_id`,
      )
      .all(...chunk) as Array<{ order_id: string; total: number }>;
    for (const row of rows) totals.set(row.order_id, Number(row.total));
  }
  return totals;
}

function loadLastPaymentProviders(
  database: DatabaseSync,
  ids: string[],
): Map<string, { provider: string; demo: boolean }> {
  const providers = new Map<string, { provider: string; demo: boolean }>();
  for (const chunk of chunks(ids, ORDER_HYDRATION_CHUNK)) {
    // Misma prioridad que la consulta por pedido: primero digital, luego el
    // pago más reciente. La ventana se evalúa una sola vez por lote.
    const rows = database
      .prepare(
        `SELECT order_id, provider, method, demo FROM (
           SELECT order_id, provider, method, demo,
                  ROW_NUMBER() OVER (
                    PARTITION BY order_id
                    ORDER BY CASE WHEN method != 'cash' THEN 0 ELSE 1 END,
                             created_at DESC
                  ) AS rn
           FROM payments
           WHERE order_id IN (${placeholders(chunk.length)}) AND status = 'paid'
         ) WHERE rn = 1`,
      )
      .all(...chunk) as Array<{
      order_id: string;
      provider: string;
      method: string;
      demo: number;
    }>;
    for (const row of rows) {
      providers.set(row.order_id, {
        provider: row.provider,
        // El efectivo demo conserva su etiqueta "Efectivo recibido" (known de
        // UX); el flag demo es para el pago digital simulado (pey + demo=1).
        demo: Number(row.demo ?? 0) === 1,
      });
    }
  }
  return providers;
}

function mapOrders(
  rows: Record<string, unknown>[],
  options: { includeQrImage?: boolean } = {},
): Order[] {
  if (rows.length === 0) return [];
  const includeQrImage = options.includeQrImage !== false;
  const database = getDb();
  const ids = rows.map((row) => row.id as string);
  const itemsByOrder = loadOrderItems(database, ids);
  const digitalByOrder = loadDigitalTotals(database, ids);
  const providerByOrder = loadLastPaymentProviders(database, ids);

  return rows.map((row) => {
    const id = row.id as string;
    return {
      id,
      merchantId: row.merchant_id as string,
      status: row.status as Order["status"],
      totalCents: Number(row.total_cents),
      paidCents: Number(row.paid_cents),
      digitalPaidCents: digitalByOrder.get(id) ?? 0,
      paymentMethod: (row.payment_method as Order["paymentMethod"]) ?? null,
      lastPaymentProvider: providerByOrder.get(id)?.provider ?? null,
      lastPaymentDemo: providerByOrder.get(id)?.demo ?? false,
      customerName: (row.customer_name as string) ?? null,
      creditId: (row.credit_id as string) ?? null,
      creditCents: Number(row.credit_cents ?? 0),
      paymentLinkId: (row.payment_link_id as string) ?? null,
      paymentUrl: (row.payment_url as string) ?? null,
      qrId: (row.qr_id as string) ?? null,
      qrString: (row.qr_string as string) ?? null,
      // Las listas no cargan el PNG base64: la UI ya puede dibujar el QR desde
      // `qrString` cuando `qrImage` es null. El detalle por id sí lo conserva.
      qrImage: includeQrImage ? ((row.qr_image as string) ?? null) : null,
      numRef: (row.num_ref as string) ?? null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      items: itemsByOrder.get(id) ?? [],
    };
  });
}

function mapOrder(row: Record<string, unknown>): Order {
  return mapOrders([row])[0];
}

export function listOrders(limit = 30, offset = 0): Order[] {
  const database = getDb();
  const demoFilter = isDemoMode()
    ? ""
    : "WHERE demo = 0 AND id NOT LIKE 'demo_%' AND status != 'demo_paid'";
  const safeLimit = Math.max(1, Math.floor(limit));
  const safeOffset = Math.max(0, Math.floor(offset));
  const rows = database
    .prepare(
      `SELECT * FROM orders ${demoFilter}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(safeLimit, safeOffset) as Record<string, unknown>[];
  return mapOrders(rows, { includeQrImage: false });
}

export function countOrders(): number {
  const database = getDb();
  const demoFilter = isDemoMode()
    ? ""
    : "WHERE demo = 0 AND id NOT LIKE 'demo_%' AND status != 'demo_paid'";
  const row = database
    .prepare(`SELECT COUNT(*) AS n FROM orders ${demoFilter}`)
    .get() as { n: number };
  return Number(row.n);
}

/**
 * Cobros pendientes de cualquier fecha. No usa el resumen diario, que solo
 * mira pedidos creados hoy. La franja de P0-E lista estos pedidos.
 */
export function listPendingOrders(limit = 50, offset = 0): Order[] {
  const database = getDb();
  const safeLimit = Math.max(1, Math.floor(limit));
  const safeOffset = Math.max(0, Math.floor(offset));
  const rows = database
    .prepare(
      `SELECT * FROM orders
       WHERE status IN ('confirmed', 'payment_pending', 'partially_paid')
         AND MAX(total_cents - paid_cents - credit_cents, 0) > 0
         ${isDemoMode() ? "" : "AND demo = 0 AND id NOT LIKE 'demo_%' AND status != 'demo_paid'"}
       ORDER BY created_at ASC, id ASC
       LIMIT ? OFFSET ?`,
    )
    .all(safeLimit, safeOffset) as Record<string, unknown>[];
  return mapOrders(rows, { includeQrImage: false });
}

export function countPendingOrders(): number {
  const database = getDb();
  const row = database
    .prepare(
      `SELECT COUNT(*) AS n FROM orders
       WHERE status IN ('confirmed', 'payment_pending', 'partially_paid')
         AND MAX(total_cents - paid_cents - credit_cents, 0) > 0
         ${isDemoMode() ? "" : "AND demo = 0 AND id NOT LIKE 'demo_%' AND status != 'demo_paid'"}`,
    )
    .get() as { n: number };
  return Number(row.n);
}

/**
 * Saldo de todos los cobros pendientes, no solo de la página visible. La
 * franja de la caja lo usa para no mostrar un total menor al del servidor.
 */
export function sumPendingOrderBalances(): number {
  const database = getDb();
  const row = database
    .prepare(
      `SELECT COALESCE(SUM(MAX(total_cents - paid_cents - credit_cents, 0)), 0) AS total
       FROM orders
       WHERE status IN ('confirmed', 'payment_pending', 'partially_paid')
         AND MAX(total_cents - paid_cents - credit_cents, 0) > 0
         ${isDemoMode() ? "" : "AND demo = 0 AND id NOT LIKE 'demo_%' AND status != 'demo_paid'"}`,
    )
    .get() as { total: number };
  return Number(row.total);
}

export function getOrder(id: string): Order | null {
  const database = getDb();
  const row = database.prepare("SELECT * FROM orders WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  if (!isDemoMode() && (Number(row.demo) === 1 || id.startsWith("demo_"))) {
    return null;
  }
  return mapOrder(row);
}

/**
 * Clausura SQL de pedidos visibles para el modo actual. En real excluye los
 * pedidos demo por marca, id y estado; en demo no filtra (la base demo puede
 * contener filas reales de una sesión anterior y la caja las muestra).
 */
function visibleOrderClause(alias = ""): string {
  if (isDemoMode()) return "";
  const prefix = alias ? `${alias}.` : "";
  return ` AND ${prefix}demo = 0 AND ${prefix}id NOT LIKE 'demo_%' AND ${prefix}status != 'demo_paid'`;
}

export function getOrderByRequestId(
  requestId: string,
  merchantId: string = MERCHANT.id,
): Order | null {
  const database = getDb();
  const row = database
    .prepare(
      `SELECT * FROM orders WHERE request_id = ? AND merchant_id = ?${visibleOrderClause()}
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(requestId, merchantId) as Record<string, unknown> | undefined;
  return row ? mapOrder(row) : null;
}

/**
 * Devuelve el pedido y el hash canónico guardado con su `requestId`. El hash
 * permite distinguir un reintento idéntico de una llave reutilizada con otro
 * payload. Un pedido viejo puede tener `request_hash` NULL.
 */
export function getOrderRequestMatch(
  requestId: string,
  merchantId: string = MERCHANT.id,
): { order: Order; requestHash: string | null } | null {
  const database = getDb();
  const row = database
    .prepare(
      `SELECT * FROM orders WHERE request_id = ? AND merchant_id = ?${visibleOrderClause()}
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(requestId, merchantId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    order: mapOrder(row),
    requestHash: (row.request_hash as string) ?? null,
  };
}

export function getOrderByPaymentLink(paymentLinkId: string): Order | null {
  const database = getDb();
  const row = database
    .prepare(
      `SELECT * FROM orders WHERE payment_link_id = ?${visibleOrderClause()}
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(paymentLinkId) as Record<string, unknown> | undefined;
  return row ? mapOrder(row) : null;
}

export function getOrderByNumRef(numRef: string): Order | null {
  const database = getDb();
  const row = database
    .prepare(
      `SELECT * FROM orders WHERE num_ref = ?${visibleOrderClause()}
       ORDER BY created_at DESC LIMIT 1`,
    )
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
    demo: Number(row.demo ?? 0) === 1,
    createdAt: row.created_at as string,
  }));
}

export function listCustomers(): Customer[] {
  const database = getDb();
  const demoFilter = isDemoMode() ? "" : "WHERE demo = 0";
  const rows = database
    .prepare(`SELECT * FROM customers ${demoFilter} ORDER BY name ASC`)
    .all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    phone: (row.phone as string) ?? null,
    demo: Number(row.demo ?? 0) === 1,
    createdAt: row.created_at as string,
  }));
}

function mapCustomer(row: Record<string, unknown>): Customer {
  return {
    id: row.id as string,
    name: row.name as string,
    phone: (row.phone as string) ?? null,
    demo: Number(row.demo ?? 0) === 1,
    createdAt: row.created_at as string,
  };
}

export function findOrCreateCustomer(name: string): Customer {
  const database = getDb();
  const normalized = name.trim();
  const demo = isDemoMode() ? 1 : 0;
  // En real nunca se reutiliza un cliente de demo: comparten nombre pero no
  // identidad ni historial de fiado. La unicidad es (name, demo).
  const existing = database
    .prepare(
      "SELECT * FROM customers WHERE lower(name) = lower(?) AND demo = ?",
    )
    .get(normalized, demo) as Record<string, unknown> | undefined;
  if (existing) return mapCustomer(existing);

  const customer: Customer = {
    id: newId("cus"),
    name: normalized,
    phone: null,
    demo: demo === 1,
    createdAt: nowIso(),
  };
  // `OR IGNORE` cubre la carrera de dos ventas simultáneas con el mismo
  // nombre; después se relee la fila que ganó.
  database
    .prepare(
      "INSERT OR IGNORE INTO customers (id, name, phone, demo, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(customer.id, customer.name, customer.phone, demo, customer.createdAt);

  const stored = database
    .prepare(
      "SELECT * FROM customers WHERE lower(name) = lower(?) AND demo = ?",
    )
    .get(normalized, demo) as Record<string, unknown> | undefined;
  if (!stored) {
    throw new Error("No pude leer el cliente recién creado.");
  }
  return mapCustomer(stored);
}

/**
 * Sin límite se conserva el contrato histórico (todo el fiado). Las rutas
 * pasan un límite acotado para no serializar cientos de filas por petición.
 */
export function listCredits(limit?: number, offset = 0): Credit[] {
  const database = getDb();
  const safeOffset = Math.max(0, Math.floor(offset));
  const safeLimit =
    limit === undefined ? null : Math.max(1, Math.floor(limit));
  // La separación demo/real se decide por la marca del crédito, no por el
  // cliente ni por el pedido: un crédito real puede apuntar a un cliente demo
  // (base demo reutilizada en real) y debe seguir siendo visible y pagable.
  const demoFilter = isDemoMode() ? "" : "WHERE c.demo = 0";
  const rows = database
    .prepare(
      `SELECT c.*, cu.name AS customer_name
       FROM credits c INDEXED BY idx_credits_status_created
       JOIN customers cu ON cu.id = c.customer_id
       ${demoFilter}
       ORDER BY c.status ASC, c.created_at DESC, c.id DESC
       ${safeLimit === null ? "" : "LIMIT ? OFFSET ?"}`,
    )
    .all(
      ...(safeLimit === null ? [] : [safeLimit, safeOffset]),
    ) as Record<string, unknown>[];
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

export function countCredits(): number {
  const database = getDb();
  const demoFilter = isDemoMode() ? "" : "WHERE c.demo = 0";
  const row = database
    .prepare(
      `SELECT COUNT(*) AS n
       FROM credits c JOIN customers cu ON cu.id = c.customer_id
       ${demoFilter}`,
    )
    .get() as { n: number };
  return Number(row.n);
}

export interface OpenCreditTotals {
  count: number;
  customers: number;
  balanceCents: number;
}

/**
 * Totales reales de fiado abierto, sobre toda la base y no sobre la página
 * visible. La libreta usa estos valores para que el saldo mostrado coincida
 * con el servidor aunque la lista esté paginada.
 */
export function getOpenCreditTotals(): OpenCreditTotals {
  const database = getDb();
  const demoFilter = isDemoMode() ? "" : "WHERE c.demo = 0";
  const row = database
    .prepare(
      `SELECT
         COUNT(*) AS count,
         COUNT(DISTINCT c.customer_id) AS customers,
         COALESCE(SUM(c.balance_cents), 0) AS balance
       FROM credits c JOIN customers cu ON cu.id = c.customer_id
       ${demoFilter}
       ${demoFilter ? "AND" : "WHERE"} c.status != 'settled' AND c.balance_cents > 0`,
    )
    .get() as { count: number; customers: number; balance: number };
  return {
    count: Number(row.count),
    customers: Number(row.customers),
    balanceCents: Number(row.balance),
  };
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
  // Solo la marca del crédito decide si es demo. El cliente puede ser demo
  // sin volver demo al crédito (P0 de base demo reutilizada en real).
  if (!isDemoMode() && Number(row.demo) === 1) {
    return null;
  }
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

/**
 * Resumen del día con dos relojes distintos:
 * - ventas y pedidos se atribuyen por `orders.created_at`;
 * - dinero cobrado (pagos, abonos y demo) se atribuye por la fecha del
 *   movimiento, no por la fecha del pedido.
 *
 * `provider = 'demo'` nunca entra en los buckets reales. Los abonos digitales
 * de fiado son “declarados”: no los verifica pey y se muestran aparte.
 */
export function getDailySummary(): DailySummary {
  const database = getDb();
  const startIso = startOfMexicoDay(0).toISOString();
  const endIso = startOfMexicoDay(-1).toISOString();
  const includeDemo = isDemoMode();
  const demoOrderFilter = includeDemo
    ? ""
    : "AND o.demo = 0 AND o.status != 'demo_paid' AND o.id NOT LIKE 'demo_%'";

  const payments = database
    .prepare(
      `SELECT p.method, p.provider, p.amount_cents, p.demo
       FROM payments p
       WHERE p.status = 'paid' AND p.created_at >= ? AND p.created_at < ?`,
    )
    .all(startIso, endIso) as Array<{
    method: string;
    provider: string;
    amount_cents: number;
    demo: number;
  }>;

  const creditPayments = database
    .prepare(
      `SELECT cp.method, cp.provider, cp.amount_cents, cp.demo
       FROM credit_payments cp
       WHERE cp.created_at >= ? AND cp.created_at < ?`,
    )
    .all(startIso, endIso) as Array<{
    method: string;
    provider: string;
    amount_cents: number;
    demo: number;
  }>;

  let verifiedDigitalCents = 0;
  let declaredDigitalCents = 0;
  let demoDigitalCents = 0;
  let demoCashCents = 0;
  let cashCents = 0;
  const methods: Record<string, number> = {};

  for (const payment of payments) {
    const amount = Number(payment.amount_cents);
    const method = payment.method;
    if (
      payment.provider === "demo" ||
      Number(payment.demo) === 1
    ) {
      if (method === "cash") demoCashCents += amount;
      else demoDigitalCents += amount;
      continue;
    }
    methods[method] = (methods[method] ?? 0) + amount;
    if (method === "cash") cashCents += amount;
    else if (payment.provider === "pey") verifiedDigitalCents += amount;
  }

  for (const payment of creditPayments) {
    const amount = Number(payment.amount_cents);
    // Un abono demo nunca es cobrado confirmado, ni siquiera en modo demo.
    // El subtítulo de la UI dice "demo no cuenta"; el agregado debe cumplirlo.
    if (payment.provider === "demo" || Number(payment.demo) === 1) {
      if (payment.method === "cash") demoCashCents += amount;
      else demoDigitalCents += amount;
      continue;
    }
    methods[payment.method] = (methods[payment.method] ?? 0) + amount;
    // Un abono digital de fiado no pasó por pey: se declara, no se verifica.
    if (payment.method === "cash") cashCents += amount;
    else declaredDigitalCents += amount;
  }

  // Un solo recorrido del rango del día alimenta pedidos, pagados y
  // pendiente. Antes eran tres consultas que volvían a escanear lo mismo.
  const orderRow = database
    .prepare(
      `SELECT
         COUNT(*) AS n,
         COALESCE(SUM(o.total_cents), 0) AS sales,
         COALESCE(SUM(
           CASE
             WHEN o.status IN ('paid', 'demo_paid')
               OR (o.status = 'fulfilled' AND o.credit_cents = 0)
             THEN 1 ELSE 0
           END
         ), 0) AS paid,
         COALESCE(SUM(
           CASE
             WHEN o.status IN ('confirmed', 'payment_pending', 'partially_paid')
             THEN MAX(o.total_cents - o.paid_cents - o.credit_cents, 0)
             ELSE 0
           END
         ), 0) AS pending
       FROM orders o
       WHERE o.created_at >= ? AND o.created_at < ? ${demoOrderFilter}`,
    )
    .get(startIso, endIso) as {
    n: number;
    sales: number;
    paid: number;
    pending: number;
  };

  const creditRow = database
    .prepare(
      `SELECT
         COALESCE(SUM(balance_cents), 0) AS total,
         COALESCE(SUM(
           CASE
             WHEN id LIKE 'demo_seed_%' OR order_id LIKE 'demo_%' OR demo = 1 THEN balance_cents
             ELSE 0
           END
         ), 0) AS demo_total
       FROM credits
       WHERE status != 'settled'`,
    )
    .get() as { total: number; demo_total: number };

  const demoCreditCents = Number(creditRow.demo_total);
  const realCreditCents = Number(creditRow.total) - demoCreditCents;

  return {
    date: mexicoDateKey(),
    salesCents: Number(orderRow.sales),
    verifiedDigitalCents,
    declaredDigitalCents,
    demoDigitalCents,
    demoCashCents,
    cashCents,
    pendingCents: Number(orderRow.pending),
    creditCents: includeDemo ? Number(creditRow.total) : realCreditCents,
    demoCreditCents,
    orderCount: Number(orderRow.n),
    paidOrderCount: Number(orderRow.paid),
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

function pruneBackups(keep = MAX_BACKUPS) {
  let names: string[];
  try {
    names = fs.readdirSync(/*turbopackIgnore: true*/ backupDir);
  } catch {
    return;
  }

  const backups = names
    .filter((name) => /^mercado-cero-.*\.db$/.test(name))
    .map((name) => {
      const fullPath = path.join(/*turbopackIgnore: true*/ backupDir, name);
      let mtimeMs = 0;
      try {
        mtimeMs = fs.statSync(/*turbopackIgnore: true*/ fullPath).mtimeMs;
      } catch {
        // Si el archivo desapareció, el nombre descendente decide el orden.
      }
      return { name, fullPath, mtimeMs };
    })
    // El nombre ISO ordena igual que la fecha; se usa como desempate.
    .sort((a, b) => b.mtimeMs - a.mtimeMs || b.name.localeCompare(a.name));

  for (const backup of backups.slice(keep)) {
    try {
      fs.unlinkSync(backup.fullPath);
    } catch (error) {
      console.error(`[db] no se pudo borrar el backup viejo ${backup.name}`, error);
    }
  }
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
  pruneBackups();
  return target;
}

function countRealData(database: DatabaseSync): DemoResetRealData {
  const row = database
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM orders WHERE demo = 0) AS orders,
         (SELECT COUNT(*) FROM payments WHERE demo = 0) AS payments,
         (SELECT COUNT(*) FROM credits WHERE demo = 0) AS credits,
         (SELECT COUNT(*) FROM cash_closes WHERE demo = 0) AS cashCloses,
         (SELECT COUNT(*) FROM goals WHERE demo = 0) AS goals,
         (SELECT COUNT(*) FROM tasks WHERE demo = 0) AS tasks`,
    )
    .get() as Record<string, number>;
  return {
    orders: Number(row.orders),
    payments: Number(row.payments),
    credits: Number(row.credits),
    cashCloses: Number(row.cashCloses),
    goals: Number(row.goals),
    tasks: Number(row.tasks),
  };
}

/**
 * Reinicia los datos de demostración.
 *
 * - Si hay cualquier dato real (`demo=0`) en pedidos, pagos, fiado, cortes,
 *   metas o pendientes, se niega salvo `force`; el código HTTP es
 *   `real_data_present`.
 * - Un pago firmado de pey (`provider='pey' AND status='paid'`) bloquea el
 *   reset aunque su fila esté marcada `demo=1`: el evento firmado es la
 *   evidencia y no se borra en silencio.
 * - Siempre hace backup timestamped antes de borrar.
 * - Con `force` solo se borran filas demo. Nunca se borra un pedido, pago,
 *   crédito, corte, meta o pendiente real para “dejar limpio” el escenario.
 *   Los pagos firmados de pey y sus pedidos se conservan incluso en force.
 */
export function resetDemoData(options: { force?: boolean } = {}): DemoResetResult {
  const database = getDb();
  const realData = countRealData(database);
  const realDataCount =
    realData.orders +
    realData.payments +
    realData.credits +
    realData.cashCloses +
    realData.goals +
    realData.tasks;
  const realPayments = listRealPeyPayments(database);

  if ((realDataCount > 0 || realPayments.length > 0) && !options.force) {
    throw new DemoResetBlockedError(realData, realPayments.length);
  }

  const backupPath = backupDatabase(database);

  database.exec("BEGIN IMMEDIATE");
  try {
    // El orden respeta las llaves foráneas: primero hijos demo, luego padres
    // demo que ya no tengan hijos reales. Las filas reales no se tocan. Un
    // pago pey confirmado tampoco se borra si quedó marcado demo: su pedido
    // sobrevive por la llave foránea y se reporta como preservado.
    database.exec(`
      DELETE FROM goal_contributions WHERE demo = 1;
      DELETE FROM goals
      WHERE demo = 1
        AND id NOT IN (SELECT goal_id FROM goal_contributions);
      DELETE FROM tasks WHERE demo = 1;
      DELETE FROM cash_closes WHERE demo = 1;
      DELETE FROM payments
      WHERE demo = 1
        AND NOT (provider = 'pey' AND status = 'paid');
      DELETE FROM credit_payments WHERE demo = 1;
      DELETE FROM credits
      WHERE demo = 1
        AND id NOT IN (SELECT credit_id FROM credit_payments);
      DELETE FROM orders
      WHERE demo = 1
        AND id NOT IN (SELECT order_id FROM payments)
        AND id NOT IN (SELECT order_id FROM credits WHERE order_id IS NOT NULL);
      DELETE FROM customers
      WHERE demo = 1
        AND id NOT IN (SELECT customer_id FROM credits);
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

  // Se cuenta después del borrado: el resultado debe describir la base que
  // queda, no la intención previa.
  const preservedPayments = listRealPeyPayments(database);
  const preservedRealPayments = new Set(
    preservedPayments.map((payment) => payment.order_id),
  ).size;

  seed(database);
  seedGoal(database);
  seedDemoHistory(database);

  audit("demo.reset", "demo", "reset", {
    backup: path.basename(backupPath),
    force: Boolean(options.force),
    realDataCount,
    realPaymentCount: preservedPayments.length,
    preservedRealPayments,
    breakdown: realData,
  });

  return {
    backup: path.basename(backupPath),
    realPaymentCount: preservedPayments.length,
    preservedRealPayments,
    realDataCount,
  };
}
