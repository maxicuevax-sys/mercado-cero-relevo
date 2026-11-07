#!/usr/bin/env node
/**
 * Contrato de guardas de datos: arranque fallido y filtro demo en fiado.
 *
 * 1. Si la migración falla, `getDb()` no cachea una base parcial: al corregir
 *    la causa, la siguiente petición vuelve a migrar y sembrar.
 * 2. Una base demo reutilizada con DEMO_MODE=false no lista sus créditos
 *    `demo_seed_*`, pero conserva los créditos reales.
 *
 * Uso, desde web/ después de `npm run build`:
 *   node scripts/p0-db-guards-contract.mjs
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const NEXT_BIN = path.join(WEB, "node_modules", "next", "dist", "bin", "next");
const usedPorts = new Set();
const FAIL_PORT = await pickPort(3293, "DB_GUARDS_FAIL_PORT");
const DEMO_PORT = await pickPort(3294, "DB_GUARDS_DEMO_PORT");
const REAL_PORT = await pickPort(3295, "DB_GUARDS_REAL_PORT");

let checks = 0;
let failures = 0;
const results = [];

function check(name, ok, detail = "") {
  checks += 1;
  if (!ok) failures += 1;
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` · ${detail}` : ""}`);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mercado-cero-db-guards-"));

function withDb(dbPath, fn) {
  const database = new DatabaseSync(dbPath);
  try {
    database.exec("PRAGMA busy_timeout = 5000;");
    return fn(database);
  } finally {
    database.close();
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

function portFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen({ port, host: "::" }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function pickPort(start, envName) {
  const fromEnv = Number(process.env[envName] ?? 0);
  if (fromEnv) {
    usedPorts.add(fromEnv);
    return fromEnv;
  }
  for (let port = start; port < start + 50; port += 1) {
    if (usedPorts.has(port)) continue;
    if (await portFree(port)) {
      usedPorts.add(port);
      return port;
    }
  }
  throw new Error(`No encontré puerto libre desde ${start}.`);
}

async function waitForPort(port, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await portInUse(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`El servidor no abrió el puerto ${port}.`);
}

function startServer({ port, dbPath, demoMode, logPath }) {
  const log = fs.openSync(logPath, "w");
  const child = spawn(
    process.execPath,
    [NEXT_BIN, "start"],
    {
      cwd: WEB,
      env: {
        ...process.env,
        PORT: String(port),
        HOSTNAME: "127.0.0.1",
        DATABASE_PATH: dbPath,
        DEMO_MODE: demoMode ? "true" : "false",
        APP_URL: `http://127.0.0.1:${port}`,
        OPENAI_API_KEY: "",
        PEY_API_KEY: "",
        PEY_WEBHOOK_SECRET: "",
      },
      stdio: ["ignore", log, log],
      windowsHide: true,
    },
  );
  return { child, log };
}

function stopServer(server) {
  if (!server) return;
  const { child, log } = server;
  if (child.exitCode === null) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        timeout: 20_000,
      });
    } else {
      child.kill("SIGTERM");
    }
  }
  try {
    fs.closeSync(log);
  } catch {
    // Ya estaba cerrado.
  }
}

function readLog(logPath) {
  try {
    return fs.readFileSync(logPath, "utf8").slice(-5000);
  } catch {
    return "(sin log)";
  }
}

async function requestJson(base, pathname, options = {}) {
  const { method = "GET", body } = options;
  const init = { method, signal: AbortSignal.timeout(20_000) };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${base}${pathname}`, init);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

async function failOpenCase() {
  if (await portInUse(FAIL_PORT)) {
    throw new Error(`El puerto ${FAIL_PORT} ya está ocupado.`);
  }
  const dbPath = path.join(tmp, "fail-open.db");
  withDb(dbPath, (database) => {
    // El nombre del índice choca con una tabla: la migración falla a mitad.
    database.exec(
      "CREATE TABLE idx_credit_payments_request_id (motivo TEXT NOT NULL);",
    );
  });

  const logPath = path.join(tmp, "fail-open.log");
  const server = startServer({
    port: FAIL_PORT,
    dbPath,
    demoMode: true,
    logPath,
  });
  try {
    await waitForPort(FAIL_PORT);

    const first = await requestJson(
      `http://127.0.0.1:${FAIL_PORT}`,
      "/api/cash",
    );
    check(
      "arranque fallido: la primera petición responde 500 sin cachear la DB",
      first.status === 500,
      `${first.status}`,
    );

    // Se corrige la causa mientras el servidor sigue vivo.
    withDb(dbPath, (database) => {
      database.exec("DROP TABLE idx_credit_payments_request_id;");
    });

    const second = await requestJson(
      `http://127.0.0.1:${FAIL_PORT}`,
      "/api/cash",
    );
    check(
      "arranque fallido: la petición siguiente reintenta y responde 200",
      second.status === 200,
      `${second.status}`,
    );

    const state = withDb(dbPath, (database) => {
      const index = database
        .prepare(
          "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'index' AND name = 'idx_credit_payments_request_id'",
        )
        .get();
      const orders = database.prepare("SELECT COUNT(*) AS n FROM orders").get();
      return {
        index: Number(index.n),
        orders: Number(orders.n),
      };
    });
    check(
      "arranque fallido: el reintento completó migración e índice",
      state.index === 1,
      `índice=${state.index}`,
    );
    check(
      "arranque fallido: el reintento completó el seed demo",
      state.orders > 0,
      `orders=${state.orders}`,
    );
  } catch (error) {
    check("arranque fallido: sin excepción", false, String(error));
    console.error(readLog(logPath));
  } finally {
    stopServer(server);
  }
}

async function demoFilterCase() {
  if (await portInUse(DEMO_PORT)) {
    throw new Error(`El puerto ${DEMO_PORT} ya está ocupado.`);
  }
  if (await portInUse(REAL_PORT)) {
    throw new Error(`El puerto ${REAL_PORT} ya está ocupado.`);
  }
  const dbPath = path.join(tmp, "demo-reuse.db");
  const demoLog = path.join(tmp, "demo.log");
  const demoServer = startServer({
    port: DEMO_PORT,
    dbPath,
    demoMode: true,
    logPath: demoLog,
  });
  let demoResult;
  let demoDashboard;
  let demoCash;
  let demoCashOrder;
  let demoCreditOrder;
  try {
    await waitForPort(DEMO_PORT);
    const base = `http://127.0.0.1:${DEMO_PORT}`;
    demoResult = await requestJson(base, "/api/credits");
    demoCash = await requestJson(base, "/api/cash");
    // Ventas manuales hechas en demo: deben quedar marcadas y no contar
    // cuando la misma base se abra en modo real.
    demoCreditOrder = await requestJson(base, "/api/orders", {
      method: "POST",
      body: {
        items: [
          { description: "Crédito demo marcado", quantity: 1, unitPriceCents: 1000 },
        ],
        creditCents: 1000,
        customerName: "Cliente Demo Marcado",
        requestId: "guards-demo-credit",
      },
    });
    demoCashOrder = await requestJson(base, "/api/orders", {
      method: "POST",
      body: {
        items: [{ description: "Efectivo demo marcado", quantity: 1, unitPriceCents: 2000 }],
        cashCents: 2000,
        requestId: "guards-demo-cash",
      },
    });
    demoDashboard = await requestJson(base, "/api/dashboard");
  } finally {
    stopServer(demoServer);
  }

  const demoCredits = demoResult?.json?.credits ?? [];
  const demoCreatedCreditId = demoCreditOrder?.json?.order?.creditId ?? "";
  check(
    "filtro demo: en modo demo el fiado de fixture sigue visible",
    demoResult?.status === 200 &&
      demoCredits.some((credit) => String(credit.id).startsWith("demo_seed_")),
    `${demoResult?.status} · ${demoCredits.length} créditos`,
  );
  check(
    "filtro demo: una venta manual en demo nace marcada como demo",
    Boolean(demoCreatedCreditId) &&
      withDb(dbPath, (database) =>
        Boolean(
          database
            .prepare("SELECT demo FROM credits WHERE id = ?")
            .get(demoCreatedCreditId)?.demo,
        ),
      ),
    `creditId=${demoCreatedCreditId}`,
  );
  const demoCashOrderId = demoCashOrder?.json?.order?.id ?? "";
  check(
    "filtro demo: el efectivo manual en demo queda marcado",
    demoCashOrder?.status === 201 &&
      withDb(dbPath, (database) =>
        Boolean(
          database
            .prepare("SELECT demo FROM payments WHERE order_id = ?")
            .get(demoCashOrderId)?.demo,
        ),
      ),
    `orderId=${demoCashOrderId}`,
  );
  check(
    "filtro demo: el pendiente fixture es visible en modo demo",
    (demoDashboard?.json?.pendingOrders ?? []).some((order) =>
      String(order.id).startsWith("demo_hist_pending_"),
    ),
    `${(demoDashboard?.json?.pendingOrders ?? []).length} pendientes`,
  );

  // Se simula una base demo reutilizada: se agrega un crédito real y un corte
  // demo del mismo día. El corte demo no debe verse ni bloquear la versión real.
  const now = new Date().toISOString();
  const demoCashDate = demoCash?.json?.date ?? "";
  withDb(dbPath, (database) => {
    database
      .prepare(
        "INSERT INTO customers (id, name, phone, created_at) VALUES (?, ?, NULL, ?)",
      )
      .run("cus_real_guard", "Cliente Real", now);
    database
      .prepare(
        `INSERT INTO credits
         (id, customer_id, order_id, original_cents, balance_cents, status, due_date, created_at)
         VALUES (?, ?, NULL, 4321, 4321, 'open', NULL, ?)`,
      )
      .run("cred_real_guard", "cus_real_guard", now);
    if (demoCashDate) {
      database
        .prepare(
          `INSERT INTO cash_closes
           (id, date, version, opening_cents, cash_sales_cents, cash_credit_cents,
            expenses_cents, withdrawals_cents, expected_cents, counted_cents,
            difference_cents, base_next_cents, withdrawal_next_cents,
            snapshot_cash_cents, snapshot_credit_cents, snapshot_pending_digital_cents,
            snapshot_known, reason, request_id, demo, created_at)
           VALUES ('cash_demo_today', ?, 1, 55000, 0, 0, 0, 0, 55000, 55000, 0,
                   55000, 0, 0, 0, 0, 0, NULL, NULL, 1, ?)`,
        )
        .run(demoCashDate, now);
    }
  });

  const realLog = path.join(tmp, "real.log");
  const realServer = startServer({
    port: REAL_PORT,
    dbPath,
    demoMode: false,
    logPath: realLog,
  });
  let realCredits;
  let dashboard;
  let realCash;
  let realAnalytics;
  let blockedPay;
  let realPreview;
  let realClose;
  try {
    await waitForPort(REAL_PORT);
    const base = `http://127.0.0.1:${REAL_PORT}`;
    realCredits = await requestJson(base, "/api/credits");
    dashboard = await requestJson(base, "/api/dashboard");
    realCash = await requestJson(base, "/api/cash");
    realAnalytics = await requestJson(base, "/api/analytics?period=today");
    blockedPay = await requestJson(
      base,
      `/api/credits/${demoCreatedCreditId}/pay`,
      {
        method: "POST",
        body: {
          amountCents: 100,
          method: "cash",
          requestId: "guards-demo-credit-pay",
        },
      },
    );
    realPreview = await requestJson(base, "/api/cash/preview", {
      method: "POST",
      body: {
        openingCents: 0,
        expensesCents: 0,
        withdrawalsCents: 0,
        countedCents: 1000,
        baseNextCents: 500,
      },
    });
    realClose = await requestJson(base, "/api/cash/close", {
      method: "POST",
      body: {
        openingCents: 0,
        expensesCents: 0,
        withdrawalsCents: 0,
        countedCents: 1000,
        baseNextCents: 500,
        expectedVersion: 0,
        previewFingerprint: realPreview.json?.preview?.fingerprint ?? "",
        requestId: "guards-real-close",
      },
    });

    const rows = realCredits.json?.credits ?? [];
    check(
      "filtro demo: en modo real /api/credits excluye demo_seed_*",
      realCredits.status === 200 &&
        rows.every((credit) => !String(credit.id).startsWith("demo_seed_")) &&
        rows.every(
          (credit) => !String(credit.customerId).startsWith("demo_seed_"),
        ),
      JSON.stringify(rows.map((credit) => credit.id)),
    );
    check(
      "filtro demo: en modo real el crédito real sigue visible",
      rows.length === 1 && rows[0]?.id === "cred_real_guard",
      JSON.stringify(rows),
    );
    check(
      "filtro demo: countCredits coincide con la lista filtrada",
      Number(realCredits.json?.total) === 1,
      `total=${realCredits.json?.total}`,
    );
    check(
      "filtro demo: el resumen real no suma el saldo demo",
      dashboard.status === 200 &&
        Number(dashboard.json?.summary?.creditCents) === 4321 &&
        Number(dashboard.json?.summary?.demoCreditCents) === 6000,
      `credit=${dashboard.json?.summary?.creditCents} demo=${dashboard.json?.summary?.demoCreditCents}`,
    );
    check(
      "filtro demo: pagar un crédito demo en real responde 404",
      blockedPay.status === 404,
      `${blockedPay.status} · ${blockedPay.json?.code ?? ""}`,
    );
    check(
      "filtro demo: el abono bloqueado no toca el saldo demo",
      withDb(dbPath, (database) => {
        const row = database
          .prepare("SELECT balance_cents FROM credits WHERE id = ?")
          .get(demoCreatedCreditId);
        return Number(row?.balance_cents) === 1000;
      }),
      `creditId=${demoCreatedCreditId}`,
    );
    const pendingRows = dashboard.json?.pendingOrders ?? [];
    check(
      "filtro demo: el pendiente demo no aparece en modo real",
      pendingRows.every((order) => !String(order.id).startsWith("demo_")) &&
        Number(dashboard.json?.pagination?.pendingOrders?.total) === 0,
      JSON.stringify(pendingRows.map((order) => order.id)),
    );
    check(
      "filtro demo: el efectivo manual demo no suma al resumen real",
      Number(dashboard.json?.summary?.cashCents) === 0 &&
        Number(dashboard.json?.summary?.demoCashCents) >= 2000,
      `cash=${dashboard.json?.summary?.cashCents} demo=${dashboard.json?.summary?.demoCashCents}`,
    );
    check(
      "filtro demo: el efectivo manual demo no suma al corte real",
      realCash.status === 200 &&
        Number(realCash.json?.cashSalesCents) === 0 &&
        Number(realCash.json?.cashCreditCents) === 0 &&
        Number(realCash.json?.openingCents) === 0 &&
        realCash.json?.saved === null,
      JSON.stringify({
        opening: realCash.json?.openingCents,
        sales: realCash.json?.cashSalesCents,
        credit: realCash.json?.cashCreditCents,
        saved: realCash.json?.saved,
      }),
    );
    check(
      "filtro demo: analytics real no suma el efectivo manual demo",
      realAnalytics.status === 200 &&
        Number(realAnalytics.json?.cashCents) === 0,
      `cash=${realAnalytics.json?.cashCents}`,
    );
    check(
      "filtro demo: un corte demo del mismo día no bloquea la versión real",
      realPreview.status === 200 &&
        realClose.status === 200 &&
        Number(realClose.json?.close?.version) === 2 &&
        Number(realClose.json?.close?.demo) !== 1,
      `${realClose.status} · ${JSON.stringify(realClose.json?.close ?? null)}`.slice(0, 260),
    );
    check(
      "filtro demo: el corte real guardado es visible y el demo sigue oculto",
      withDb(dbPath, (database) => {
        const visible = database
          .prepare(
            "SELECT id, version FROM cash_closes WHERE date = ? AND demo = 0 ORDER BY version DESC LIMIT 1",
          )
          .get(demoCashDate);
        return (
          Number(visible?.version) === 2 &&
          visible?.id === realClose.json?.close?.id
        );
      }),
      `date=${demoCashDate}`,
    );
  } catch (error) {
    check("filtro demo: sin excepción", false, String(error));
    console.error(readLog(realLog));
  } finally {
    stopServer(realServer);
  }
}

async function main() {
  if (!fs.existsSync(path.join(WEB, ".next", "BUILD_ID"))) {
    throw new Error("FALTA build. Corre `npm run build` antes de este contrato.");
  }
  await failOpenCase();
  await demoFilterCase();

  console.log("");
  console.log(
    `P0 DB GUARDS · ${checks - failures} PASS · ${failures} FAIL · ${checks} checks`,
  );
  if (failures > 0) {
    for (const result of results.filter((item) => !item.ok)) {
      console.log(`  - ${result.name}${result.detail ? ` · ${result.detail}` : ""}`);
    }
  }
  return failures === 0 ? 0 : 1;
}

process.exitCode = await main().catch((error) => {
  console.error("FALLO DEL CONTRATO:", error);
  process.exitCode = 1;
});

try {
  fs.rmSync(tmp, { recursive: true, force: true });
} catch {
  // Windows puede tardar en soltar WAL; no es un fallo del contrato.
}
