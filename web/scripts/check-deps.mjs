#!/usr/bin/env node
/**
 * Gate de dependencias de producción.
 *
 * Uso:
 *   node scripts/check-deps.mjs
 *
 * Ejecuta `npm audit --omit=dev --audit-level=high --json` y falla si hay
 * vulnerabilidades high o critical en dependencias de producción. Los
 * moderados/lows se reportan pero no bloquean este gate (el estándar pedido
 * es `--audit-level=high`).
 *
 * No toca la app, la base ni el servidor.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const IS_WIN = process.platform === "win32";

export function parseAuditReport(raw) {
  const text = String(raw ?? "");
  const start = text.indexOf("{");
  if (start < 0) {
    return { ok: false, error: "npm audit no devolvió JSON", high: 0, critical: 0 };
  }

  let data;
  try {
    data = JSON.parse(text.slice(start));
  } catch (error) {
    return {
      ok: false,
      error: `JSON de npm audit inválido: ${error instanceof Error ? error.message : String(error)}`,
      high: 0,
      critical: 0,
    };
  }

  const counts = data?.metadata?.vulnerabilities;
  if (!counts || typeof counts !== "object") {
    const detail = data?.error?.summary ?? data?.error?.detail ?? "sin metadata.vulnerabilities";
    return { ok: false, error: detail, high: 0, critical: 0, data };
  }

  const high = Number(counts.high ?? 0);
  const critical = Number(counts.critical ?? 0);
  const moderate = Number(counts.moderate ?? 0);
  const low = Number(counts.low ?? 0);
  const total = Number(counts.total ?? 0);
  const blocking = [];
  for (const [name, item] of Object.entries(data.vulnerabilities ?? {})) {
    const severity = item?.severity;
    if (severity === "high" || severity === "critical") {
      blocking.push({ name, severity });
    }
  }

  return {
    ok: high === 0 && critical === 0,
    high,
    critical,
    moderate,
    low,
    total,
    blocking,
    data,
  };
}

function runAudit() {
  const command = "npm";
  const args = [
    "audit",
    "--omit=dev",
    "--audit-level=high",
    "--json",
  ];
  return IS_WIN
    ? spawnSync([command, ...args].join(" "), {
        cwd: WEB,
        encoding: "utf8",
        timeout: 120_000,
        maxBuffer: 20 * 1024 * 1024,
        shell: true,
      })
    : spawnSync(command, args, {
        cwd: WEB,
        encoding: "utf8",
        timeout: 120_000,
        maxBuffer: 20 * 1024 * 1024,
        shell: false,
      });
}

function main() {
  const result = runAudit();
  if (result.error) {
    console.error(
      `DEPS FAIL: no pude ejecutar npm audit: ${result.error.message}`,
    );
    return 1;
  }

  const report = parseAuditReport(result.stdout || result.stderr);
  if (!report.ok) {
    if (report.error) {
      console.error(`DEPS FAIL: ${report.error}`);
      const tail = String(result.stderr || result.stdout || "")
        .trim()
        .split(/\r?\n/)
        .slice(-20)
        .join("\n");
      if (tail) console.error(tail);
      return 1;
    }
    console.error(
      `DEPS FAIL: ${report.high} high · ${report.critical} critical (de producción)`,
    );
    for (const item of report.blocking.slice(0, 20)) {
      console.error(`  ${item.severity.padEnd(8)} ${item.name}`);
    }
    if (report.blocking.length > 20) {
      console.error(`  … ${report.blocking.length - 20} más`);
    }
    return 1;
  }

  console.log(
    `DEPS OK: 0 high/critical (${report.total} total, ${report.moderate} moderate, ${report.low} low)`,
  );
  return 0;
}

const isDirect =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirect) {
  process.exitCode = main();
}
