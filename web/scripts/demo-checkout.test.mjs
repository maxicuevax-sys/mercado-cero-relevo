import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "trangui-demo-checkout-contract-"));
const compiled = new Map();
function compile(relative) {
  if (compiled.has(relative)) return compiled.get(relative);
  const sourcePath = path.join(sourceRoot, relative);
  const output = path.join(temporary, "compiled", relative.replace(/\.ts$/, ".mjs"));
  compiled.set(relative, output);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const source = fs.readFileSync(sourcePath, "utf8").replace(/import "server-only";\s*/g, "").replace(
    /(from\s*|import\(\s*)(["'])([^"']+)\2/g,
    (full, prefix, quote, specifier) => {
      if (specifier.startsWith("node:")) return full;
      let dependency;
      if (specifier.startsWith("@/")) dependency = path.join(sourceRoot, specifier.slice(2) + ".ts");
      else if (specifier.startsWith(".")) dependency = path.resolve(path.dirname(sourcePath), specifier + ".ts");
      else return `${prefix}${quote}${import.meta.resolve(specifier)}${quote}`;
      return `${prefix}${quote}${pathToFileURL(compile(path.relative(sourceRoot, dependency))).href}${quote}`;
    },
  );
  fs.writeFileSync(output, ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText);
  return output;
}

const previous = {};
for (const [key, value] of Object.entries({
  DEMO_MODE: "true", JUDGE_DEMO_ACCOUNTS: "true", JUDGE_DATA_ROOT: path.join(temporary, "judges"),
  APP_URL: "https://checkout.example.test", PILOT_AUTH_SECRET: randomBytes(48).toString("base64url"),
  DATABASE_PATH: path.join(temporary, "legacy-must-not-exist.sqlite"),
  PEY_API_KEY: "", PEY_WEBHOOK_SECRET: "", OPENAI_API_KEY: "", OPERATOR_ACCESS_TOKEN: "", TRUST_PROXY: "0",
})) { previous[key] = process.env[key]; process.env[key] = value; }
const { GET, POST } = await import(pathToFileURL(compile("app/api/demo-checkout/route.ts")).href);
const { getJudgeRuntime, runJudgeRequest } = await import(pathToFileURL(compile("lib/auth/pilot-runtime.ts")).href);
const { createJudgeDemoCheckoutUrl } = await import(pathToFileURL(compile("lib/auth/demo-checkout.ts")).href);
const { getDb, getOrder } = await import(pathToFileURL(compile("lib/db.ts")).href);
const { createOrder, attachQr, attachPaymentLink } = await import(pathToFileURL(compile("lib/orders.ts")).href);
const { createHash } = await import("node:crypto");
let identity;
const accounts = [], orders = [], tokens = [];
test.before(async () => {
  ({ identity } = await getJudgeRuntime());
  for (const name of ["alpha", "beta"]) {
    const response = await identity.auth.handler(new Request(`${process.env.APP_URL}/api/auth/sign-up/email`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: process.env.APP_URL },
      body: JSON.stringify({ name, email: `${name}@example.test`, password: "Checkout-isolated-test" }),
    }));
    assert.equal(response.status, 200);
    accounts.push((await response.json()).user);
    await runJudgeRequest(accounts.at(-1), () => {
      const order = createOrder({ items: [{ description: "Producto demo", quantity: 1, unitPriceCents: 9000 }] });
      orders.push(order);
      tokens.push(new URL(createJudgeDemoCheckoutUrl(order.id)).hash.slice(1));
    });
  }
});
test.after(() => {
  identity?.close();
  for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  assert.ok(path.basename(temporary).startsWith("trangui-demo-checkout-contract-"));
  fs.rmSync(temporary, { recursive: true, force: true });
});
function request(method, token, body, extra = {}) {
  return new Request(`${process.env.APP_URL}/api/demo-checkout`, {
    method, headers: { "Content-Type": "application/json", Origin: process.env.APP_URL, "X-Trangui-Demo-Checkout": token, ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
test("anonymous delegated GET is minimal, private, no payment and ignores unrelated account cookie", async () => {
  const response = await GET(request("GET", tokens[0], undefined, { Cookie: "arbitrary-untrusted-account=beta" }));
  assert.equal(response.status, 200);
  const dto = await response.json();
  assert.deepEqual(Object.keys(dto).sort(), ["demo", "dueCents", "items", "reference", "status", "totalCents"]);
  assert.equal(dto.dueCents, 9000); assert.equal(dto.demo, true);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  for (const forbidden of [accounts[0].id, orders[0].id, "customerName", "transactionId"]) assert.ok(!JSON.stringify(dto).includes(forbidden));
  await runJudgeRequest(accounts[0], () => assert.equal(getOrder(orders[0].id).paidCents, 0));
  assert.equal(fs.existsSync(process.env.DATABASE_PATH), false);
});
test("body cannot select another order, account, amount, cash or provider; cross-origin forbidden", async () => {
  for (const body of [{ method: "cash" }, { method: "codi", orderId: orders[1].id }, { method: "codi", amountCents: 1 }, { method: "codi", accountId: accounts[1].id }]) {
    assert.equal((await POST(request("POST", tokens[0], body))).status, 400);
  }
  assert.equal((await POST(request("POST", tokens[0], { method: "codi" }, { Origin: "https://evil.example.test" }))).status, 403);
});
test("the real seeded pending order can issue a readable capability in its account", async () => {
  const url = await runJudgeRequest(accounts[0], () => {
    const seeded = getDb().prepare("SELECT id FROM orders WHERE id LIKE 'demo_hist_pending_%' LIMIT 1").get();
    assert.ok(seeded, "Existing pending demo fixture must be exercised");
    return createJudgeDemoCheckoutUrl(seeded.id);
  });
  const response = await GET(request("GET", new URL(url).hash.slice(1)));
  assert.equal(response.status, 200); assert.equal((await response.json()).dueCents, 12000);
});
test("concurrent demo replay registers one exact payment on A, never B and never real paid", async () => {
  const results = await Promise.all([POST(request("POST", tokens[0], { method: "codi" })), POST(request("POST", tokens[0], { method: "codi" }))]);
  assert.deepEqual(results.map(response => response.status), [200, 200]);
  for (const response of results) { const dto = await response.json(); assert.equal(dto.status, "demo_paid"); assert.equal(dto.dueCents, 0); }
  await runJudgeRequest(accounts[0], () => {
    const rows = getDb().prepare("SELECT amount_cents, provider, demo FROM payments WHERE order_id = ?").all(orders[0].id);
    assert.equal(rows.length, 1); assert.equal(rows[0].amount_cents, 9000); assert.equal(rows[0].demo, 1); assert.equal(rows[0].provider, "demo");
  });
  await runJudgeRequest(accounts[1], () => assert.equal(getOrder(orders[1].id).paidCents, 0));
});
test("tampered and absent tokens fail uniformly; cancelled order cannot be simulated", async () => {
  for (const token of ["", "v1.invalid", tokens[0].slice(0, -8), tokens[0] + "="]) assert.equal((await GET(request("GET", token))).status, 404);
  await runJudgeRequest(accounts[1], () => getDb().prepare("UPDATE orders SET status='cancelled' WHERE id=?").run(orders[1].id));
  await runJudgeRequest(accounts[1], () => {
    assert.equal(attachPaymentLink(orders[1].id, { id: "demo_cancelled", url: "https://example.test" }, { forceRefresh: true }).status, "cancelled");
    assert.equal(attachQr(orders[1].id, { id: "demo_cancelled", qrString: "ignored", qrImage: null }, "123456", { forceRefresh: true }).status, "cancelled");
    const unchanged = getOrder(orders[1].id);
    assert.equal(unchanged.paymentUrl, null); assert.equal(unchanged.qrString, null);
  });
  assert.equal((await POST(request("POST", tokens[1], { method: "codi" }))).status, 404);
  await runJudgeRequest(accounts[1], () => assert.equal(getOrder(orders[1].id).paidCents, 0));
});
test("deleted identity or absent business fails without recreating storage; real providers fail closed", async () => {
  const directory = account => path.join(process.env.JUDGE_DATA_ROOT, "business", createHash("sha256").update(account.id).digest("hex"));
  identity.database.prepare("DELETE FROM user WHERE id=?").run(accounts[0].id);
  const absent = directory(accounts[0]);
  fs.rmSync(absent, { recursive: true, force: true });
  assert.equal((await GET(request("GET", tokens[0]))).status, 404);
  assert.equal(fs.existsSync(absent), false);
  const db = path.join(directory(accounts[1]), "demo.sqlite");
  fs.rmSync(db);
  assert.equal((await GET(request("GET", tokens[1]))).status, 404);
  assert.equal(fs.existsSync(db), false);
  process.env.PEY_API_KEY = "test";
  try { assert.notEqual((await GET(request("GET", tokens[1]))).status, 200); }
  finally { process.env.PEY_API_KEY = ""; }
  assert.equal(fs.existsSync(process.env.DATABASE_PATH), false);
});

