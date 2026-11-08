import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "trangui-profile-contract-"));
const compiled = new Map();
function compile(relative) {
  if (compiled.has(relative)) return compiled.get(relative);
  const sourcePath = path.join(sourceRoot, relative);
  const output = path.join(temporary, "compiled", relative.replace(/\.ts$/, ".mjs"));
  compiled.set(relative, output);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const source = fs.readFileSync(sourcePath, "utf8").replace(
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
  APP_URL: "https://profile.example.test", PILOT_AUTH_SECRET: randomBytes(48).toString("base64url"),
  DATABASE_PATH: path.join(temporary, "legacy.sqlite"), DATABASE_BACKUP_DIR: path.join(temporary, "legacy-backups"),
  PEY_API_KEY: "", PEY_WEBHOOK_SECRET: "", OPENAI_API_KEY: "", OPERATOR_ACCESS_TOKEN: "", TRUST_PROXY: "0",
})) {
  previous[key] = process.env[key];
  process.env[key] = value;
}
const { GET, PUT } = await import(pathToFileURL(compile("app/api/business-profile/route.ts")).href);
const { getJudgeRuntime, runJudgeRequest } = await import(pathToFileURL(compile("lib/auth/pilot-runtime.ts")).href);
const { getDb } = await import(pathToFileURL(compile("lib/db.ts")).href);
const { getBusinessProfile, setBusinessProfile } = await import(pathToFileURL(compile("lib/business-profile.ts")).href);
let identity;
const accounts = [];

test.before(async () => {
  ({ identity } = await getJudgeRuntime());
  for (const name of ["alpha", "beta"]) {
    const response = await identity.auth.handler(new Request(`${process.env.APP_URL}/api/auth/sign-up/email`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: process.env.APP_URL },
      body: JSON.stringify({ name, email: `${name}@example.test`, password: "Perfil-aislado-contrato-2026" }),
    }));
    assert.equal(response.status, 200);
    const payload = await response.json();
    accounts.push({ id: payload.user.id, cookie: response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ") });
  }
});

test.after(() => {
  identity?.close();
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  fs.rmSync(temporary, { recursive: true, force: true });
});

function request(method, account, body, headers = {}) {
  return new Request(`${process.env.APP_URL}/api/business-profile`, {
    method,
    headers: { "Content-Type": "application/json", Origin: process.env.APP_URL,
      ...(account ? { Cookie: account.cookie } : {}), ...headers },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}
function financialRows() {
  const database = getDb();
  return Object.fromEntries(["orders", "order_items", "payments", "credits", "credit_payments", "audit_log", "tasks", "goals"]
    .map(table => [table, database.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
}

test("a fresh authenticated GET returns null without creating the profile schema or changing business records", async () => {
  const before = await runJudgeRequest(accounts[0], () => financialRows());
  const response = await GET(request("GET", accounts[0]));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { profile: null });
  assert.match(response.headers.get("cache-control"), /private.*no-store/);
  assert.match(response.headers.get("vary"), /Cookie/);
  await runJudgeRequest(accounts[0], () => {
    assert.equal(getDb().prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='business_profile'").get().n, 0);
    assert.deepEqual(financialRows(), before);
  });
});

test("real sessions persist isolated profiles across reopening and never write sales, identity or sample data", async () => {
  const before = await Promise.all(accounts.map(account => runJudgeRequest(account, financialRows)));
  const identityBefore = identity.database.prepare("SELECT * FROM user ORDER BY id").all();
  const choices = ["produce", "food"];
  const results = await Promise.all(accounts.map(async (account, index) => {
    const response = await PUT(request("PUT", account, { businessType: choices[index] }));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control"), /no-store/);
    return (await response.json()).profile;
  }));
  for (let index = 0; index < accounts.length; index++) {
    const response = await GET(request("GET", accounts[index]));
    assert.deepEqual(await response.json(), { profile: results[index] });
    assert.deepEqual(Object.keys(results[index]).sort(), ["businessType", "completedAt"]);
    assert.equal(results[index].businessType, choices[index]);
    assert.equal(new Date(results[index].completedAt).toISOString(), results[index].completedAt);
    await runJudgeRequest(accounts[index], () => assert.deepEqual(financialRows(), before[index]));
  }
  assert.deepEqual(identity.database.prepare("SELECT * FROM user ORDER BY id").all(), identityBefore);
  assert.equal(identity.database.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='business_profile'").get().n, 0);
});

test("all four strict slugs work and repeated/changed choices preserve the first completion time", async () => {
  const first = (await (await GET(request("GET", accounts[0]))).json()).profile;
  for (const businessType of ["produce", "food", "goods", "general", "general"]) {
    const response = await PUT(request("PUT", accounts[0], { businessType }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { profile: { businessType, completedAt: first.completedAt } });
  }
  assert.equal((await (await GET(request("GET", accounts[1]))).json()).profile.businessType, "food");
});

test("invalid/extra client fields, malformed/oversized bodies and foreign origins never modify either profile", async () => {
  const before = await Promise.all(accounts.map(async account => (await (await GET(request("GET", account))).json()).profile));
  for (const body of [null, [], {}, { businessType: "unknown" }, { businessType: "PRODUCE" }, { businessType: " produce" },
    { businessType: "goods", accountId: accounts[1].id }, { businessType: "goods", completedAt: "2020-01-01" },
    { businessType: 1 }, "{bad-json"]) {
    const response = await PUT(request("PUT", accounts[0], body));
    assert.equal(response.status, 400);
    assert.match(response.headers.get("cache-control"), /no-store/);
  }
  assert.equal((await PUT(request("PUT", accounts[0], " ".repeat(1025)))).status, 413);
  assert.equal((await PUT(request("PUT", accounts[0], { businessType: "goods" }, { Origin: "https://other.example" }))).status, 403);
  for (let index = 0; index < accounts.length; index++) {
    assert.deepEqual((await (await GET(request("GET", accounts[index]))).json()).profile, before[index]);
  }
  await runJudgeRequest(accounts[0], () => assert.throws(() => setBusinessProfile("forged"), /giro válido/));
});

test("unauthenticated/forged account headers cannot choose a tenant, and helpers fail outside a verified scope", async () => {
  const forged = { "X-Account-Id": accounts[0].id, "X-Tenant-Id": accounts[0].id };
  assert.equal((await GET(request("GET", null, undefined, forged))).status, 401);
  assert.equal((await PUT(request("PUT", null, { businessType: "goods" }, forged))).status, 401);
  assert.equal((await GET(request("GET", { cookie: "better-auth.session_token=invalid" }))).status, 401);
  assert.throws(() => getBusinessProfile(), /verified account tenant context/);
  assert.equal(fs.existsSync(process.env.DATABASE_PATH), false);
});

test("flag-off compatibility keeps the legacy profile separate and private", async () => {
  process.env.JUDGE_DEMO_ACCOUNTS = "false";
  let database;
  try {
    database = getDb();
    const before = financialRows();
    assert.deepEqual(await (await GET(request("GET"))).json(), { profile: null });
    const response = await PUT(request("PUT", null, { businessType: "general" }));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control"), /private.*no-store/);
    assert.equal((await response.json()).profile.businessType, "general");
    assert.deepEqual(financialRows(), before);
  } finally {
    database?.close();
    process.env.JUDGE_DEMO_ACCOUNTS = "true";
  }
  assert.equal((await (await GET(request("GET", accounts[1]))).json()).profile.businessType, "food");
});
