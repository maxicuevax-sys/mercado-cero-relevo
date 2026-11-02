#!/usr/bin/env node
/**
 * Contrato demo → real.
 *
 * Reproduce el P0 de reutilizar una base demo en modo real:
 *   1. Una venta fiada real a "Juan" no reutiliza el cliente demo.
 *   2. El crédito real se lista y se puede cobrar aunque su cliente sea demo.
 *   3. `fulfill` bloquea mientras el crédito siga abierto (por order_id).
 *   4. Un requestId demo no devuelve ni reutiliza un pedido demo en real.
 *   5. Los enlaces/QR demo no resuelven pedidos en real.
 *   6. Metas y pendientes demo se filtran en real.
 *   7. Reset: 409 `real_data_present` sin FORCE; con FORCE solo borra demo y
 *      conserva venta en efectivo, corte, meta y pendiente reales.
 *
 * Levanta servidores Next aislados en :3290/:3291 con DB temporal. Nunca toca
 * :3000, :3101 ni la base del repo.
 *
 * Uso, desde web/ después de `npm run build`:
 *   node scripts/p0-demo-real-contract.mjs
 */
import crypto from "node:crypto";
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
const DEMO_PORT = Number(process.env.DEMO_REAL_DEMO_PORT ?? 3290);
const REAL_PORT = Number(process.env.DEMO_REAL_REAL_PORT ?? 3291);
const DEMO_BASE = `http://127.0.0.1:${DEMO_PORT}`;
const REAL_BASE = `http://127.0.0.1:${REAL_PORT}`;
const SECRET = `whsec_${Buffer.from("demo-real-contract-secret-2026").toString("base64")}`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mercado-cero-demo-real-"));
const backups = path.join(tmp, "backups");
const demoDb = path.join(tmp, "demo.db");
const realDb = path.join(tmp, "real.db");

let checks = 0;
let failures = 0;
const results = [];

function check(name, ok, detail = "") {
  checks += 1;
  if (!ok) failures += 1;
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` · ${detail}` : ""}`);
}

function withDb(dbPath, fn) {
  const database = new DatabaseSync(dbPath);
  try {
    database.exec("PRAGMA busy_timeout = 5000;");
    return fn(database);
  } finally {
    database.close();
  }
}

function rows(dbPath, sql, params = []) {
  return withDb(dbPath, (database) => database.prepare(sql).all(...params));
}

function checkpoint(dbPath) {
  try {
    withDb(dbPath, (database) => {
      database.exec("PRAGMA wal_checkpoint(TRUNCATE);");
    });
  } catch {
    // Si el archivo no existe todavía no hay nada que consolidar.
  }
}

function copyDatabase(from, to) {
  checkpoint(from);
  fs.copyFileSync(from, to);
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

async function waitForServer(base, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/api/dashboard`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) return;
    } catch {
      // Aún arrancando.
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`El servidor ${base} no respondió en ${timeoutMs} ms.`);
}

function startServer({ port, dbPath, demoMode, force = false }) {
  const logPath = path.join(tmp, `server-${port}.log`);
  const log = fs.openSync(logPath, "w");
  const child = spawn(process.execPath, [NEXT_BIN, "start"], {
    cwd: WEB,
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      DATABASE_PATH: dbPath,
      DATABASE_BACKUP_DIR: backups,
      DEMO_MODE: demoMode ? "true" : "false",
      FORCE_DEMO_RESET: force ? "1" : "0",
      APP_URL: `http://127.0.0.1:${port}`,
      PEY_WEBHOOK_SECRET: SECRET,
      PEY_API_KEY: "",
      OPENAI_API_KEY: "",
    },
    stdio: ["ignore", log, log],
    windowsHide: true,
  });
  return { child, log, logPath };
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

function readLog(server) {
  try {
    return fs.readFileSync(server.logPath, "utf8").slice(-5000);
  } catch {
    return "(sin log)";
  }
}

async function api(base, pathname, options = {}) {
  const { method = "GET", body, raw, headers = {} } = options;
  const init = { method, headers: { ...headers }, signal: AbortSignal.timeout(20_000) };
  if (raw !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = raw;
  } else if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
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

function signWebhook(body, id) {
  const timestamp = Math.floor(Date.now() / 1000);
  const key = Buffer.from(SECRET.replace(/^whsec_/, ""), "base64");
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

async function sendWebhook(event) {
  const body = JSON.stringify(event);
  const id = `msg_${crypto.randomUUID()}`;
  return api(REAL_BASE, "/api/webhooks/pey", {
    method: "POST",
    headers: signWebhook(body, id),
    raw: body,
  });
}

async function main() {
  for (const port of [DEMO_PORT, REAL_PORT]) {
    if (port === 3000 || port === 3101) {
      throw new Error(`Puerto reservado: ${port}. Usa :3280+.`);
    }
    if (await portInUse(port)) {
      throw new Error(`El puerto ${port} ya está ocupado.`);
    }
  }
  fs.mkdirSync(backups, { recursive: true });

  // -------------------------------------------------------------------
  // 1 · Base demo con fixtures y datos demo marcados.
  // -------------------------------------------------------------------
  let demoServer = startServer({ port: DEMO_PORT, dbPath: demoDb, demoMode: true });
  let demoCross;
  let demoLinkOrder;
  let demoQrOrder;
  let demoGoal;
  let demoTask;
  try {
    await waitForServer(DEMO_BASE);
    const reset = await api(DEMO_BASE, "/api/demo/reset", { method: "POST" });
    check("demo: reset inicial responde 200", reset.status === 200, String(reset.status));

    const cash = await api(DEMO_BASE, "/api/orders", {
      method: "POST",
      body: {
        items: [{ description: "Venta demo cruzada", quantity: 1, unitPriceCents: 1000 }],
        cashCents: 1000,
        requestId: "demo-real-cross-request",
      },
    });
    demoCross = cash.json?.order;
    check(
      "demo: pedido con requestId demo creado",
      cash.status === 201 && Boolean(demoCross?.id),
      `${cash.status} · ${demoCross?.id ?? "?"}`,
    );

    const linkOrder = await api(DEMO_BASE, "/api/orders", {
      method: "POST",
      body: { items: [{ description: "Link demo", quantity: 1, unitPriceCents: 2000 }] },
    });
    const linked = await api(DEMO_BASE, `/api/orders/${linkOrder.json.order.id}/pay`, {
      method: "POST",
      body: { mode: "link" },
    });
    demoLinkOrder = linked.json?.order;

    const qrOrder = await api(DEMO_BASE, "/api/orders", {
      method: "POST",
      body: { items: [{ description: "QR demo", quantity: 1, unitPriceCents: 3000 }] },
    });
    const qr = await api(DEMO_BASE, `/api/orders/${qrOrder.json.order.id}/pay`, {
      method: "POST",
      body: { mode: "qr" },
    });
    demoQrOrder = qr.json?.order;

    const goal = await api(DEMO_BASE, "/api/goals", {
      method: "POST",
      body: { title: "Meta demo visible", targetCents: 100000 },
    });
    demoGoal = goal.json?.goal;

    const task = await api(DEMO_BASE, "/api/tasks", {
      method: "POST",
      body: { title: "Pendiente demo visible" },
    });
    demoTask = task.json?.task;

    check(
      "demo: meta y pendiente nacen marcados demo",
      rows(demoDb, "SELECT demo FROM goals WHERE id = ?", [demoGoal?.id])[0]?.demo === 1 &&
        rows(demoDb, "SELECT demo FROM tasks WHERE id = ?", [demoTask?.id])[0]?.demo === 1,
      JSON.stringify({ goal: demoGoal?.id, task: demoTask?.id }),
    );
  } finally {
    stopServer(demoServer);
  }

  copyDatabase(demoDb, realDb);

  // -------------------------------------------------------------------
  // 2 · Modo real sobre la copia de la base demo.
  // -------------------------------------------------------------------
  let realServer = startServer({ port: REAL_PORT, dbPath: realDb, demoMode: false });
  let juanOrder;
  let juanCredit;
  let cashSale;
  let realGoal;
  let realTask;
  let realCloseId;
  try {
    await waitForServer(REAL_BASE);

    // 2a. Venta fiada real a "Juan": no reutiliza el fixture demo.
    const sale = await api(REAL_BASE, "/api/orders", {
      method: "POST",
      body: {
        items: [{ description: "Comida a fiado", quantity: 1, unitPriceCents: 5000 }],
        cashCents: 0,
        creditCents: 5000,
        customerName: "Juan",
      },
    });
    juanOrder = sale.json?.order;
    juanCredit = juanOrder?.creditId;
    check(
      "real: venta fiada a Juan responde 201 con crédito",
      sale.status === 201 && Boolean(juanOrder?.id) && Boolean(juanCredit),
      `${sale.status} · ${juanOrder?.id ?? "?"} · ${juanCredit ?? "?"}`,
    );
    const juanCreditRow = rows(realDb, "SELECT * FROM credits WHERE id = ?", [juanCredit])[0];
    const juanCustomerRow = rows(realDb, "SELECT * FROM customers WHERE id = ?", [
      juanCreditRow?.customer_id,
    ])[0];
    check(
      "real: el crédito de Juan es real (demo=0)",
      Number(juanCreditRow?.demo) === 0,
      `credit=${JSON.stringify(juanCreditRow)}`,
    );
    check(
      "real: Juan usa un cliente real, no el fixture demo",
      Boolean(juanCustomerRow) &&
        Number(juanCustomerRow.demo) === 0 &&
        !String(juanCustomerRow.id).startsWith("demo_") &&
        juanCustomerRow.name === "Juan",
      JSON.stringify(juanCustomerRow),
    );
    const listed = await api(REAL_BASE, "/api/credits");
    check(
      "real: /api/credits muestra el crédito real de Juan",
      listed.status === 200 &&
        (listed.json?.credits ?? []).some((credit) => credit.id === juanCredit),
      `${listed.status} · ${(listed.json?.credits ?? []).length} créditos`,
    );
    const detail = await api(REAL_BASE, `/api/orders/${juanOrder.id}`);
    check(
      "real: el detalle del pedido muestra el crédito de Juan",
      detail.status === 200 && detail.json?.credit?.id === juanCredit,
      `${detail.status} · ${JSON.stringify(detail.json?.credit ?? null)}`,
    );

    const beforePay = await api(REAL_BASE, `/api/orders/${juanOrder.id}`, {
      method: "PATCH",
      body: { action: "fulfill" },
    });
    check(
      "real: fulfill con fiado abierto responde 409 credit_open",
      beforePay.status === 409 && beforePay.json?.code === "credit_open",
      `${beforePay.status} · ${beforePay.json?.code ?? ""}`,
    );

    const pay = await api(REAL_BASE, `/api/credits/${juanCredit}/pay`, {
      method: "POST",
      body: {
        amountCents: 5000,
        method: "cash",
        requestId: "demo-real-juan-pay",
      },
    });
    check(
      "real: /api/credits/<id>/pay cobra el crédito real",
      pay.status === 200 && pay.json?.balanceCents === 0,
      `${pay.status} · ${JSON.stringify(pay.json ?? null).slice(0, 200)}`,
    );

    const afterPay = await api(REAL_BASE, `/api/orders/${juanOrder.id}`, {
      method: "PATCH",
      body: { action: "fulfill" },
    });
    check(
      "real: tras cobrar, fulfill responde 200 fulfilled",
      afterPay.status === 200 && afterPay.json?.order?.status === "fulfilled",
      `${afterPay.status} · ${afterPay.json?.order?.status ?? ""}`,
    );

    // 2b. RequestId demo en real: no devuelve ni reutiliza el pedido demo.
    const cross = await api(REAL_BASE, "/api/orders", {
      method: "POST",
      body: {
        items: [{ description: "Venta demo cruzada", quantity: 1, unitPriceCents: 1000 }],
        cashCents: 1000,
        requestId: "demo-real-cross-request",
      },
    });
    const crossRows = rows(
      realDb,
      "SELECT id, demo FROM orders WHERE request_id = 'demo-real-cross-request'",
    );
    check(
      "real: requestId de demo responde 409 request_id_conflict",
      cross.status === 409 && cross.json?.code === "request_id_conflict",
      `${cross.status} · ${cross.json?.code ?? ""}`,
    );
    check(
      "real: el requestId cruzado no crea otro pedido",
      crossRows.length === 1 && crossRows[0].id === demoCross?.id && Number(crossRows[0].demo) === 1,
      JSON.stringify(crossRows),
    );

    // 2c. Link/QR demo no resuelven pedidos reales.
    const linkEvent = await sendWebhook({
      type: "payment_link.status_updated",
      paymentLinkId: demoLinkOrder?.paymentLinkId,
      status: "paid",
      // Un pedido real como clientReferenceId + un link demo: el link debe
      // quedar oculto por el filtro de modo y resolver 404.
      clientReferenceId: juanOrder?.id,
      currency: "MXN",
      transactions: [
        { transactionId: `txn_${crypto.randomUUID()}`, paymentMethod: "CODI", amount: 20 },
      ],
    });
    check(
      "real: webhook con paymentLinkId demo responde 404",
      linkEvent.status === 404,
      `${linkEvent.status} · ${linkEvent.text.slice(0, 120)}`,
    );

    const qrEvent = await sendWebhook({
      type: "codi.qr.payment_received",
      amount: 30,
      currency: "MXN",
      numRef: demoQrOrder?.numRef,
      transactionId: `txn_${crypto.randomUUID()}`,
    });
    check(
      "real: webhook con numRef demo responde 404",
      qrEvent.status === 404,
      `${qrEvent.status} · ${qrEvent.text.slice(0, 120)}`,
    );

    // 2d. Metas y pendientes demo filtrados.
    const goals = await api(REAL_BASE, "/api/goals");
    const contribute = await api(REAL_BASE, `/api/goals/${demoGoal?.id}/contribute`, {
      method: "POST",
      body: {
        amountCents: 100,
        requestId: "demo-real-goal-contribute",
      },
    });
    const tasks = await api(REAL_BASE, "/api/tasks");
    check(
      "real: /api/goals oculta la meta demo",
      goals.status === 200 &&
        !(goals.json?.goals ?? []).some((goal) => goal.id === demoGoal?.id),
      `${goals.status} · ${(goals.json?.goals ?? []).length} metas`,
    );
    check(
      "real: aportar a una meta demo responde 404",
      contribute.status === 404,
      `${contribute.status} · ${contribute.json?.code ?? ""}`,
    );
    check(
      "real: /api/tasks oculta el pendiente demo",
      tasks.status === 200 &&
        !(tasks.json?.tasks ?? []).some((task) => task.id === demoTask?.id),
      `${tasks.status} · ${(tasks.json?.tasks ?? []).length} pendientes`,
    );

    // 2e. Datos reales para el reset: efectivo, corte, meta y pendiente.
    const cash = await api(REAL_BASE, "/api/orders", {
      method: "POST",
      body: {
        items: [{ description: "Venta real en efectivo", quantity: 1, unitPriceCents: 1200 }],
        cashCents: 1200,
        requestId: "demo-real-cash-sale",
      },
    });
    cashSale = cash.json?.order;
    const goal = await api(REAL_BASE, "/api/goals", {
      method: "POST",
      body: { title: "Meta real que no se borra", targetCents: 50000 },
    });
    realGoal = goal.json?.goal;
    const task = await api(REAL_BASE, "/api/tasks", {
      method: "POST",
      body: { title: "Pendiente real que no se borra", dueAt: "2026-12-31" },
    });
    realTask = task.json?.task;

    const preview = await api(REAL_BASE, "/api/cash/preview", {
      method: "POST",
      body: {
        openingCents: 0,
        expensesCents: 0,
        withdrawalsCents: 0,
        countedCents: 1200,
        baseNextCents: 500,
      },
    });
    const close = await api(REAL_BASE, "/api/cash/close", {
      method: "POST",
      body: {
        openingCents: 0,
        expensesCents: 0,
        withdrawalsCents: 0,
        countedCents: 1200,
        baseNextCents: 500,
        expectedVersion: 0,
        previewFingerprint: preview.json?.preview?.fingerprint ?? "",
        requestId: "demo-real-close-request",
      },
    });
    realCloseId = close.json?.close?.id;
    check(
      "real: venta en efectivo, corte, meta y pendiente creados",
      cash.status === 201 &&
        cashSale?.status === "paid" &&
        goal.status === 201 &&
        task.status === 201 &&
        close.status === 200 &&
        Boolean(realCloseId),
      `${cash.status}/${goal.status}/${task.status}/${close.status}`,
    );
  } catch (error) {
    check("real: flujo sin excepción", false, String(error));
    console.error(readLog(realServer));
  } finally {
    stopServer(realServer);
  }

  // -------------------------------------------------------------------
  // 3 · Reset en demo sobre la base con datos reales: 409 sin FORCE.
  // -------------------------------------------------------------------
  demoServer = startServer({ port: DEMO_PORT, dbPath: realDb, demoMode: true, force: false });
  try {
    await waitForServer(DEMO_BASE);
    const blocked = await api(DEMO_BASE, "/api/demo/reset", { method: "POST" });
    const preserved = rows(realDb, "SELECT id FROM orders WHERE id = ?", [cashSale?.id]);
    check(
      "reset: con datos reales sin FORCE responde 409 real_data_present",
      blocked.status === 409 && blocked.json?.code === "real_data_present",
      `${blocked.status} · ${blocked.json?.code ?? ""}`,
    );
    check(
      "reset: el bloqueo conserva la venta real en efectivo",
      preserved.length === 1,
      `cashSale=${cashSale?.id ?? "?"}`,
    );
    check(
      "reset: el bloqueo reporta el desglose de datos reales",
      Number(blocked.json?.realData) >= 4 &&
        Number(blocked.json?.breakdown?.orders) >= 2,
      JSON.stringify(blocked.json ?? null).slice(0, 240),
    );
  } catch (error) {
    check("reset bloqueado: sin excepción", false, String(error));
    console.error(readLog(demoServer));
  } finally {
    stopServer(demoServer);
  }

  // -------------------------------------------------------------------
  // 4 · FORCE: borra solo demo y conserva TODO lo real.
  // -------------------------------------------------------------------
  demoServer = startServer({ port: DEMO_PORT, dbPath: realDb, demoMode: true, force: true });
  try {
    await waitForServer(DEMO_BASE);
    const forced = await api(DEMO_BASE, "/api/demo/reset", { method: "POST" });
    check(
      "reset FORCE: responde 200",
      forced.status === 200 && forced.json?.ok === true,
      `${forced.status} · ${JSON.stringify(forced.json ?? null).slice(0, 160)}`,
    );

    const realCashOrder = rows(realDb, "SELECT id, demo, status FROM orders WHERE id = ?", [
      cashSale?.id,
    ])[0];
    const realCashPayment = rows(
      realDb,
      "SELECT id, demo FROM payments WHERE order_id = ?",
      [cashSale?.id],
    )[0];
    const realClose = rows(realDb, "SELECT id, demo FROM cash_closes WHERE id = ?", [
      realCloseId,
    ])[0];
    const realGoalRow = rows(realDb, "SELECT id, demo FROM goals WHERE id = ?", [
      realGoal?.id,
    ])[0];
    const realTaskRow = rows(realDb, "SELECT id, demo FROM tasks WHERE id = ?", [
      realTask?.id,
    ])[0];
    check(
      "reset FORCE: conserva la venta real en efectivo y su pago",
      Number(realCashOrder?.demo) === 0 &&
        realCashOrder?.status === "paid" &&
        Number(realCashPayment?.demo) === 0,
      JSON.stringify({ order: realCashOrder, payment: realCashPayment }),
    );
    check(
      "reset FORCE: conserva el corte real",
      Number(realClose?.demo) === 0,
      JSON.stringify(realClose),
    );
    check(
      "reset FORCE: conserva la meta real",
      Number(realGoalRow?.demo) === 0,
      JSON.stringify(realGoalRow),
    );
    check(
      "reset FORCE: conserva el pendiente real",
      Number(realTaskRow?.demo) === 0,
      JSON.stringify(realTaskRow),
    );

    const realCredit = rows(realDb, "SELECT id, demo, customer_id FROM credits WHERE id = ?", [
      juanCredit,
    ])[0];
    const realCustomer = rows(realDb, "SELECT id, demo, name FROM customers WHERE id = ?", [
      realCredit?.customer_id,
    ])[0];
    check(
      "reset FORCE: conserva el crédito real y su cliente real",
      Number(realCredit?.demo) === 0 &&
        Number(realCustomer?.demo) === 0 &&
        realCustomer?.name === "Juan",
      JSON.stringify({ credit: realCredit, customer: realCustomer }),
    );

    check(
      "reset FORCE: borra el pedido demo con su requestId",
      rows(realDb, "SELECT id FROM orders WHERE id = ?", [demoCross?.id]).length === 0,
      `demoOrder=${demoCross?.id ?? "?"}`,
    );
    check(
      "reset FORCE: borra meta y pendiente demo",
      rows(realDb, "SELECT id FROM goals WHERE id = ?", [demoGoal?.id]).length === 0 &&
        rows(realDb, "SELECT id FROM tasks WHERE id = ?", [demoTask?.id]).length === 0,
      JSON.stringify({ goal: demoGoal?.id, task: demoTask?.id }),
    );
    const demoFixtures = rows(
      realDb,
      "SELECT id FROM orders WHERE demo = 1 AND id LIKE 'demo_hist_%'",
    );
    const demoGoals = rows(realDb, "SELECT id FROM goals WHERE demo = 1");
    const demoJuans = rows(
      realDb,
      "SELECT id, demo FROM customers WHERE lower(name) = 'juan' ORDER BY demo",
    );
    check(
      "reset FORCE: vuelve a sembrar fixtures demo",
      demoFixtures.length > 0 && demoGoals.length > 0,
      `orders=${demoFixtures.length} goals=${demoGoals.length}`,
    );
    check(
      "reset FORCE: Juan demo y Juan real conviven sin mezclarse",
      demoJuans.length === 2 &&
        demoJuans.some((row) => Number(row.demo) === 0) &&
        demoJuans.some((row) => Number(row.demo) === 1),
      JSON.stringify(demoJuans),
    );
  } catch (error) {
    check("reset FORCE: sin excepción", false, String(error));
    console.error(readLog(demoServer));
  } finally {
    stopServer(demoServer);
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      // La evidencia queda en el reporte, no en el temporal.
    }
  }

  const failed = results.filter((result) => !result.ok);
  console.log("");
  console.log(
    `P0 DEMO→REAL · ${checks - failures} PASS · ${failures} FAIL · ${checks} checks`,
  );
  if (failed.length > 0) {
    for (const result of failed) {
      console.log(`  - ${result.name}${result.detail ? ` · ${result.detail}` : ""}`);
    }
  }
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error("");
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
