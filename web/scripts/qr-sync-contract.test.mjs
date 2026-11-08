import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

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
const { attachQr, createOrder, getOrderDetail } = await import(ordersModUrl);
const { POST: syncPeyPost } = await import(syncRouteModUrl);

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
        assert.equal(okBody.synced, true);
        assert.equal(okBody.order.status, "paid");
        assert.equal(okBody.order.paidCents, 12000);
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  );
});
