import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import crypto from "node:crypto";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "..", "src");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-qr-sync-test-"));
process.env.DATABASE_PATH = path.join(tmpDir, "test-qr-sync.db");
process.env.DATABASE_BACKUP_DIR = path.join(tmpDir, "backups");

const transpiledCache = new Map();

function transpileToTmp(srcRelativePath) {
  const normalized = srcRelativePath.replace(/\\/g, "/");
  if (transpiledCache.has(normalized)) {
    return transpiledCache.get(normalized);
  }
  const absIn = path.join(SRC, normalized);
  const absOut = path.join(
    tmpDir,
    "transpiled",
    normalized.replace(/\.ts$/, ".mjs"),
  );
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  transpiledCache.set(normalized, absOut);

  let source = fs.readFileSync(absIn, "utf8");
  source = source.replace(
    /from\s+["'](@\/lib\/[A-Za-z0-9_-]+|\.[./A-Za-z0-9_-]+)["']/g,
    (full, spec) => {
      let targetRel;
      if (spec.startsWith("@/lib/")) {
        targetRel = `lib/${spec.slice("@/lib/".length)}.ts`;
      } else if (spec.startsWith(".")) {
        const resolved = path.resolve(path.dirname(absIn), `${spec}.ts`);
        if (!fs.existsSync(resolved)) return full;
        targetRel = path.relative(SRC, resolved).replace(/\\/g, "/");
      } else {
        return full;
      }
      const depOut = transpileToTmp(targetRel);
      let relImport = path
        .relative(path.dirname(absOut), depOut)
        .replace(/\\/g, "/");
      if (!relImport.startsWith(".")) relImport = `./${relImport}`;
      return `from "${relImport}"`;
    },
  );

  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  fs.writeFileSync(absOut, js, "utf8");
  return absOut;
}

const peyModUrl = pathToFileURL(transpileToTmp("lib/pey.ts")).href;
const dbModUrl = pathToFileURL(transpileToTmp("lib/db.ts")).href;
const ordersModUrl = pathToFileURL(transpileToTmp("lib/orders.ts")).href;
const syncRouteModUrl = pathToFileURL(
  transpileToTmp("app/api/orders/[id]/sync-pey/route.ts"),
).href;

const {
  extractCandidateTransactionIds,
  hasPeyReferenceMismatch,
  transactionBaseCents,
  validatePeyTransactionForOrder,
} = await import(peyModUrl);
const { getDb, newId, nowIso } = await import(dbModUrl);
const { attachQr, createOrder, getOrderDetail, recordPayment, recordVerifiedCreditPaymentFromPey } = await import(ordersModUrl);
const { POST: syncPeyPost } = await import(syncRouteModUrl);
const { POST: webhookPost } = await import(pathToFileURL(transpileToTmp("app/api/webhooks/pey/route.ts")).href);

test("abono firmado de fiado es atómico, idempotente y no descarta un sobrepago", async () => {
  const key = crypto.randomBytes(32);
  await withEnv({ DEMO_MODE: "false", PEY_API_KEY: "pey_test_key", PEY_WEBHOOK_SECRET: 'whsec_' + key.toString('base64') }, async () => {
    const makeCredit = () => {
      const order = createOrder({ items: [{ description: "Fiado revisión", quantity: 1, unitPriceCents: 5000 }], creditCents: 5000, customerName: "Cliente revisión" });
      return getOrderDetail(order.id).credit;
    };
    const credit = makeCredit();
    assert.ok(credit?.id);
    async function deliver(id, amount, creditId, transactionId) {
      const payload = JSON.stringify({ type: "codi.qr.payment_received", amount, currency: "MXN", transactionId, metadata: { creditId } });
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64");
      return webhookPost(new Request("http://localhost:3000/api/webhooks/pey", { method: "POST", headers: { "content-type": "application/json", "webhook-id": id, "webhook-timestamp": timestamp, "webhook-signature": `v1,${signature}` }, body: payload }));
    }
    assert.equal((await deliver("wh_credit_valid", 50, credit.id, "tx_credit_review")).status, 200);
    assert.equal(getDb().prepare("SELECT balance_cents FROM credits WHERE id=?").get(credit.id).balance_cents, 0);
    assert.equal((await deliver("wh_credit_replay", 50, credit.id, "tx_credit_review")).status, 200);
    assert.equal(getDb().prepare("SELECT count(*) AS n FROM credit_payments WHERE transaction_id=?").get("tx_credit_review").n, 1);
    const other = makeCredit();
    assert.equal((await deliver("wh_credit_conflict", 50, other.id, "tx_credit_review")).status, 409);
    assert.equal((await deliver("wh_credit_overpay", 60, other.id, "tx_credit_overpay")).status, 409);
    assert.equal(getDb().prepare("SELECT balance_cents FROM credits WHERE id=?").get(other.id).balance_cents, 5000);
    assert.equal(getDb().prepare("SELECT count(*) AS n FROM credit_payments WHERE credit_id=?").get(other.id).n, 0);
    const sale = createOrder({ items: [{ description: "Venta distinta", quantity: 1, unitPriceCents: 5000 }] });
    assert.throws(() => recordPayment(sale.id, { provider: "pey", method: "codi", amountCents: 5000, transactionId: "tx_credit_review" }), /transacción.*fiado/i);
    assert.equal(getOrderDetail(sale.id).order.paidCents, 0);
    recordPayment(sale.id, { provider: "pey", method: "codi", amountCents: 5000, transactionId: "tx_sale_review" });
    assert.throws(() => recordVerifiedCreditPaymentFromPey({ creditId: other.id, method: "codi", amountCents: 5000, transactionId: "tx_sale_review" }), /transacción.*venta/i);
    assert.equal(getDb().prepare("SELECT balance_cents FROM credits WHERE id=?").get(other.id).balance_cents, 5000);
  });
});

test("signed credit events reject ambiguous and contradictory references without ledger writes", async () => {
  const key = crypto.randomBytes(32);
  await withEnv({ DEMO_MODE: "false", PEY_API_KEY: "local-test-key", PEY_WEBHOOK_SECRET: "whsec_" + key.toString("base64") }, async () => {
    const makeCredit = () => getOrderDetail(createOrder({ items: [{ description: "Reference test", quantity: 1, unitPriceCents: 5000 }], creditCents: 5000, customerName: "Reference client" }).id).credit;
    const first = makeCredit();
    const second = makeCredit();
    const sale = createOrder({ items: [{ description: "Reference sale", quantity: 1, unitPriceCents: 5000 }] });
    getDb().prepare("UPDATE credits SET num_ref = ?, payment_link_id = ? WHERE id = ?").run("912345", "link_first_reference", first.id);
    getDb().prepare("UPDATE credits SET num_ref = ?, payment_link_id = ? WHERE id = ?").run("912346", "link_second_reference", second.id);
    attachQr(sale.id, { id: "qr_reference_sale", qrString: "reference-qr", qrImage: null }, "912345");
    const events = [
      { type: "codi.qr.payment_received", amount: 50, numRef: "912345", metadata: { orderId: sale.id } },
      { type: "codi.qr.payment_received", amount: 50, numRef: "912346", metadata: { creditId: first.id, orderId: first.orderId } },
      { type: "codi.qr.payment_received", amount: 50, metadata: { creditId: first.id, externalMetadata: { creditId: second.id } } },
      { type: "codi.qr.payment_received", amount: 50, metadata: { orderId: sale.id, externalMetadata: { orderId: first.orderId } } },
      { type: "payment_link.status_updated", status: "paid", paymentLinkId: "link_second_reference", clientReferenceId: `cred_${first.id}`, metadata: { creditId: first.id }, transactions: [{ transactionId: "tx_reference_link", amount: 50, currency: "MXN" }] },
    ];
    for (const [index, event] of events.entries()) {
      const id = `wh_reference_conflict_${index}`;
      const payload = JSON.stringify({ ...event, currency: "MXN", transactionId: `tx_reference_${index}` });
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64");
      const response = await webhookPost(new Request("http://localhost:3000/api/webhooks/pey", { method: "POST", headers: { "webhook-id": id, "webhook-timestamp": timestamp, "webhook-signature": `v1,${signature}` }, body: payload }));
      assert.equal(response.status, 409, `conflicting event ${index}`);
      assert.equal(getDb().prepare("SELECT balance_cents FROM credits WHERE id = ?").get(first.id).balance_cents, 5000);
      assert.equal(getDb().prepare("SELECT balance_cents FROM credits WHERE id = ?").get(second.id).balance_cents, 5000);
      assert.equal(getOrderDetail(sale.id).order.paidCents, 0);
      assert.equal(getDb().prepare("SELECT COUNT(*) AS n FROM credit_payments WHERE credit_id IN (?, ?)").get(first.id, second.id).n, 0);
    }
    // Matching credit references remain accepted, including its parent sale.
    const validId = "wh_reference_valid";
    const validPayload = JSON.stringify({ type: "payment_link.status_updated", status: "paid", currency: "MXN", paymentLinkId: "link_second_reference", clientReferenceId: `cred_${second.id}`, metadata: { creditId: second.id, orderId: second.orderId }, transactions: [{ transactionId: "tx_reference_valid", amount: 50, currency: "MXN" }] });
    const validTimestamp = String(Math.floor(Date.now() / 1000));
    const validSignature = crypto.createHmac("sha256", key).update(`${validId}.${validTimestamp}.${validPayload}`).digest("base64");
    const validResponse = await webhookPost(new Request("http://localhost:3000/api/webhooks/pey", { method: "POST", headers: { "webhook-id": validId, "webhook-timestamp": validTimestamp, "webhook-signature": `v1,${validSignature}` }, body: validPayload }));
    assert.equal(validResponse.status, 200);
    assert.equal(getDb().prepare("SELECT balance_cents FROM credits WHERE id = ?").get(second.id).balance_cents, 0);
  });
});

test("rechaza moneda ausente aunque importe y referencia coincidan", () => {
  const order = { id: "ord_currency", qrId: "qr_currency", numRef: "123456" };
  const tx = { id: "tx_currency", status: "PAID", amount: 50, payableType: "API_CODI_QR", payableId: "qr_currency", metadata: { orderId: order.id } };
  assert.deepEqual(validatePeyTransactionForOrder(order, tx, 5000), { ok: false, reason: "currency_mismatch" });
});

async function withEnv(overrides, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    if (value === undefined || value === null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("extractCandidateTransactionIds extrae transactionId de QR CoDi y Payment Links ignorando JSON corrupto", () => {
  const payloads = [
    "",
    "   ",
    "{json-corrupto",
    "null",
    "[]",
    JSON.stringify({
      type: "codi.qr.payment_received",
      transactionId: "tx_qr_001",
      numRef: "123456",
      amount: 85.5,
      currency: "MXN",
    }),
    JSON.stringify({
      type: "codi.pn.payment_received",
      transactionId: "  tx_pn_002  ",
      numRef: "654321",
    }),
    JSON.stringify({
      type: "payment_link.status_updated",
      paymentLinkId: "plink_1",
      status: "paid",
      transactions: [
        { transactionId: "tx_link_003", amount: 85.5 },
        { transactionId: "tx_qr_001", amount: 85.5 },
        { transactionId: "" },
        null,
      ],
    }),
    JSON.stringify({
      data: {
        transactionId: "tx_nested_004",
        transactions: [{ transactionId: "tx_nested_005" }],
      },
    }),
  ];

  const ids = extractCandidateTransactionIds(payloads);
  assert.deepEqual(ids, [
    "tx_qr_001",
    "tx_pn_002",
    "tx_link_003",
    "tx_nested_004",
    "tx_nested_005",
  ]);
});

test("transactionBaseCents prioriza amountBreakdown.base con precisión de centavos y rechaza montos inválidos", () => {
  assert.equal(
    transactionBaseCents({
      amount: 115.5,
      amountBreakdown: { base: 100.25, tip: 10, fee: 5.25 },
    }),
    10025,
  );
  assert.equal(transactionBaseCents({ amount: 49.99 }), 4999);
  assert.equal(transactionBaseCents({ amount: "19.95" }), 1995);
  assert.equal(transactionBaseCents({ amount: 0 }), null);
  assert.equal(transactionBaseCents({ amount: -15 }), null);
  assert.equal(transactionBaseCents({ amount: "NaN" }), null);
  assert.equal(transactionBaseCents({}), null);
});

test("validatePeyTransactionForOrder y hasPeyReferenceMismatch exigen PAID, MXN, centavos exactos y referencia del pedido", () => {
  const orderTarget = {
    id: "ord_real_100",
    qrId: "qr_pey_100",
    paymentLinkId: "plink_pey_100",
    codiPushId: "pn_pey_100",
    numRef: "482910",
  };

  // Transacción QR CoDi válida
  const validQrTx = {
    id: "tx_valid_qr",
    status: "PAID",
    amount: 145.5,
    currency: "MXN",
    payableType: "API_CODI_QR",
    payableId: "qr_pey_100",
    metadata: { orderId: "ord_real_100" },
  };
  assert.equal(hasPeyReferenceMismatch(orderTarget, validQrTx), false);
  assert.deepEqual(
    validatePeyTransactionForOrder(orderTarget, validQrTx, 14550),
    { ok: true, amountCents: 14550 },
  );

  // Discrepancia por estado PENDING -> not_paid
  assert.deepEqual(
    validatePeyTransactionForOrder(
      orderTarget,
      { ...validQrTx, status: "PENDING" },
      14550,
    ),
    { ok: false, reason: "not_paid" },
  );

  // Discrepancia por moneda distinta de MXN -> currency_mismatch
  assert.deepEqual(
    validatePeyTransactionForOrder(
      orderTarget,
      { ...validQrTx, currency: "USD" },
      14550,
    ),
    { ok: false, reason: "currency_mismatch" },
  );

  // Discrepancia de 1 centavo -> amount_mismatch
  assert.deepEqual(
    validatePeyTransactionForOrder(orderTarget, validQrTx, 14551),
    { ok: false, reason: "amount_mismatch" },
  );

  // Discrepancia de referencia (otro orderId en metadata) -> reference_mismatch
  assert.deepEqual(
    validatePeyTransactionForOrder(
      orderTarget,
      { ...validQrTx, metadata: { orderId: "ord_otro_pedido" } },
      14550,
    ),
    { ok: false, reason: "reference_mismatch" },
  );

  // Discrepancia de payableId en QR CoDi -> reference_mismatch
  assert.deepEqual(
    validatePeyTransactionForOrder(
      orderTarget,
      { ...validQrTx, payableId: "qr_otro" },
      14550,
    ),
    { ok: false, reason: "reference_mismatch" },
  );

  // Sin ninguna referencia vinculable -> reference_mismatch
  assert.deepEqual(
    validatePeyTransactionForOrder(
      orderTarget,
      {
        id: "tx_orphan",
        status: "PAID",
        amount: 145.5,
        currency: "MXN",
      },
      14550,
    ),
    { ok: false, reason: "reference_mismatch" },
  );
});

test("POST /api/orders/[id]/sync-pey respeta demoMode y resuelve candidatos desde payment_events en modo real", async () => {
  // 1. En DEMO_MODE=true nunca marca paid y devuelve demoMode: true
  await withEnv({ DEMO_MODE: "true", PEY_API_KEY: "" }, async () => {
    const demoOrder = createOrder({
      items: [{ description: "Queso Oaxaca", quantity: 1, unitPriceCents: 9500 }],
    });
    attachQr(
      demoOrder.id,
      {
        id: "demo_qr_test_1",
        qrString: '{"demo":true}',
        qrImage: "data:image/png;base64,AAA",
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      },
      "112233",
    );
    const req = new Request(`http://localhost:3000/api/orders/${demoOrder.id}/sync-pey`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await syncPeyPost(req, {
      params: Promise.resolve({ id: demoOrder.id }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.synced, false);
    assert.equal(body.demoMode, true);
    assert.equal(getOrderDetail(demoOrder.id).order.status, "payment_pending");
  });

  // 2. En modo real sin candidatos devuelve no_transaction_id
  await withEnv(
    { DEMO_MODE: "false", PEY_API_KEY: "pey_test_key" },
    async () => {
      const realOrder = createOrder({
        items: [{ description: "Aguacate Hass", quantity: 2, unitPriceCents: 6000 }],
      });
      attachQr(
        realOrder.id,
        {
          id: "qr_real_sync_1",
          qrString: "000201010212...",
          qrImage: "data:image/png;base64,AAA",
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
        },
        "778899",
      );

      const emptyReq = new Request(
        `http://localhost:3000/api/orders/${realOrder.id}/sync-pey`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const emptyRes = await syncPeyPost(emptyReq, {
        params: Promise.resolve({ id: realOrder.id }),
      });
      const emptyBody = await emptyRes.json();
      assert.equal(emptyBody.synced, false);
      assert.equal(emptyBody.reason, "no_transaction_id");

      // 3. Insertamos un evento en payment_events con numRef de la orden y verificamos resolución S2S
      getDb()
        .prepare(
          `INSERT INTO payment_events
           (id, provider, event_type, idempotency_key, payload, payload_hash, signature_valid, processed_at, result)
           VALUES (?, 'pey', 'codi.qr.payment_received', ?, ?, 'hash1', 1, ?, 'received')`,
        )
        .run(
          newId("evt"),
          newId("wh"),
          JSON.stringify({
            type: "codi.qr.payment_received",
            transactionId: "tx_from_event_778899",
            numRef: "778899",
            amount: 120,
            currency: "MXN",
            metadata: { orderId: realOrder.id },
          }),
          nowIso(),
        );

      const originalFetch = globalThis.fetch;
      try {
        // Primero simulamos que Pey reporta monto distinto -> amount_mismatch, orden sigue payment_pending
        globalThis.fetch = async (url) => {
          assert.match(String(url), /\/transaction\/tx_from_event_778899$/);
          return new Response(
            JSON.stringify({
              id: "tx_from_event_778899",
              status: "PAID",
              amount: 119.99,
              currency: "MXN",
              paymentMethod: "CODI",
              payableType: "API_CODI_QR",
              payableId: "qr_real_sync_1",
              metadata: { orderId: realOrder.id },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        };

        const mismatchReq = new Request(
          `http://localhost:3000/api/orders/${realOrder.id}/sync-pey`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          },
        );
        const mismatchRes = await syncPeyPost(mismatchReq, {
          params: Promise.resolve({ id: realOrder.id }),
        });
        const mismatchBody = await mismatchRes.json();
        assert.equal(mismatchBody.synced, false);
        assert.equal(mismatchBody.reason, "amount_mismatch");
        assert.equal(getOrderDetail(realOrder.id).order.status, "payment_pending");

        // Ahora Pey devuelve la transacción PAID con los 12000 centavos exactos y referencia válida
        globalThis.fetch = async (url) => {
          assert.match(String(url), /\/transaction\/tx_from_event_778899$/);
          return new Response(
            JSON.stringify({
              id: "tx_from_event_778899",
              status: "PAID",
              amount: 120,
              currency: "MXN",
              paymentMethod: "CODI",
              payableType: "API_CODI_QR",
              payableId: "qr_real_sync_1",
              metadata: { orderId: realOrder.id },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        };

        const okReq = new Request(
          `http://localhost:3000/api/orders/${realOrder.id}/sync-pey`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          },
        );
        const okRes = await syncPeyPost(okReq, {
          params: Promise.resolve({ id: realOrder.id }),
        });
        const okBody = await okRes.json();
        assert.equal(okBody.synced, false);
        assert.equal(okBody.reason, "awaiting_signed_webhook");
        assert.equal(okBody.providerStatus, "PAID");
        assert.equal(okBody.order.status, "payment_pending");
        assert.equal(okBody.order.paidCents, 0);
        assert.equal(getOrderDetail(realOrder.id).payments.length, 0);
        // Preserve the original paid/amount checks, after the authorized channel.
        const key = crypto.randomBytes(32);
        await withEnv({ PEY_WEBHOOK_SECRET: 'whsec_' + key.toString('base64') }, async () => {
          const payload = JSON.stringify({ type: "codi.qr.payment_received", amount: 120, currency: "MXN", numRef: "778899", transactionId: "tx_from_event_778899", metadata: { orderId: realOrder.id } });
          const id = "wh_sync_signed";
          const timestamp = String(Math.floor(Date.now() / 1000));
          const signature = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64");
          const response = await webhookPost(new Request("http://localhost:3000/api/webhooks/pey", { method: "POST", headers: { "content-type": "application/json", "webhook-id": id, "webhook-timestamp": timestamp, "webhook-signature": `v1,${signature}` }, body: payload }));
          assert.equal(response.status, 200);
          assert.equal(getOrderDetail(realOrder.id).order.status, "paid");
          assert.equal(getOrderDetail(realOrder.id).order.paidCents, 12000);
        });
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  );
});
