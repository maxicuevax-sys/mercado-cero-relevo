import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { corteReceipts } from "../src/components/corte/receipts-summary.ts";

registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) {
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts") && !path.extname(specifier)) return nextResolve(specifier + ".ts", context);
    throw error;
  }
} });
const root = mkdtempSync(path.join(tmpdir(), "trangui-corte-receipts-"));
process.env.DATABASE_PATH = path.join(root, "demo.sqlite");
process.env.DEMO_MODE = "true";
process.env.JUDGE_DEMO_ACCOUNTS = "false";
delete process.env.PEY_API_KEY;
const { getDb, getDailySummary } = await import("../src/lib/db.ts");
const { createOrder, recordCreditPayment } = await import("../src/lib/orders.ts");
const item = description => [{ description, quantity: 1, unitPriceCents: 5000 }];
test.after(() => { getDb().close(); rmSync(root, { recursive: true, force: true }); });

test("pending and fiado sales increase sales without increasing receipts; demo abono stays simulated", () => {
  const before = getDailySummary();
  const receipts = corteReceipts(before);
  createOrder({ items: item("Pending receipt regression") });
  const credit = createOrder({ items: item("Fiado receipt regression"), creditCents: 5000, customerName: "Corte QA demo" });
  const after = getDailySummary();
  assert.equal(after.salesCents - before.salesCents, 10000);
  assert.deepEqual(corteReceipts(after), receipts);
  recordCreditPayment(credit.creditId, 2000, "cash", null, "demo-abono-unique");
  const paid = corteReceipts(getDailySummary());
  assert.equal(paid.confirmedCents, receipts.confirmedCents);
  assert.equal(paid.demoCents - receipts.demoCents, 2000);
});

test("actual cash abono adds receipts once without becoming a new sale or accepting declared digital", () => {
  process.env.DEMO_MODE = "false";
  const credit = createOrder({ items: item("Real fixture credit"), creditCents: 5000, customerName: "Corte QA cash" });
  const before = getDailySummary();
  recordCreditPayment(credit.creditId, 2000, "cash", null, "real-abono-unique");
  recordCreditPayment(credit.creditId, 2000, "cash", null, "real-abono-unique");
  const after = getDailySummary();
  assert.equal(after.salesCents, before.salesCents);
  assert.equal(corteReceipts(after).confirmedCents - corteReceipts(before).confirmedCents, 2000);
  assert.equal(corteReceipts({ ...after, declaredDigitalCents: 999999 }).confirmedCents, corteReceipts(after).confirmedCents);
});
