#!/usr/bin/env node
/**
 * Wrapper de ESLint para el harness.
 *
 * Uso:
 *   node scripts/lint-gate.mjs
 *
 * Imprime `LINT OK` solo si ESLint termina con exit 0. El marcador no es
 * decorativo: el harness lo exige literalmente y con límites de palabra.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const ESLINT_BIN = path.join(WEB, "node_modules", "eslint", "bin", "eslint.js");

if (!fs.existsSync(ESLINT_BIN)) {
  console.error("LINT FALLÓ: falta eslint. Corre `npm ci`.");
  process.exit(1);
}

const result = spawnSync(process.execPath, [ESLINT_BIN], {
  cwd: WEB,
  encoding: "utf8",
  timeout: 180_000,
  maxBuffer: 20 * 1024 * 1024,
});

const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
if (output) console.log(output);

if (result.error) {
  console.error(`LINT FALLÓ: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(`LINT FALLÓ: ESLint salió con ${result.status ?? "sin código"}.`);
  process.exit(result.status || 1);
}

console.log("LINT OK");
