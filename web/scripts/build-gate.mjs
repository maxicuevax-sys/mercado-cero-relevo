#!/usr/bin/env node
/**
 * Build de producción con identidad de commit.
 *
 * Uso:
 *   npm run build                 # usa BUILD_SHA o git rev-parse HEAD
 *   BUILD_SHA=<sha> npm run build
 *
 * Escribe `.next/BUILD_SHA` (ignorado por git) y deja `BUILD_SHA` /
 * `NEXT_PUBLIC_BUILD_SHA` en el bundle. /api/health devuelve ese valor.
 * El harness lo compara con gitAtStart.sha y falla si el servidor que
 * responde no salió de este mismo árbol.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const NEXT_BIN = path.join(WEB, "node_modules", "next", "dist", "bin", "next");
const BUILD_SHA_FILE = path.join(WEB, ".next", "BUILD_SHA");

function gitSha() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: WEB,
    encoding: "utf8",
    timeout: 15_000,
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

function resolveSha() {
  const fromEnv = (process.env.BUILD_SHA ?? process.env.NEXT_PUBLIC_BUILD_SHA ?? "").trim();
  return fromEnv || gitSha() || "unknown";
}

const sha = resolveSha();
if (!/^[0-9a-f]{7,40}$/i.test(sha)) {
  console.error(`BUILD FALLÓ: BUILD_SHA inválido (${JSON.stringify(sha)}).`);
  process.exit(1);
}

if (!fs.existsSync(NEXT_BIN)) {
  console.error("BUILD FALLÓ: falta next. Corre `npm ci`.");
  process.exit(1);
}

console.log(`BUILD SHA ${sha}`);

const result = spawnSync(process.execPath, [NEXT_BIN, "build"], {
  cwd: WEB,
  env: {
    ...process.env,
    BUILD_SHA: sha,
    NEXT_PUBLIC_BUILD_SHA: sha,
  },
  stdio: "inherit",
  timeout: 600_000,
});

if (result.error) {
  console.error(`BUILD FALLÓ: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(`BUILD FALLÓ: next build salió con ${result.status ?? "sin código"}.`);
  process.exit(result.status || 1);
}

fs.mkdirSync(path.dirname(BUILD_SHA_FILE), { recursive: true });
fs.writeFileSync(
  BUILD_SHA_FILE,
  `${JSON.stringify({ sha, builtAt: new Date().toISOString() }, null, 2)}\n`,
  "utf8",
);
console.log(`BUILD SHA FILE ${path.relative(WEB, BUILD_SHA_FILE).replace(/\\/g, "/")}`);
console.log("BUILD OK");
