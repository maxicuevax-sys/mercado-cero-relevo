#!/usr/bin/env node
/**
 * Contrato A-J de POST /api/demo/pay (dos procesos, SQLite temporal).
 * Uso: node scripts/p0-demo-pay-contract.mjs
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
const BASE_PORT = Number(process.env.P0_DEMO_PAY_PORT ?? 3331);
const REAL_PORT = BASE_PORT;
const DEMO_A = BASE_PORT + 1;
const DEMO_B = BASE_PORT + 2;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mercado-cero-demo-pay-"));
const dbPath = path.join(tmp, "demo-pay.db");
const backupDir = path.join(tmp, "backups");
const buildShaFile = path.join(WEB, ".next", "BUILD_SHA");
const servers = new Map();
let expectedSha = null;
let failures = 0;
let checks = 0;

function check(name, condition, detail = "") {
  checks += 1;
  if (condition) {
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function portAvailable(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.unref();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => probe.close(() => resolve(true)));
    probe.listen(port, "127.0.0.1");
  });
}

async function start(name, port, demo) {
  if (!(await portAvailable(port))) throw new Error(`puerto ${port} ocupado`);
  const child = spawn(
    process.execPath,
    [NEXT_BIN, "start", "-H", "127.0.0.1", "-p", String(port)],
    {
      cwd: WEB,
      env: {
        ...process.env,
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        DEMO_MODE: demo ? "true" : "false",
        DATABASE_PATH: dbPath,
        DATABASE_BACKUP_DIR: backupDir,
        APP_URL: `http://127.0.0.1:${port}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  servers.set(name, child);
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk.toString()));
  child.stderr.on("data", (chunk) => (output += chunk.toString()));
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`${name} salió: ${output}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        const health = await response.json();
        if (!health?.ok) throw new Error(`${name} health no ok`);
        if (expectedSha && health.buildSha !== expectedSha) {
          throw new Error(
            `${name} sirve build ${health.buildSha}, esperado ${expectedSha}`,
          );
        }
        return;
      }
    } catch {
      // espera
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`${name} no arrancó: ${output}`);
}

async function stop(name) {
  const child = servers.get(name);
  if (!child || child.exitCode !== null) return;
  child.kill();
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (child.exitCode === null) {
    try {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
      // best effort
    }
  }
  servers.delete(name);
}

async function api(port, pathname, body) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return { status: response.status, json };
}

function openDb() {
  return new DatabaseSync(dbPath);
}

function paymentCount(db, orderId) {
  return Number(
    db.prepare("SELECT COUNT(*) AS n FROM payments WHERE order_id = ?").get(orderId).n,
  );
}

function paymentSum(db, orderId) {
  return Number(
    db
      .prepare("SELECT COALESCE(SUM(amount_cents), 0) AS n FROM payments WHERE order_id = ? AND status = 'paid'")
      .get(orderId).n,
  );
}

function eventCount(db, key) {
  return Number(
    db.prepare("SELECT COUNT(*) AS n FROM payment_events WHERE idempotency_key = ?").get(key).n,
  );
}

function eventRow(db, key) {
  return db
    .prepare("SELECT id, result, payload_hash, payload FROM payment_events WHERE idempotency_key = ?")
    .get(key);
}

async function createOrder(port, label, total = 10000) {
  const result = await api(port, "/api/orders", {
    items: [{ description: label, quantity: 1, unitPriceCents: total }],
    requestId: `audit_${label.replaceAll(" ", "_")}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  });
  if (result.status !== 201 || !result.json?.order) {
    throw new Error(`No se pudo crear orden: ${JSON.stringify(result)}`);
  }
  return result.json.order;
}

async function main() {
  if (!fs.existsSync(path.join(WEB, ".next", "BUILD_ID"))) {
    throw new Error("Falta build; ejecuta npm run build");
  }
  if (!fs.existsSync(buildShaFile)) {
    throw new Error("Falta .next/BUILD_SHA; ejecuta npm run build");
  }
  expectedSha = JSON.parse(fs.readFileSync(buildShaFile, "utf8")).sha;
  const head = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: WEB,
    encoding: "utf8",
  }).stdout.trim();
  const dirty = spawnSync("git", ["status", "--porcelain"], {
    cwd: WEB,
    encoding: "utf8",
  }).stdout.trim();
  check(
    "0. buildSha sellado desde HEAD",
    expectedSha === head,
    `${String(expectedSha).slice(0, 12)} vs ${head.slice(0, 12)}`,
  );
  check(
    "0b. árbol limpio para evidencia",
    dirty === "" || process.env.DEMO_PAY_ALLOW_DIRTY === "1",
    dirty
      ? `${dirty.split("\n").length} ruta(s) sucia(s)`
      : "limpio",
  );

  console.log(`DEMO PAY CONTRACT — DB ${dbPath}`);

  await start("real", REAL_PORT, false);
  const realOrder = await createOrder(REAL_PORT, "Real", 10000);
  const realDemoAttempt = await api(REAL_PORT, "/api/demo/pay", {
    orderId: realOrder.id,
    method: "card",
  });
  check("J. modo real rechaza demo/pay", realDemoAttempt.status === 403 && realDemoAttempt.json?.code === "demo_disabled", `${realDemoAttempt.status}`);
  await stop("real");

  await start("A", DEMO_A, true);
  await start("B", DEMO_B, true);

  const db0 = openDb();
  check("A0. pedido real existe con demo=0", Number(db0.prepare("SELECT demo FROM orders WHERE id = ?").get(realOrder.id).demo) === 0);
  db0.close();

  const nonDemo = await api(DEMO_A, "/api/demo/pay", {
    orderId: realOrder.id,
    method: "card",
  });
  check("A. demo/pay rechaza pedido real", nonDemo.status === 409 && nonDemo.json?.code === "demo_order_required", `${nonDemo.status} ${nonDemo.json?.code}`);
  let db = openDb();
  check("A. pedido real sin pagos demo", paymentCount(db, realOrder.id) === 0);
  check("A. pedido real no cambia de estado", db.prepare("SELECT status FROM orders WHERE id = ?").get(realOrder.id).status !== "demo_paid");
  db.close();

  const demoOrder = await createOrder(DEMO_A, "Demo valido", 10000);
  const validReq = `demo_req_${Date.now()}`;
  const valid = await api(DEMO_A, "/api/demo/pay", { orderId: demoOrder.id, method: "card", requestId: validReq });
  check("B. primera operación demo válida", valid.status === 200 && valid.json?.order?.status === "demo_paid", `${valid.status} ${valid.json?.order?.status}`);
  db = openDb();
  const validKey = `demo:pay:v1:req:lupita:${validReq}`;
  check("B. un solo pago", paymentCount(db, demoOrder.id) === 1 && paymentSum(db, demoOrder.id) === 10000);
  check("B. un solo evento processed", eventCount(db, validKey) === 1 && eventRow(db, validKey)?.result === "processed");
  db.close();

  const retry = await api(DEMO_B, "/api/demo/pay", { orderId: demoOrder.id, method: "card", requestId: validReq });
  check("C. reintento idéntico", retry.status === 200 && retry.json?.duplicate === true, `${retry.status} duplicate=${retry.json?.duplicate}`);
  db = openDb();
  check("C. reintento sin pago nuevo", paymentCount(db, demoOrder.id) === 1 && eventCount(db, validKey) === 1);
  db.close();

  const otherMethod = await api(DEMO_A, "/api/demo/pay", { orderId: demoOrder.id, method: "codi", requestId: validReq });
  check("D. misma requestId con otro método → 409", otherMethod.status === 409 && otherMethod.json?.code === "idempotency_conflict", `${otherMethod.status} ${otherMethod.json?.code}`);

  const otherOrder = await createOrder(DEMO_A, "Otra orden", 5000);
  const otherOrderAttempt = await api(DEMO_A, "/api/demo/pay", { orderId: otherOrder.id, method: "card", requestId: validReq });
  check("D2. misma requestId con otro pedido → 409", otherOrderAttempt.status === 409 && otherOrderAttempt.json?.code === "idempotency_conflict", `${otherOrderAttempt.status} ${otherOrderAttempt.json?.code}`);

  const missing = await api(DEMO_A, "/api/demo/pay", { orderId: "ord_no_existe", method: "card" });
  check("E. pedido inexistente → 404", missing.status === 404, `${missing.status}`);

  const invalidMethod = await api(DEMO_A, "/api/demo/pay", { orderId: demoOrder.id, method: "cash" });
  check("E2. método inválido → 400", invalidMethod.status === 400, `${invalidMethod.status}`);

  const settled = await api(DEMO_A, "/api/demo/pay", { orderId: demoOrder.id, method: "card" });
  check("F. pedido ya completado sin llave → 200 no-op", settled.status === 200 && settled.json?.alreadySettled === true, `${settled.status} alreadySettled=${settled.json?.alreadySettled}`);
  db = openDb();
  check("F. no-op no crea pago", paymentCount(db, demoOrder.id) === 1);
  db.close();

  let raceOrder = null;
  let raceReq = null;
  let raceKey = null;
  for (let round = 0; round < 6; round += 1) {
    raceOrder = await createOrder(DEMO_A, `Carrera ${round + 1}`, 10000);
    raceReq = `demo_race_${Date.now()}_${round}`;
    raceKey = `demo:pay:v1:req:lupita:${raceReq}`;
    const [raceA, raceB] = await Promise.all([
      api(DEMO_A, "/api/demo/pay", { orderId: raceOrder.id, method: "card", requestId: raceReq }),
      api(DEMO_B, "/api/demo/pay", { orderId: raceOrder.id, method: "card", requestId: raceReq }),
    ]);
    const raceCodes = [raceA.status, raceB.status];
    check(
      `G${round + 1}. dos procesos no duplican`,
      raceCodes.every((code) => code === 200 || code === 503),
      JSON.stringify(raceCodes),
    );
    if (raceCodes.includes(503)) {
      const retry = await api(DEMO_A, "/api/demo/pay", { orderId: raceOrder.id, method: "card", requestId: raceReq });
      check(`G${round + 1}. reintento tras 503 es coherente`, retry.status === 200 || retry.status === 409, `${retry.status}`);
    }
    db = openDb();
    check(
      `G${round + 1}. un solo pago tras carrera`,
      paymentCount(db, raceOrder.id) === 1 && paymentSum(db, raceOrder.id) === 10000,
      `payments=${paymentCount(db, raceOrder.id)}`,
    );
    check(`G${round + 1}. un solo evento tras carrera`, eventCount(db, raceKey) === 1);
    db.close();
  }

  // Carrera con la llave automática (clientes que no envían requestId).
  const autoRaceOrder = await createOrder(DEMO_A, "Carrera auto", 10000);
  const [autoA, autoB] = await Promise.all([
    api(DEMO_A, "/api/demo/pay", { orderId: autoRaceOrder.id, method: "card" }),
    api(DEMO_B, "/api/demo/pay", { orderId: autoRaceOrder.id, method: "card" }),
  ]);
  check(
    "G7. dos procesos con llave automática no duplican",
    [autoA.status, autoB.status].every((code) => code === 200 || code === 503),
    JSON.stringify([autoA.status, autoB.status]),
  );
  db = openDb();
  const autoRaceKey = `demo:pay:v1:auto:lupita:${autoRaceOrder.id}:10000`;
  check(
    "G7. un solo pago con llave automática",
    paymentCount(db, autoRaceOrder.id) === 1 && paymentSum(db, autoRaceOrder.id) === 10000,
  );
  check("G7. un solo evento automático", eventCount(db, autoRaceKey) === 1);
  db.close();

  // Dos requestId distintos, mismo pedido: el lock + saldo evita el doble pago.
  const differentKeyOrder = await createOrder(DEMO_A, "Carrera llaves distintas", 10000);
  const reqA = `demo_diff_a_${Date.now()}`;
  const reqB = `demo_diff_b_${Date.now()}`;
  const [diffA, diffB] = await Promise.all([
    api(DEMO_A, "/api/demo/pay", { orderId: differentKeyOrder.id, method: "card", requestId: reqA }),
    api(DEMO_B, "/api/demo/pay", { orderId: differentKeyOrder.id, method: "card", requestId: reqB }),
  ]);
  check(
    "G8. dos llaves distintas no duplican el pago",
    [diffA.status, diffB.status].every((code) => code === 200 || code === 503 || code === 409),
    JSON.stringify([diffA.status, diffB.status]),
  );
  db = openDb();
  check(
    "G8. un solo pago con llaves distintas",
    paymentCount(db, differentKeyOrder.id) === 1 && paymentSum(db, differentKeyOrder.id) === 10000,
  );
  db.close();

  await stop("A");
  await stop("B");
  await start("A", DEMO_A, true);
  await start("B", DEMO_B, true);
  const restart = await api(DEMO_A, "/api/demo/pay", { orderId: raceOrder.id, method: "card", requestId: raceReq });
  check("H. reinicio + reintento devuelve replay", restart.status === 200 && restart.json?.duplicate === true, `${restart.status} duplicate=${restart.json?.duplicate}`);
  db = openDb();
  check("H. reinicio no duplica pago", paymentCount(db, raceOrder.id) === 1 && eventCount(db, raceKey) === 1);
  check("H. paid_cents no supera total", Number(db.prepare("SELECT paid_cents FROM orders WHERE id = ?").get(raceOrder.id).paid_cents) === 10000);
  db.close();

  // Evento/pago huérfano: no debe quedar un pago sin evento ni un evento sin pago.
  const noKeyOrder = await createOrder(DEMO_A, "Sin llave", 10000);
  const noKey = await api(DEMO_A, "/api/demo/pay", { orderId: noKeyOrder.id, method: "wallet" });
  check("I. pago sin requestId funciona con llave automática", noKey.status === 200 && noKey.json?.order?.status === "demo_paid", `${noKey.status}`);
  db = openDb();
  const autoKey = `demo:pay:v1:auto:lupita:${noKeyOrder.id}:10000`;
  check("I. evento automático único", eventCount(db, autoKey) === 1 && eventRow(db, autoKey)?.result === "processed");
  check("I. pago automático único", paymentCount(db, noKeyOrder.id) === 1);
  db.close();

  // Atomicidad: si el INSERT del pago falla, no queda evento ni pago.
  const atomicOrder = await createOrder(DEMO_A, "Atomicidad", 7000);
  const atomicReq = `demo_atomic_${Date.now()}`;
  await stop("A");
  await stop("B");
  db = openDb();
  db.exec("DROP TRIGGER IF EXISTS fail_demo_payment");
  db.exec("CREATE TRIGGER fail_demo_payment BEFORE INSERT ON payments BEGIN SELECT RAISE(ABORT, 'forced_demo_failure'); END;");
  db.close();
  await start("A", DEMO_A, true);
  const atomic = await api(DEMO_A, "/api/demo/pay", { orderId: atomicOrder.id, method: "card", requestId: atomicReq });
  check("K. fallo de pago responde 500 seguro", atomic.status === 500, `${atomic.status}`);
  await stop("A");
  db = openDb();
  db.exec("DROP TRIGGER IF EXISTS fail_demo_payment");
  const atomicKey = `demo:pay:v1:req:lupita:${atomicReq}`;
  check("K. fallo atómico no deja evento", eventCount(db, atomicKey) === 0);
  check("K. fallo atómico no deja pago", paymentCount(db, atomicOrder.id) === 0);
  check(
    "K. pedido conserva estado y saldo",
    db.prepare("SELECT status, paid_cents FROM orders WHERE id = ?").get(atomicOrder.id).status === "confirmed" &&
      Number(db.prepare("SELECT paid_cents FROM orders WHERE id = ?").get(atomicOrder.id).paid_cents) === 0,
  );
  db.close();

  // Lock externo de una tercera conexión: el servidor debe fallar seguro (503)
  // y el reintento posterior debe cobrar una sola vez.
  await start("A", DEMO_A, true);
  await start("B", DEMO_B, true);
  const lockOrder = await createOrder(DEMO_A, "Lock externo", 10000);
  const lockReq = `demo_lock_${Date.now()}`;
  const locker = openDb();
  locker.exec("BEGIN IMMEDIATE");
  const lockStarted = Date.now();
  const busy = await api(DEMO_A, "/api/demo/pay", {
    orderId: lockOrder.id,
    method: "card",
    requestId: lockReq,
  });
  const lockWaitMs = Date.now() - lockStarted;
  check(
    "L. lock externo responde 503 seguro",
    busy.status === 503 && busy.json?.code === "demo_pay_busy",
    `${busy.status} ${busy.json?.code ?? ""} tras ${lockWaitMs}ms`,
  );
  locker.exec("ROLLBACK");
  locker.close();
  const recovered = await api(DEMO_A, "/api/demo/pay", {
    orderId: lockOrder.id,
    method: "card",
    requestId: lockReq,
  });
  check(
    "L. reintento tras liberar lock cobra una vez",
    recovered.status === 200 && recovered.json?.duplicate === false,
    `${recovered.status} duplicate=${recovered.json?.duplicate}`,
  );
  db = openDb();
  const lockKey = `demo:pay:v1:req:lupita:${lockReq}`;
  check(
    "L. un solo pago tras lock",
    paymentCount(db, lockOrder.id) === 1 && paymentSum(db, lockOrder.id) === 10000,
  );
  check("L. un solo evento tras lock", eventCount(db, lockKey) === 1);
  db.close();

  // Invariantes globales del flujo demo.
  db = openDb();
  const demoPaidReal = Number(
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM orders WHERE demo = 0 AND status = 'demo_paid'",
      )
      .get().n,
  );
  check("M. ningún pedido real terminó demo_paid", demoPaidReal === 0, `${demoPaidReal}`);
  const overpaid = Number(
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM orders WHERE paid_cents > total_cents + credit_cents",
      )
      .get().n,
  );
  check("M. ningún pedido sobrepagado", overpaid === 0, `${overpaid}`);
  const processedEvents = db
    .prepare(
      "SELECT payload FROM payment_events WHERE result = 'processed' AND idempotency_key LIKE 'demo:pay:v1:%'",
    )
    .all();
  let eventsWithoutPayment = 0;
  for (const event of processedEvents) {
    const payload = JSON.parse(event.payload);
    const found = Number(
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM payments WHERE transaction_id = ? AND status = 'paid'",
        )
        .get(payload.transactionId).n,
    );
    if (found !== 1) eventsWithoutPayment += 1;
  }
  check(
    "M. todo evento procesado tiene su pago",
    eventsWithoutPayment === 0,
    `${eventsWithoutPayment} huérfano(s)`,
  );
  const demoPayments = db
    .prepare(
      `SELECT p.transaction_id AS transactionId
       FROM payments p JOIN orders o ON o.id = p.order_id
       WHERE o.demo = 1 AND p.transaction_id LIKE 'demo_txn_%'`,
    )
    .all();
  let paymentsWithoutEvent = 0;
  for (const payment of demoPayments) {
    const found = Number(
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM payment_events WHERE json_extract(payload, '$.transactionId') = ?",
        )
        .get(payment.transactionId).n,
    );
    if (found !== 1) paymentsWithoutEvent += 1;
  }
  check(
    "M. todo pago demo tiene su evento",
    paymentsWithoutEvent === 0,
    `${paymentsWithoutEvent} huérfano(s)`,
  );
  db.close();

  console.log(`\nDEMO PAY CONTRACT — ${checks - failures} PASS · ${failures} FAIL`);
  fs.writeFileSync(
    path.join(tmp, "result.json"),
    JSON.stringify({ checks, failures, dbPath }, null, 2),
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([...servers.keys()].map((name) => stop(name)));
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      // Windows puede tardar en soltar WAL.
    }
  });
