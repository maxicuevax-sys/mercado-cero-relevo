#!/usr/bin/env node
/**
 * Contrato P0 · datos: idempotencia, transacciones, enlaces y migraciones.
 *
 * Levanta un `next start` aislado en :3123 con una DB temporal (nunca toca
 * :3000/:3101 ni la base del repo), prepara una DB vieja con duplicados y
 * legacy solapada, y ejerce los endpoints por HTTP.
 *
 * Uso, desde web/ después de `npm run build`:
 *   node scripts/p0-fix-datos-contract.mjs
 */
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const PORT = 3123;
const BASE = `http://127.0.0.1:${PORT}`;

let failures = 0;
let checks = 0;
const results = [];

function check(name, ok, detail = "") {
  checks += 1;
  if (!ok) failures += 1;
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` · ${detail}` : ""}`);
}

function shortRef(orderId) {
  const hash = crypto.createHash("sha256").update(orderId).digest("hex");
  return String((parseInt(hash.slice(0, 8), 16) % 900000) + 100000);
}

function nextNumRef(numRef) {
  return String(((Number(numRef) + 1) % 900000) + 100000);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mercado-cero-fix-datos-"));
const dbPath = path.join(tmp, "contrato.db");
const logPath = path.join(tmp, "server.log");

function seedOldDatabase() {
  const db = new DatabaseSync(dbPath);
  try {
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec(`
      CREATE TABLE credit_payments (
        id TEXT PRIMARY KEY,
        credit_id TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        method TEXT NOT NULL DEFAULT 'cash',
        note TEXT,
        request_id TEXT,
        created_at TEXT NOT NULL
      );
    `);
    const insert = db.prepare(
      `INSERT INTO credit_payments
       (id, credit_id, amount_cents, method, note, request_id, created_at)
       VALUES (?, ?, ?, 'cash', ?, ?, ?)`,
    );
    insert.run("cp_dup_1", "cred_vieja", 1000, "primero", "dup-key", "2020-01-01T00:00:00.000Z");
    insert.run("cp_dup_2", "cred_vieja", 2000, "segundo", "dup-key", "2020-01-01T00:00:01.000Z");
    insert.run("cp_uniq", "cred_otra", 3000, null, "unique-key", "2020-01-01T00:00:02.000Z");

    db.exec(`
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
        created_at TEXT NOT NULL,
        UNIQUE(date, version)
      );
      CREATE TABLE cash_closes_legacy (
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
        created_at TEXT NOT NULL
      );
    `);
    db.prepare(
      `INSERT INTO cash_closes
       (id, date, version, opening_cents, counted_cents, created_at)
       VALUES ('cash_overlap', '2020-01-01', 1, 1000, 1000, '2020-01-01T00:00:00.000Z')`,
    ).run();
    const legacy = db.prepare(
      `INSERT INTO cash_closes_legacy
       (id, date, version, opening_cents, counted_cents, created_at)
       VALUES (?, '2020-01-01', 1, ?, ?, ?)`,
    );
    // Misma PK que la tabla versionada: debe actualizar, no ignorar.
    legacy.run("cash_overlap", 2000, 2000, "2020-01-01T00:00:00.000Z");
    // Misma (date, version) que otra fila: debe subir a v2.
    legacy.run("cash_extra", 3000, 3000, "2020-01-01T00:00:01.000Z");
  } finally {
    db.close();
  }
}

function withDb(fn) {
  const db = new DatabaseSync(dbPath);
  try {
    db.exec("PRAGMA busy_timeout = 5000;");
    return fn(db);
  } finally {
    db.close();
  }
}

function rows(sql, params = []) {
  return withDb((db) => db.prepare(sql).all(...params));
}

function exec(sql) {
  return withDb((db) => db.exec(sql));
}

async function waitForServer(child, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`El servidor terminó al arrancar.\n${readLog()}`);
    }
    try {
      const response = await fetch(`${BASE}/api/dashboard`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) return;
    } catch {
      // Aún no escucha.
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`El servidor no respondió en ${timeoutMs} ms.\n${readLog()}`);
}

function readLog() {
  try {
    return fs.readFileSync(logPath, "utf8").slice(-6000);
  } catch {
    return "(sin log)";
  }
}

function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      timeout: 20_000,
    });
  } else {
    child.kill("SIGTERM");
  }
}

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(600);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function api(pathname, options = {}) {
  const { method = "GET", body, raw } = options;
  const init = { method, signal: AbortSignal.timeout(20_000) };
  if (raw !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = raw;
  } else if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${BASE}${pathname}`, init);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

async function main() {
  if (await portInUse(PORT)) {
    throw new Error(
      `El puerto ${PORT} ya está ocupado. Este contrato exige un servidor aislado; no toca :3000 ni :3101.`,
    );
  }

  seedOldDatabase();

  const log = fs.openSync(logPath, "w");
  const child = spawn(
    process.execPath,
    [path.join(WEB, "node_modules", "next", "dist", "bin", "next"), "start"],
    {
      cwd: WEB,
      env: {
        ...process.env,
        PORT: String(PORT),
        DATABASE_PATH: dbPath,
        DEMO_MODE: "true",
        APP_URL: BASE,
        OPENAI_API_KEY: "",
        PEY_API_KEY: "",
        PEY_WEBHOOK_SECRET: "",
      },
      stdio: ["ignore", log, log],
      windowsHide: true,
    },
  );

  try {
    await waitForServer(child);

    // ---------------------------------------------------------------------
    // 1 · Migración: duplicados de credit_payments y legacy solapada.
    // ---------------------------------------------------------------------
    const cpRows = rows(
      "SELECT id, request_id FROM credit_payments WHERE id LIKE 'cp_%' ORDER BY id",
    );
    const cpByld = Object.fromEntries(cpRows.map((row) => [row.id, row.request_id]));
    check(
      "migración: conserva una llave duplicada y anula la otra",
      cpByld.cp_dup_1 === "dup-key" &&
        cpByld.cp_dup_2 === null &&
        cpByld.cp_uniq === "unique-key",
      JSON.stringify(cpByld),
    );
    const cpAudit = rows(
      "SELECT COUNT(*) AS n FROM audit_log WHERE action = 'credit_payment.request_id_deduped'",
    );
    check("migración: audita la llave duplicada anulada", Number(cpAudit[0].n) === 1);
    const cpIndex = rows(
      "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'index' AND name = 'idx_credit_payments_request_id'",
    );
    check("migración: crea el índice único de request_id", Number(cpIndex[0].n) === 1);

    const cashRows = rows(
      "SELECT id, version, counted_cents FROM cash_closes WHERE date = '2020-01-01' ORDER BY version",
    );
    check(
      "migración: upsert de la legacy por id conserva la fila y actualiza datos",
      cashRows.some(
        (row) => row.id === "cash_overlap" && Number(row.version) === 1 && Number(row.counted_cents) === 2000,
      ),
      JSON.stringify(cashRows),
    );
    check(
      "migración: la legacy que choca en (date, version) sube a v2",
      cashRows.some(
        (row) => row.id === "cash_extra" && Number(row.version) === 2 && Number(row.counted_cents) === 3000,
      ),
      JSON.stringify(cashRows),
    );
    const legacyLeft = rows(
      "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'cash_closes_legacy'",
    );
    check("migración: elimina cash_closes_legacy", Number(legacyLeft[0].n) === 0);
    const cashAudit = rows(
      "SELECT COUNT(*) AS n FROM audit_log WHERE action = 'cash_close.legacy_merged'",
    );
    check("migración: audita el merge de legacy", Number(cashAudit[0].n) === 2);

    // ---------------------------------------------------------------------
    // 2 · createOrder idempotente, atómico y con límites.
    // ---------------------------------------------------------------------
    const orderPayload = {
      items: [{ description: "Quesadilla", quantity: 1, unitPriceCents: 5000 }],
      cashCents: 5000,
      requestId: "contrato-order-idem",
    };
    const [orderA, orderB] = await Promise.all([
      api("/api/orders", { method: "POST", body: orderPayload }),
      api("/api/orders", { method: "POST", body: orderPayload }),
    ]);
    check(
      "createOrder: doble POST con el mismo requestId responde 201",
      orderA.status === 201 && orderB.status === 201,
      `${orderA.status}/${orderB.status}`,
    );
    check(
      "createOrder: doble POST devuelve el mismo pedido",
      Boolean(orderA.json?.order?.id) && orderA.json?.order?.id === orderB.json?.order?.id,
      `${orderA.json?.order?.id ?? "?"} / ${orderB.json?.order?.id ?? "?"}`,
    );
    const idemRows = rows(
      "SELECT COUNT(*) AS n FROM orders WHERE request_id = 'contrato-order-idem'",
    );
    check("createOrder: la DB tiene una sola fila con esa llave", Number(idemRows[0].n) === 1);

    const zeroTotal = await api("/api/orders", {
      method: "POST",
      body: {
        items: [{ description: "Gratis", quantity: 1, unitPriceCents: 0 }],
        requestId: "contrato-zero",
      },
    });
    check("createOrder: total 0 responde 400", zeroTotal.status === 400, String(zeroTotal.status));

    const tooMany = await api("/api/orders", {
      method: "POST",
      body: {
        items: Array.from({ length: 51 }, (_, index) => ({
          description: `Producto ${index}`,
          quantity: 1,
          unitPriceCents: 100,
        })),
      },
    });
    check("createOrder: 51 ítems responde 400", tooMany.status === 400, String(tooMany.status));

    const huge = await api("/api/orders", {
      method: "POST",
      raw: JSON.stringify({
        items: [{ description: "Grande", quantity: 1, unitPriceCents: 100 }],
        padding: "x".repeat(40 * 1024),
      }),
    });
    check("createOrder: body gigante responde 413", huge.status === 413, String(huge.status));

    const invalidJson = await api("/api/orders", { method: "POST", raw: "{nope" });
    check("createOrder: JSON inválido responde 400", invalidJson.status === 400);

    const countOrders = () =>
      Number(rows("SELECT COUNT(*) AS n FROM orders")[0].n);
    const beforeRollback = countOrders();
    exec(`
      CREATE TRIGGER contrato_fail_order_item
      BEFORE INSERT ON order_items
      WHEN NEW.description = 'force-fail-contract'
      BEGIN SELECT RAISE(ABORT, 'fallo forzado de contrato'); END;
    `);
    const failedOrder = await api("/api/orders", {
      method: "POST",
      body: {
        items: [{ description: "force-fail-contract", quantity: 1, unitPriceCents: 1000 }],
        cashCents: 1000,
        requestId: "contrato-rollback",
      },
    });
    exec("DROP TRIGGER contrato_fail_order_item;");
    check("createOrder: un fallo interno responde 500", failedOrder.status === 500, String(failedOrder.status));
    check(
      "createOrder: un fallo no deja pedido parcial",
      countOrders() === beforeRollback &&
        Number(
          rows("SELECT COUNT(*) AS n FROM orders WHERE request_id = 'contrato-rollback'")[0].n,
        ) === 0,
      `antes=${beforeRollback} después=${countOrders()}`,
    );
    check(
      "createOrder: el 500 no filtra el mensaje interno",
      !failedOrder.text.toLowerCase().includes("fallo forzado") &&
        !failedOrder.text.toLowerCase().includes("sqlite"),
      failedOrder.text.slice(0, 160),
    );

    // ---------------------------------------------------------------------
    // 3 · Links y QR: un solo recurso por pedido.
    // ---------------------------------------------------------------------
    const linkOrder = await api("/api/orders", {
      method: "POST",
      body: {
        items: [{ description: "Pedido link", quantity: 1, unitPriceCents: 5000 }],
        requestId: "contrato-link-order",
      },
    });
    const linkOrderId = linkOrder.json.order.id;
    const [linkA, linkB] = await Promise.all([
      api(`/api/orders/${linkOrderId}/pay`, { method: "POST", body: { mode: "link" } }),
      api(`/api/orders/${linkOrderId}/pay`, { method: "POST", body: { mode: "link" } }),
    ]);
    check(
      "links: dos POST concurrentes responden 200",
      linkA.status === 200 && linkB.status === 200,
      `${linkA.status}/${linkB.status}`,
    );
    check(
      "links: ambos devuelven el mismo paymentLinkId/url",
      Boolean(linkA.json?.order?.paymentLinkId) &&
        linkA.json.order.paymentLinkId === linkB.json?.order?.paymentLinkId &&
        linkA.json.order.paymentUrl === linkB.json?.order?.paymentUrl,
      `${linkA.json?.order?.paymentLinkId ?? "?"} / ${linkB.json?.order?.paymentLinkId ?? "?"}`,
    );
    const linkAudit = rows(
      "SELECT COUNT(*) AS n FROM audit_log WHERE action = 'payment_link.attached' AND entity_id = ?",
      [linkOrderId],
    );
    check("links: solo se adjunta un link", Number(linkAudit[0].n) === 1);
    const paymentUrl = linkA.json?.order?.paymentUrl;
    const payPage = await fetch(paymentUrl, { signal: AbortSignal.timeout(10_000) });
    check("links: el primer link responde la página de cobro", payPage.status === 200, String(payPage.status));
    const paid = await api("/api/demo/pay", {
      method: "POST",
      body: { orderId: linkOrderId, method: "codi" },
    });
    check(
      "links: pagar el primer link deja el pedido demo_paid",
      paid.status === 200 && paid.json?.order?.status === "demo_paid",
      `${paid.status} · ${paid.json?.order?.status ?? "?"}`,
    );

    const qrOrder = await api("/api/orders", {
      method: "POST",
      body: {
        items: [{ description: "Pedido QR", quantity: 1, unitPriceCents: 6000 }],
        requestId: "contrato-qr-order",
      },
    });
    const qrOrderId = qrOrder.json.order.id;
    const [qrA, qrB] = await Promise.all([
      api(`/api/orders/${qrOrderId}/pay`, { method: "POST", body: { mode: "qr" } }),
      api(`/api/orders/${qrOrderId}/pay`, { method: "POST", body: { mode: "qr" } }),
    ]);
    check(
      "QR: dos POST concurrentes devuelven el mismo qrId y numRef",
      qrA.status === 200 &&
        qrB.status === 200 &&
        Boolean(qrA.json?.order?.qrId) &&
        qrA.json.order.qrId === qrB.json?.order?.qrId &&
        qrA.json.order.numRef === qrB.json?.order?.numRef,
      `${qrA.status}/${qrB.status} · ${qrA.json?.order?.numRef ?? "?"}`,
    );
    const qrAudit = rows(
      "SELECT COUNT(*) AS n FROM audit_log WHERE action = 'codi_qr.attached' AND entity_id = ?",
      [qrOrderId],
    );
    check("QR: solo se adjunta un QR", Number(qrAudit[0].n) === 1);

    const exhaustedOrder = await api("/api/orders", {
      method: "POST",
      body: {
        items: [{ description: "Pedido sin numRef", quantity: 1, unitPriceCents: 7000 }],
        requestId: "contrato-numref-order",
      },
    });
    const exhaustedId = exhaustedOrder.json.order.id;
    let blockedRef = shortRef(exhaustedId);
    const blockerIds = [];
    const insertBlocker = withDb((db) => {
      const stmt = db.prepare(
        `INSERT INTO orders
         (id, merchant_id, status, total_cents, paid_cents, num_ref, created_at, updated_at)
         VALUES (?, 'lupita', 'confirmed', 100, 0, ?, ?, ?)`,
      );
      const now = new Date().toISOString();
      for (let index = 0; index < 10; index += 1) {
        const id = `blk_contract_${Date.now()}_${index}`;
        blockerIds.push(id);
        stmt.run(id, blockedRef, now, now);
        blockedRef = nextNumRef(blockedRef);
      }
    });
    void insertBlocker;
    const exhausted = await api(`/api/orders/${exhaustedId}/pay`, {
      method: "POST",
      body: { mode: "qr" },
    });
    check(
      "QR: tras 10 colisiones de numRef responde 409",
      exhausted.status === 409,
      `${exhausted.status} · ${exhausted.json?.code ?? ""}`,
    );
    const exhaustedRow = rows(
      "SELECT qr_id, qr_string, num_ref FROM orders WHERE id = ?",
      [exhaustedId],
    )[0];
    check(
      "QR: tras 10 colisiones no adjunta nada",
      exhaustedRow.qr_id === null &&
        exhaustedRow.qr_string === null &&
        exhaustedRow.num_ref === null,
      JSON.stringify(exhaustedRow),
    );
    withDb((db) => {
      const stmt = db.prepare("DELETE FROM orders WHERE id = ?");
      for (const id of blockerIds) stmt.run(id);
    });

    // ---------------------------------------------------------------------
    // 4 · Metas: transacción + requestId idempotente.
    // ---------------------------------------------------------------------
    const goals = await api("/api/goals");
    const goalId = goals.json.goals[0].id;
    const savedBefore = Number(
      rows("SELECT saved_cents FROM goals WHERE id = ?", [goalId])[0].saved_cents,
    );
    const contribution = {
      amountCents: 2500,
      note: "Contrato",
      requestId: "contrato-goal-idem",
    };
    const [goalA, goalB] = await Promise.all([
      api(`/api/goals/${goalId}/contribute`, { method: "POST", body: contribution }),
      api(`/api/goals/${goalId}/contribute`, { method: "POST", body: contribution }),
    ]);
    const savedAfter = Number(
      rows("SELECT saved_cents FROM goals WHERE id = ?", [goalId])[0].saved_cents,
    );
    check(
      "metas: doble POST con el mismo requestId responde 200",
      goalA.status === 200 && goalB.status === 200,
      `${goalA.status}/${goalB.status}`,
    );
    check(
      "metas: el doble clic no infla el ahorro",
      savedAfter === savedBefore + 2500,
      `antes=${savedBefore} después=${savedAfter}`,
    );
    const goalRequestRows = rows(
      "SELECT COUNT(*) AS n FROM goal_contributions WHERE request_id = 'contrato-goal-idem'",
    );
    check(
      "metas: solo existe una aportación con esa llave",
      Number(goalRequestRows[0].n) === 1,
    );

    const savedBeforeNoKey = Number(
      rows("SELECT saved_cents FROM goals WHERE id = ?", [goalId])[0].saved_cents,
    );
    const noKey = await api(`/api/goals/${goalId}/contribute`, {
      method: "POST",
      body: { amountCents: 2000, note: "Sin llave" },
    });
    const savedAfterNoKey = Number(
      rows("SELECT saved_cents FROM goals WHERE id = ?", [goalId])[0].saved_cents,
    );
    check(
      "metas: sin requestId responde 400 y no escribe",
      noKey.status === 400 && savedAfterNoKey === savedBeforeNoKey,
      `${noKey.status} · antes=${savedBeforeNoKey} después=${savedAfterNoKey}`,
    );

    const secondGoal = await api("/api/goals", {
      method: "POST",
      body: { title: "Meta de contrato", targetCents: 100000 },
    });
    const secondGoalId = secondGoal.json.goal.id;
    const reusedKey = await api(`/api/goals/${secondGoalId}/contribute`, {
      method: "POST",
      body: { amountCents: 1000, requestId: "contrato-goal-idem" },
    });
    const secondSaved = Number(
      rows("SELECT saved_cents FROM goals WHERE id = ?", [secondGoalId])[0].saved_cents,
    );
    check(
      "metas: requestId de otra meta responde 409 y no escribe",
      reusedKey.status === 409 && secondSaved === 0,
      `${reusedKey.status} · saved=${secondSaved}`,
    );

    const missingGoal = await api("/api/goals/goal_no_existe/contribute", {
      method: "POST",
      body: { amountCents: 1000, requestId: "contrato-goal-missing" },
    });
    check("metas: meta inexistente responde 404", missingGoal.status === 404, String(missingGoal.status));

    const savedBeforeFailure = Number(
      rows("SELECT saved_cents FROM goals WHERE id = ?", [goalId])[0].saved_cents,
    );
    exec(`
      CREATE TRIGGER contrato_fail_goal
      BEFORE INSERT ON goal_contributions
      WHEN NEW.note = 'force-fail-contract'
      BEGIN SELECT RAISE(ABORT, 'fallo forzado de meta'); END;
    `);
    const failedGoal = await api(`/api/goals/${goalId}/contribute`, {
      method: "POST",
      body: {
        amountCents: 1500,
        note: "force-fail-contract",
        requestId: "contrato-goal-fail",
      },
    });
    exec("DROP TRIGGER contrato_fail_goal;");
    const savedAfterFailure = Number(
      rows("SELECT saved_cents FROM goals WHERE id = ?", [goalId])[0].saved_cents,
    );
    check(
      "metas: un fallo interno responde 500 y no deja la meta corta",
      failedGoal.status === 500 && savedAfterFailure === savedBeforeFailure,
      `${failedGoal.status} · antes=${savedBeforeFailure} después=${savedAfterFailure}`,
    );
    check(
      "metas: el 500 no filtra el mensaje interno",
      !failedGoal.text.toLowerCase().includes("fallo forzado"),
      failedGoal.text.slice(0, 160),
    );

    // ---------------------------------------------------------------------
    // 5 · Fiado: el índice único no rompe la idempotencia existente.
    // ---------------------------------------------------------------------
    const credits = await api("/api/credits");
    const openCredit = credits.json.credits.find((credit) => credit.balanceCents > 0);
    check("fiado: hay un crédito abierto para probar", Boolean(openCredit));
    if (openCredit) {
      const creditBody = {
        amountCents: 100,
        method: "cash",
        requestId: "contrato-credit-idem",
      };
      const creditA = await api(`/api/credits/${openCredit.id}/pay`, {
        method: "POST",
        body: creditBody,
      });
      const creditB = await api(`/api/credits/${openCredit.id}/pay`, {
        method: "POST",
        body: creditBody,
      });
      check(
        "fiado: el reintento devuelve duplicate=true",
        creditA.status === 200 &&
          creditA.json?.duplicate === false &&
          creditB.status === 200 &&
          creditB.json?.duplicate === true,
        `${creditA.status}/${creditB.status} · ${creditB.json?.duplicate}`,
      );
      const creditRows = rows(
        "SELECT COUNT(*) AS n FROM credit_payments WHERE request_id = 'contrato-credit-idem'",
      );
      check(
        "fiado: el reintento no inserta otro abono",
        Number(creditRows[0].n) === 1,
      );
    }

    // ---------------------------------------------------------------------
    // 6 · Mapeo de errores.
    // ---------------------------------------------------------------------
    const missingOrder = await api("/api/orders/ord_no_existe");
    check("errores: pedido inexistente responde 404", missingOrder.status === 404);
    const missingPay = await api("/api/orders/ord_no_existe/pay", {
      method: "POST",
      body: { mode: "link" },
    });
    check("errores: cobro de pedido inexistente responde 404", missingPay.status === 404);
    const missingCredit = await api("/api/credits/cred_no_existe/pay", {
      method: "POST",
      body: { amountCents: 100 },
    });
    check("errores: abono de fiado inexistente responde 404", missingCredit.status === 404);
    const badMode = await api(`/api/orders/${linkOrderId}/pay`, {
      method: "POST",
      body: { mode: "otro" },
    });
    check("errores: modo de cobro inválido responde 400", badMode.status === 400);
  } finally {
    stopServer(child);
    fs.closeSync(log);
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      // Windows a veces tarda en soltar el archivo WAL; no es un fallo del test.
    }
  }

  console.log("");
  console.log(`P0 FIX DATOS · ${checks - failures} PASS · ${failures} FAIL · ${checks} checks`);
  if (failures > 0) {
    console.log("Fallos:");
    for (const result of results.filter((item) => !item.ok)) {
      console.log(`  - ${result.name}${result.detail ? ` · ${result.detail}` : ""}`);
    }
  }
  if (failures === 0) {
    console.log("DATOS OK");
  }
  return failures === 0 ? 0 : 1;
}

process.exitCode = await main().catch((error) => {
  console.error("FALLO DEL CONTRATO:", error);
  try {
    console.error(readLog());
  } catch {
    // sin log
  }
  process.exitCode = 1;
});
