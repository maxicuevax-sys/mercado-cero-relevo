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
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trangui-tenant-test-"));
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

const { runInTenantDatabase, currentTenantDatabase } = await import(pathToFileURL(transpileToTmp("lib/auth/tenant-scope.ts")).href);
const { getDb, getOrder, getCredit, resetDemoData } = await import(pathToFileURL(transpileToTmp("lib/db.ts")).href);
const { createOrder } = await import(pathToFileURL(transpileToTmp("lib/orders.ts")).href);
const { isDemoMode } = await import(pathToFileURL(transpileToTmp("lib/config.ts")).href);
const root = path.join(tmpDir, "tenants");
process.env.DEMO_MODE = "true";
process.env.PEY_API_KEY = "";
process.env.OPENAI_API_KEY = "";
const sale = description => createOrder({ items: [{ description, quantity: 1, unitPriceCents: 5000 }], cashCents: 5000 });

test("parallel accounts cannot read or modify each other's sales, credits or audit", async () => {
  let alice, bob, aliceCredit;
  await Promise.all([
    runInTenantDatabase({ root, accountId: "alice" }, async () => {
      alice = sale("Alice only");
      aliceCredit = createOrder({ items: [{ description: "Alice credit", quantity: 1, unitPriceCents: 2500 }], creditCents: 2500, customerName: "Alice customer" }).creditId;
      await new Promise(resolve => setTimeout(resolve, 30));
      assert.equal(getOrder(alice.id).id, alice.id);
      assert.equal(getOrder(bob.id), null);
      assert.equal(getDb().prepare("SELECT count(*) AS n FROM audit_log WHERE entity_id=?").get(bob.id).n, 0);
    }),
    runInTenantDatabase({ root, accountId: "bob" }, async () => { bob = sale("Bob only"); await new Promise(resolve => setTimeout(resolve, 10)); }),
  ]);
  await runInTenantDatabase({ root, accountId: "bob" }, async () => {
    assert.equal(getOrder(alice.id), null);
    assert.equal(getCredit(aliceCredit), null);
    getDb().prepare("UPDATE credits SET balance_cents=0 WHERE id=?").run(aliceCredit);
    assert.equal(getOrder(bob.id).totalCents, 5000);
    getDb().prepare("UPDATE orders SET total_cents=1 WHERE id=?").run(alice.id);
  });
  await runInTenantDatabase({ root, accountId: "alice" }, async () => {
    assert.equal(getOrder(alice.id).totalCents, 5000);
    assert.equal(getCredit(aliceCredit).balanceCents, 2500);
  });
});

test("tenant demo cannot become a real payment and reset backups remain tenant-local", async () => {
  const previous = process.env.DEMO_MODE;
  process.env.DEMO_MODE = "false";
  await assert.rejects(runInTenantDatabase({ root, accountId: "real-blocked" }, async () => getDb()), /demo mode/i);
  process.env.DEMO_MODE = "true";
  try {
    await runInTenantDatabase({ root, accountId: "reset-account" }, async () => {
      assert.equal(isDemoMode(), true);
      const order = sale("Demo only");
      assert.equal(order.status, "demo_paid");
      const scope = currentTenantDatabase();
      const result = resetDemoData();
      assert.ok(fs.existsSync(path.join(scope.backupDirectory, result.backup)));
      assert.equal(getOrder(order.id), null);
      assert.equal(getDb().prepare("PRAGMA journal_mode").get().journal_mode, "wal");
    });
  } finally { if (previous === undefined) delete process.env.DEMO_MODE; else process.env.DEMO_MODE = previous; }
});

test("backup pruning and resets never affect another account or the legacy owner", async () => {
  const legacy = getDb();
  const owner = sale("Owner legacy");
  let otherBackup;
  await runInTenantDatabase({ root, accountId: "prune-bob" }, async () => {
    const result = resetDemoData();
    otherBackup = path.join(currentTenantDatabase().backupDirectory, result.backup);
  });
  await runInTenantDatabase({ root, accountId: "prune-alice" }, async () => {
    for (let i = 0; i < 7; i++) resetDemoData();
    const backups = fs.readdirSync(currentTenantDatabase().backupDirectory).filter(name => name.endsWith(".db"));
    assert.equal(backups.length, 5);
  });
  assert.ok(fs.existsSync(otherBackup));
  assert.equal(getDb(), legacy);
  assert.equal(getOrder(owner.id).totalCents, 5000);
  assert.equal(fs.existsSync(process.env.DATABASE_BACKUP_DIR), false);
});

test("configured paid providers are rejected before a tenant database opens", async () => {
  for (const key of ["PEY_API_KEY", "OPENAI_API_KEY"]) {
    process.env[key] = "fake-test-key";
    try {
      await assert.rejects(runInTenantDatabase({ root, accountId: "provider-blocked" }, async () => getDb()), /providers disabled/i);
    } finally { process.env[key] = ""; }
  }
});

test("account mode fails closed without context; invalid identifiers and nested account switches are rejected", async () => {
  process.env.JUDGE_DEMO_ACCOUNTS = "true";
  try { assert.throws(() => getDb(), /tenant|account|cuenta/i); }
  finally { delete process.env.JUDGE_DEMO_ACCOUNTS; }
  await assert.rejects(runInTenantDatabase({ root, accountId: "../alice" }, async () => getDb()), /account|cuenta/i);
  await assert.rejects(runInTenantDatabase({ root: "relative", accountId: "alice" }, async () => getDb()), /absolute|absolut/i);
  await runInTenantDatabase({ root, accountId: "alice" }, async () => {
    await assert.rejects(runInTenantDatabase({ root, accountId: "bob" }, async () => getDb()), /nested|anidad/i);
  });
  assert.equal(currentTenantDatabase(), undefined);
});

test("connections close after success or failure, including detached async work", async () => {
  let connection;
  await assert.rejects(runInTenantDatabase({ root, accountId: "throws" }, async () => { connection = getDb(); throw new Error("deliberate"); }), /deliberate/);
  assert.throws(() => connection.prepare("SELECT 1"), /not open|closed/i);
  let late;
  await runInTenantDatabase({ root, accountId: "detached" }, async () => {
    getDb();
    late = new Promise(resolve => setTimeout(() => { assert.throws(() => getDb(), /closed|cerrad/i); resolve(); }, 10));
  });
  await late;
});
