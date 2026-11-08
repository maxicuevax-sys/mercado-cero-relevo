import { randomInt, randomUUID, createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { verifyWebhookSignature } from "./pey";

// Separate rail: never writes orders/payments or changes DEMO_MODE.
export function realTestConfig() {
  const key = process.env.REAL_TEST_PEY_API_KEY;
  const secret = process.env.REAL_TEST_PEY_WEBHOOK_SECRET;
  const bank = process.env.REAL_TEST_PEY_BANK_ACCOUNT_ID;
  const apiKeyId = process.env.REAL_TEST_PEY_API_KEY_ID;
  const allowedAccountId = process.env.REAL_TEST_ALLOWED_ACCOUNT_ID;
  const encodedSecret = secret?.replace(/^whsec_/, "") ?? "";
  const validSecret = /^[A-Za-z0-9+/]+={0,2}$/.test(encodedSecret) &&
    Buffer.from(encodedSecret, "base64").length >= 24 &&
    Buffer.from(encodedSecret, "base64").length <= 64 &&
    Buffer.from(encodedSecret, "base64").toString("base64").replace(/=+$/, "") === encodedSecret.replace(/=+$/, "");
  if (process.env.REAL_TEST_PEY_ENABLED !== "true" ||
      process.env.REAL_TEST_PEY_RECEIVER_KIND !== "official-pey-test-bank" ||
      !allowedAccountId || !key || !validSecret || !secret || !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(bank ?? "") ||
      !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(apiKeyId ?? "")) return null;
  return { key, secret, bank: bank!, apiKeyId: apiKeyId!, allowedAccountId };
}
export function realTestSchema(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS pey_real_test (
    singleton INTEGER PRIMARY KEY CHECK(singleton=1), id TEXT NOT NULL UNIQUE,
    account_id TEXT NOT NULL, status TEXT NOT NULL, num_ref TEXT NOT NULL,
    bank_id TEXT NOT NULL, api_key_id TEXT NOT NULL, qr_id TEXT UNIQUE, qr_string TEXT,
    created_at TEXT NOT NULL, paid_at TEXT, transaction_id TEXT UNIQUE,
    event_id TEXT UNIQUE, payload_hash TEXT);
  `);
}
type Row = { id: string; account_id: string; status: string; num_ref: string; bank_id: string;
  api_key_id: string; qr_id: string | null; qr_string: string | null; created_at: string;
  paid_at: string | null; transaction_id: string | null; event_id: string | null; payload_hash: string | null };
export function realTestRow(db: DatabaseSync): Row | undefined {
  realTestSchema(db);
  return db.prepare("SELECT * FROM pey_real_test WHERE singleton=1").get() as Row | undefined;
}
export function publicRealTest(row: Row | undefined, accountId: string) {
  if (!row || row.account_id !== accountId) return null;
  return { id: row.id, status: row.status, amountCents: 1, currency: "MXN",
    receiverKind: "official-pey-test-bank", qrString: row.qr_string,
    expiresAt: new Date(Date.parse(row.created_at) + 600_000).toISOString(),
    paidConfirmed: row.status === "paid", paidAt: row.paid_at };
}
export async function createRealTest(db: DatabaseSync, accountId: string, call: typeof fetch = fetch) {
  const config = realTestConfig();
  if (!config) throw new Error("real_test_unconfigured");
  if (accountId !== config.allowedAccountId) throw new Error("real_test_forbidden");
  realTestSchema(db);
  // One global attempt, including uncertain transport outcomes. No automatic retry.
  if (realTestRow(db)) return publicRealTest(realTestRow(db), accountId);
  const bankResponse = await call(`https://api.pey.mx/bank-account/${config.bank}`, {
    headers: { Authorization: `Bearer ${config.key}` }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!bankResponse.ok) throw new Error("receiver_unverified");
  const bank = await bankResponse.json();
  if (bank.id !== config.bank || bank.codiStatus !== "ACTIVE") throw new Error("receiver_unverified");
  const id = randomUUID(), ref = String(randomInt(1_000_000, 10_000_000));
  const created = new Date().toISOString();
  // Atomic unique singleton is also the concurrency lock across processes.
  db.prepare(`INSERT INTO pey_real_test(singleton,id,account_id,status,num_ref,bank_id,api_key_id,created_at)
    VALUES(1,?,?,'unknown',?,?,?,?)`).run(id, accountId, ref, config.bank, config.apiKeyId, created);
  try {
    const response = await call("https://api.pey.mx/codi/qr", { method: "POST",
      headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
      cache: "no-store", signal: AbortSignal.timeout(10_000), body: JSON.stringify({ amount: 0.01,
        concept: "Prueba real 1 centavo", expiration: 600, numRef: ref, generateImage: false,
        bankAccountId: config.bank, metadata: { realTestId: id } }) });
    if (!response.ok) throw new Error("provider_unavailable");
    const result = await response.json();
    if (typeof result.id !== "string" || !/^[a-zA-Z0-9]{1,64}$/.test(result.id) ||
      typeof result.qrString !== "string" || result.qrString.length > 16384) throw new Error("provider_invalid");
    db.prepare("UPDATE pey_real_test SET status='pending',qr_id=?,qr_string=? WHERE id=? AND status='unknown'")
      .run(result.id, result.qrString, id);
  } catch { throw new Error("real_test_outcome_unknown"); }
  return publicRealTest(realTestRow(db), accountId);
}
export function receiveRealTest(db: DatabaseSync, raw: string, headers: Headers) {
  const config = realTestConfig();
  if (!config) return 503;
  const eventId = headers.get("webhook-id");
  if (!verifyWebhookSignature(raw, { id: eventId, timestamp: headers.get("webhook-timestamp"),
    signature: headers.get("webhook-signature") }, config.secret)) return 401;
  let event;
  try { event = JSON.parse(raw); } catch { return 400; }
  if (!event || typeof event !== "object" || Array.isArray(event)) return 422;
  const row = realTestRow(db);
  const hash = createHash("sha256").update(raw).digest("hex");
  if (!row || event.type !== "codi.qr.payment_received" || event.amount !== 0.01 ||
    (event.currency !== undefined && event.currency !== "MXN") ||
    event.apiKeyId !== row.api_key_id || event.bankAccountId !== row.bank_id ||
    !row.qr_id || event.codiQrId !== row.qr_id || event.numRef !== row.num_ref ||
    !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(event.transactionId ?? "") ||
    !Number.isInteger(event.datePaid) || event.datePaid < Math.floor(Date.parse(row.created_at)/1000) - 300 ||
    event.datePaid > Math.floor(Date.now()/1000) + 300) return 422;
  // Event replay must match both transaction and exact signed payload.
  if (row.status === "paid") return row.transaction_id === event.transactionId &&
    row.event_id === eventId && row.payload_hash === hash ? 200 : 409;
  const result = db.prepare(`UPDATE pey_real_test SET status='paid',paid_at=?,transaction_id=?,event_id=?,payload_hash=?
    WHERE singleton=1 AND status='pending'`).run(new Date(event.datePaid*1000).toISOString(), event.transactionId, eventId, hash);
  return Number(result.changes) === 1 ? 200 : 409;
}
