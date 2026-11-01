#!/usr/bin/env node
/**
 * Guardrails estáticos del harness.
 *
 * Uso:
 *   node scripts/harness-guard.mjs
 *
 * No toca el servidor, la base ni la demo. No imprime secretos.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const checks = [];

function check(name, ok, detail = "") {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

const tracked = execFileSync("git", ["ls-files"], {
  cwd: ROOT,
  encoding: "utf8",
})
  .split(/\r?\n/)
  .filter(Boolean);

check("AGENTS.md presente", fs.existsSync(path.join(ROOT, "AGENTS.md")));
check("HARNESS.md presente", fs.existsSync(path.join(ROOT, "HARNESS.md")));

const envTracked = tracked.filter((file) => {
  const base = path.basename(file);
  return base === ".env" || base.startsWith(".env.") && !base.endsWith(".example");
});
check(
  "ningún .env real trackeado",
  envTracked.length === 0,
  envTracked.join(", "),
);

const gitignore = read(".gitignore");
check(".gitignore protege web/.env.local", gitignore.includes("web/.env.local"));

const verifyRoute = read("web/src/app/api/verify/route.ts");
check(
  "verify solo acepta provider pey",
  verifyRoute.includes("p.provider = 'pey'"),
);

const orders = read("web/src/lib/orders.ts");
check("los pagos demo usan demo_paid", orders.includes("demo_paid"));

const demoPay = read("web/src/app/api/demo/pay/route.ts");
check(
  "demo/pay declara provider demo",
  demoPay.includes('provider: "demo"') || demoPay.includes("provider: 'demo'"),
);

const webhookRoute = read("web/src/app/api/webhooks/pey/route.ts");
check(
  "webhook pey existe y valida firma",
  /signature|verify/i.test(webhookRoute),
);

const secretKey =
  /\b(PEY_API_KEY|PEY_WEBHOOK_SECRET|OPENAI_API_KEY)[ \t]*=[ \t]*["']?([A-Za-z0-9_./+=-]{16,})/g;
const genericSecret = /\b(sk-[A-Za-z0-9_-]{20,}|whsec_[A-Za-z0-9_-]{20,})\b/g;
const allowedExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".py",
  ".sh",
  ".yml",
  ".yaml",
  ".txt",
  ".example",
]);
const ignored = new Set(["package-lock.json", "skills-lock.json"]);
const leaks = [];

for (const file of tracked) {
  const base = path.basename(file);
  if (ignored.has(base) || base.endsWith(".example")) continue;
  if (file.startsWith("web/node_modules/") || file.startsWith("harness/evidence/runs/")) {
    continue;
  }
  const ext = path.extname(file);
  if (!allowedExtensions.has(ext)) continue;

  let content;
  try {
    content = read(file);
  } catch {
    continue;
  }
  if (content.length > 512_000) continue;

  for (const regex of [secretKey, genericSecret]) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const value = (match[2] ?? match[1] ?? "").toLowerCase();
      if (
        value.startsWith("your") ||
        value.startsWith("changeme") ||
        value.startsWith("example") ||
        value.startsWith("placeholder") ||
        value.startsWith("test") ||
        value.includes("<") ||
        value.includes("...") ||
        value.startsWith("xxx")
      ) {
        continue;
      }
      leaks.push(`${file}: posible secreto (${match[1] ?? "patrón"})`);
    }
  }
}

check(
  "sin secretos con pinta real en archivos versionados",
  leaks.length === 0,
  leaks.slice(0, 5).join(" | "),
);

const failed = checks.filter((item) => !item.ok);
console.log("");
if (failed.length > 0) {
  console.log(`${failed.length} guardrail(s) fallaron.`);
  process.exitCode = 1;
} else {
  console.log("Guardrails OK.");
}
