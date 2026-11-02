#!/usr/bin/env node
/**
 * Gate de TypeScript con el typegen de Next.js 16.
 *
 * Uso:
 *   node scripts/run-types.mjs
 *
 * En un checkout limpio `web/next-env.d.ts` no existe (está ignorado por
 * `web/.gitignore`). `next typegen` genera los tipos de rutas/layouts y luego
 * `tsc --noEmit` valida. Así el gate `types` funciona sin depender de un
 * `.next/` previo ni del orden de `build`.
 *
 * Imprime `TYPES OK` solo si ambos pasos terminan en 0.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const NEXT_BIN = path.join(WEB, "node_modules", "next", "dist", "bin", "next");
const TSC_BIN = path.join(WEB, "node_modules", "typescript", "bin", "tsc");
const TIMEOUT = 240_000;
const MAX_BUFFER = 20 * 1024 * 1024;

function runNode(script, args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: WEB,
    encoding: "utf8",
    timeout: TIMEOUT,
    maxBuffer: MAX_BUFFER,
    shell: false,
  });
}

function fail(label, result) {
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  console.error(`TYPES FAIL: ${label}`);
  if (output) {
    console.error(
      output
        .split(/\r?\n/)
        .slice(-40)
        .join("\n"),
    );
  }
  if (result.error) console.error(`  error: ${result.error.message}`);
}

function main() {
  if (!fs.existsSync(NEXT_BIN)) {
    console.error(`TYPES FAIL: no existe ${path.relative(WEB, NEXT_BIN)}; corre npm ci.`);
    return 1;
  }
  if (!fs.existsSync(TSC_BIN)) {
    console.error(`TYPES FAIL: no existe ${path.relative(WEB, TSC_BIN)}; corre npm ci.`);
    return 1;
  }

  const typegen = runNode(NEXT_BIN, ["typegen"]);
  if (typegen.error || typegen.status !== 0) {
    fail("next typegen", typegen);
    return 1;
  }

  const tsc = runNode(TSC_BIN, ["--noEmit"]);
  if (tsc.error || tsc.status !== 0) {
    fail("tsc --noEmit", tsc);
    return 1;
  }

  console.log("TYPES OK");
  return 0;
}

process.exitCode = main();
