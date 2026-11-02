#!/usr/bin/env node
/**
 * Lighthouse móvil reproducible contra el build de producción.
 *
 * Uso:
 *   BASE_URL=http://localhost:3154 npm run lighthouse:mobile
 *   BASE_URL=http://localhost:3154 npm run lighthouse:mobile -- --assert
 *
 * Requiere el servidor ya levantado (`npm start -- -p 3154`) para no mezclar
 * el arranque con lo que se mide. Guarda el JSON en
 * `%TEMP%\opencode\perf-core\` (o en LH_OUT).
 *
 * Presupuesto móvil (Moto E / Android Go, Slow 3G + CPU 4×):
 *   Performance ≥ 85, LCP ≤ 3.0 s, TBT ≤ 300 ms, CLS ≤ 0.1
 *   Accessibility / Best Practices / SEO = 100 (gate de a11y existente)
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const BASE = (process.env.BASE_URL ?? "http://localhost:3154").replace(/\/+$/, "");
const URL_TO_TEST = `${BASE}/`;
const ASSERT = process.argv.includes("--assert");
const OUT =
  process.env.LH_OUT ??
  path.join(os.tmpdir(), "opencode", "perf-core", `lighthouse-mobile-${Date.now()}.json`);

const THRESHOLDS = {
  performance: 85,
  lcp: 3000,
  tbt: 300,
  cls: 0.1,
};

function main() {
  try {
    const response = spawnSync(
      process.execPath,
      [
        "-e",
        `fetch(${JSON.stringify(URL_TO_TEST)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))`,
      ],
      { timeout: 15_000 },
    );
    if (response.status !== 0) {
      console.error(`LIGHTHOUSE FAIL: ${URL_TO_TEST} no responde. Levanta el build en :3154.`);
      return 1;
    }
  } catch {
    console.error(`LIGHTHOUSE FAIL: no pude comprobar ${URL_TO_TEST}.`);
    return 1;
  }

  console.log(`Lighthouse móvil → ${URL_TO_TEST}`);
  // En Windows `npx.cmd` no se puede lanzar con shell:false (EINVAL) y con
  // shell:true los argumentos deben ir citados para no partir los flags.
  const args = [
    "--yes",
    "lighthouse@13.6.0",
    URL_TO_TEST,
    "--form-factor=mobile",
    "--throttling-method=simulate",
    "--only-categories=performance,accessibility,best-practices,seo",
    "--output=json",
    `--output-path=${OUT}`,
    "--chrome-flags=--headless=new --no-sandbox",
    "--quiet",
  ];
  const command = `${process.platform === "win32" ? "npx.cmd" : "npx"} ${args
    .map((arg) => `"${arg.replaceAll('"', '\\"')}"`)
    .join(" ")}`;
  const result = spawnSync(command, {
    stdio: "inherit",
    timeout: 600_000,
    shell: true,
  });
  if (result.status !== 0) {
    console.error("LIGHTHOUSE FAIL: la corrida terminó con error.");
    return result.status ?? 1;
  }

  const report = JSON.parse(fs.readFileSync(OUT, "utf8"));
  const score = (id) => Math.round((report.categories[id]?.score ?? 0) * 100);
  const metric = (id) => report.audits[id]?.numericValue ?? 0;
  const summary = {
    performance: score("performance"),
    accessibility: score("accessibility"),
    bestPractices: score("best-practices"),
    seo: score("seo"),
    lcpMs: Math.round(metric("largest-contentful-paint")),
    tbtMs: Math.round(metric("total-blocking-time")),
    cls: Number(metric("cumulative-layout-shift").toFixed(3)),
    fcpMs: Math.round(metric("first-contentful-paint")),
  };

  console.log("\nResultado:");
  console.table(summary);
  console.log(`JSON: ${OUT}`);

  const failures = [];
  if (summary.performance < THRESHOLDS.performance)
    failures.push(`performance ${summary.performance} < ${THRESHOLDS.performance}`);
  if (summary.lcpMs > THRESHOLDS.lcp) failures.push(`LCP ${summary.lcpMs}ms > ${THRESHOLDS.lcp}ms`);
  if (summary.tbtMs > THRESHOLDS.tbt) failures.push(`TBT ${summary.tbtMs}ms > ${THRESHOLDS.tbt}ms`);
  if (summary.cls > THRESHOLDS.cls) failures.push(`CLS ${summary.cls} > ${THRESHOLDS.cls}`);
  if (summary.accessibility < 100) failures.push(`a11y ${summary.accessibility} < 100`);

  if (!failures.length) {
    console.log("\nLIGHTHOUSE MOBILE OK");
    return 0;
  }
  for (const failure of failures) console.error(`  · ${failure}`);
  if (ASSERT) {
    console.error("LIGHTHOUSE MOBILE FAIL");
    return 1;
  }
  console.log("\n(Advertencias; corré con --assert para bloquear.)");
  return 0;
}

process.exitCode = main();
