#!/usr/bin/env node
/**
 * Gate único del harness de Mercado Cero.
 *
 * Uso:
 *   node scripts/harness-gate.mjs --fast
 *   node scripts/harness-gate.mjs --static
 *   node scripts/harness-gate.mjs --full
 *   node scripts/harness-gate.mjs --full --with-film
 *   node scripts/harness-gate.mjs --full --skip=tunnel,preflight
 *   node scripts/harness-gate.mjs --only=truth,webhook
 *   node scripts/harness-gate.mjs --list
 *
 * Reglas de honestidad:
 *   - `ok: true` solo si se ejecutaron TODOS los gates del modo, todos
 *     pasaron con exitCode 0, reason "ok" y expectedMatched true.
 *   - `--only` produce mode `partial`; cualquier `--skip` también deja
 *     `partial: true`. Ninguno puede quedar `ok: true`.
 *   - El build servido debe declarar el mismo SHA que gitAtStart y cada gate
 *     runtime debe registrar ese buildSha.
 *   - La evidencia exige árbol limpio al inicio y al final (incluye
 *     untracked; los artefactos generados están ignorados en .gitignore).
 *   - `full` escribe latest.json; `static` escribe latest-static.json sin
 *     pisar el full.
 *
 * No arranca ni reinicia el servidor principal. El runtime es compartido: el
 * agente lo levanta explícitamente. Los gates p0 levantan su propio servidor
 * aislado. El gate sí reinicia los datos de demo antes de truth/preflight.
 */

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const ROOT = path.resolve(WEB, "..");
const EVIDENCE = path.join(ROOT, "harness", "evidence");
const RUNS = path.join(EVIDENCE, "runs");
const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const IS_WIN = process.platform === "win32";
const P0_MARKER_PORT = 3212;

export const GATES = [
  {
    id: "guard",
    name: "Guardrails del repo",
    command: "node",
    args: ["scripts/harness-guard.mjs"],
    mode: "static",
    timeout: 60_000,
    expected: "Guardrails OK.",
    expectedBasis: "output",
    artifacts: [],
  },
  {
    id: "lint",
    name: "ESLint",
    command: "node",
    args: ["scripts/lint-gate.mjs"],
    mode: "static",
    timeout: 180_000,
    expected: "LINT OK",
    expectedBasis: "output",
    artifacts: [],
  },
  {
    id: "types",
    name: "TypeScript",
    command: "node",
    args: ["scripts/run-types.mjs"],
    mode: "static",
    timeout: 240_000,
    expected: "TYPES OK",
    expectedBasis: "output",
    artifacts: [],
  },
  {
    id: "deps",
    name: "Dependencias de producción",
    command: "node",
    args: ["scripts/check-deps.mjs"],
    mode: "static",
    timeout: 180_000,
    expected: "DEPS OK",
    expectedBasis: "output",
    artifacts: [],
  },
  {
    id: "build",
    name: "Build de producción con identidad",
    command: "node",
    args: ["scripts/build-gate.mjs"],
    mode: "build",
    timeout: 600_000,
    expected: ["BUILD OK", "compiled successfully"],
    expectedBasis: "output",
    artifacts: ["web/.next/BUILD_SHA"],
  },
  {
    id: "truth",
    name: "Verdad del comprobante",
    command: "node",
    args: ["scripts/verify-truth.mjs"],
    mode: "runtime",
    usesMainServer: true,
    resetBefore: true,
    timeout: 60_000,
    expected: "VERDAD OK",
    expectedBasis: "output",
    artifacts: [],
  },
  {
    id: "webhook",
    name: "Contrato del webhook",
    command: "node",
    args: ["scripts/webhook-gate.mjs"],
    mode: "runtime",
    timeout: 240_000,
    expected: ["WEBHOOK OK", "34/34"],
    expectedBasis: "output",
    artifacts: [],
  },
  {
    id: "mobile",
    name: "Flujo móvil 360 px",
    command: "python",
    args: ["scripts/mobile-audit.py"],
    mode: "runtime",
    usesMainServer: true,
    timeout: 180_000,
    expected: ["MOBILE OK", "25/25"],
    expectedBasis: "output",
    artifacts: ["demo/mobile-audit.json", "demo/mobile-360-*.png"],
  },
  {
    id: "checkout",
    name: "Checkout público",
    command: "node",
    args: ["scripts/checkout-gate.mjs"],
    mode: "runtime",
    baseUrl: "http://127.0.0.1:3215",
    timeout: 300_000,
    expected: ["CHECKOUT OK", "19/19"],
    expectedBasis: "output",
    artifacts: ["demo/checkout-audit.json", "demo/checkout-360-*.png"],
    env: { CHECKOUT_PORT: "3215" },
  },
  {
    id: "hig",
    name: "HIG / WCAG 2.2 AA",
    command: "python",
    args: ["scripts/hig-after-audit.py"],
    mode: "runtime",
    usesMainServer: true,
    timeout: 900_000,
    expected: ["HIG OK", "5 viewports"],
    expectedBasis: "output",
    artifacts: ["demo/hig-after/audit.json"],
  },
  {
    id: "motion",
    name: "Movimiento y reduced-motion",
    command: "python",
    args: ["scripts/motion-check.py"],
    mode: "runtime",
    usesMainServer: true,
    timeout: 180_000,
    expected: ["MOTION OK", "19 PASS", "0 FAIL"],
    expectedBasis: "output",
    artifacts: ["harness/evidence/motion-check.json", "harness/evidence/motion/*.png"],
  },
  {
    id: "contrast",
    name: "Alto contraste",
    command: "python",
    args: ["scripts/a11y-contrast.py"],
    mode: "runtime",
    usesMainServer: true,
    timeout: 180_000,
    expected: ["CONTRAST OK", "7 PASS", "0 FAIL"],
    expectedBasis: "output",
    artifacts: [
      "harness/evidence/a11y-contrast.json",
      "harness/evidence/a11y-contrast-*.png",
    ],
  },
  {
    id: "mobile-320",
    name: "HIG móvil 320/360 px (3 motores)",
    command: "node",
    args: ["scripts/mobile-320-gate.mjs"],
    mode: "runtime",
    baseUrl: "http://127.0.0.1:3214",
    timeout: 720_000,
    expected: ["MOBILE 320/360 E2E", "42 PASS", "0 FAIL"],
    expectedBasis: "output",
    artifacts: [
      "harness/evidence/mobile-320-e2e.json",
      "harness/evidence/mobile-320-*.png",
      "harness/evidence/mobile-360-*.png",
    ],
    env: { MOBILE_320_PORT: "3214" },
  },
  {
    id: "rehearsal",
    name: "Ensayo del guion",
    command: "python",
    args: ["scripts/rehearse-demo.py"],
    mode: "runtime",
    usesMainServer: true,
    timeout: 300_000,
    expected: ["REHEARSAL OK", "todo en verde: True"],
    expectedBasis: "output",
    artifacts: ["demo/rehearsal.json"],
  },
  {
    id: "security",
    name: "Contrato de seguridad",
    command: "node",
    args: ["scripts/security-contract.mjs"],
    mode: "runtime",
    baseUrl: "http://127.0.0.1:3191",
    timeout: 360_000,
    expected: "SEGURIDAD OK",
    expectedBasis: "output",
    artifacts: [],
    env: { SECURITY_PORT: "3191" },
  },
  {
    id: "data",
    name: "Contrato de datos P0 (85 checks)",
    command: "npm",
    args: ["run", "test:fix-datos"],
    mode: "runtime",
    baseUrl: "http://127.0.0.1:3192",
    timeout: 600_000,
    expected: ["P0 FIX DATOS", "P0 DB GUARDS", "P0 ORDERS ATOMIC", "DATOS OK"],
    expectedBasis: "output",
    artifacts: [],
    env: { DATA_PORT: "3192" },
  },
  {
    id: "perf",
    name: "Presupuesto de performance",
    command: "node",
    args: ["scripts/perf-budget.mjs"],
    mode: "runtime",
    timeout: 180_000,
    expected: "PERF BUDGET OK",
    expectedBasis: "output",
    artifacts: [],
  },
  {
    id: "p0-venta",
    name: "P0 venta durable",
    command: "node",
    args: ["scripts/p0-venta-gate.mjs"],
    mode: "runtime",
    baseUrl: "http://127.0.0.1:3211",
    timeout: 720_000,
    expected: ["65 PASS", "0 FAIL", "0 KNOWN"],
    expectedBasis: "output",
    artifacts: ["harness/evidence/p0-venta-e2e.json"],
    env: { P0_VENTA_PORT: "3211" },
  },
  {
    id: "p0-fiado",
    name: "P0 fiado y saldo vivo",
    command: "python",
    args: ["scripts/p0-fiado-e2e.py"],
    mode: "runtime",
    baseUrl: `http://127.0.0.1:${P0_MARKER_PORT}`,
    timeout: 720_000,
    expected: ["51 PASS", "0 FAIL", "0 KNOWN"],
    expectedBasis: "output",
    artifacts: [
      "harness/evidence/p0-fiado-e2e.json",
      "harness/evidence/p0-fiado-360.png",
    ],
    env: { P0_BASE_URL: `http://127.0.0.1:${P0_MARKER_PORT}`, P0_EXTERNAL_SERVER: "0" },
  },
  {
    id: "p0-corte",
    name: "P0 corte no destructivo",
    command: "python",
    args: ["scripts/p0-corte-e2e.py"],
    mode: "runtime",
    baseUrl: `http://127.0.0.1:${P0_MARKER_PORT}`,
    timeout: 900_000,
    expected: ["69 PASS", "0 FAIL", "0 KNOWN"],
    expectedBasis: "output",
    artifacts: [
      "harness/evidence/p0-corte-e2e.json",
      "harness/evidence/p0-corte-360.png",
      "harness/evidence/p0-corte-360-200.png",
    ],
    env: {
      P0_BASE_URL: `http://127.0.0.1:${P0_MARKER_PORT}`,
      P0_EXTERNAL_SERVER: "0",
      P0_MIGRATION_PORT: "3296",
    },
  },
  {
    id: "p0-integracion",
    name: "P0 integración",
    command: "python",
    args: ["scripts/p0-integracion-e2e.py"],
    mode: "runtime",
    baseUrl: `http://127.0.0.1:${P0_MARKER_PORT}`,
    timeout: 720_000,
    expected: ["51 PASS", "0 FAIL", "0 KNOWN"],
    expectedBasis: "output",
    artifacts: [
      "harness/evidence/p0-integracion-e2e.json",
      "harness/evidence/p0-integracion-360.png",
      "harness/evidence/p0-integracion-360-text200.png",
    ],
    env: { P0_BASE_URL: `http://127.0.0.1:${P0_MARKER_PORT}`, P0_EXTERNAL_SERVER: "0" },
  },
  {
    id: "p0-dinero",
    name: "P0 dinero y verdad",
    command: "python",
    args: ["scripts/p0-dinero-e2e.py"],
    mode: "runtime",
    baseUrl: "http://127.0.0.1:3213",
    timeout: 900_000,
    expected: ["45 PASS", "0 FAIL", "3 KNOWN"],
    expectedBasis: "output",
    artifacts: ["harness/evidence/p0-dinero-e2e.json"],
    env: { P0_BASE_URL: "http://127.0.0.1:3213" },
  },
  {
    id: "tunnel",
    name: "Túnel público",
    command: "python",
    args: ["scripts/tunnel-smoke.py"],
    mode: "runtime",
    usesMainServer: true,
    timeout: 300_000,
    expected: ["TUNNEL OK", "8/8"],
    expectedBasis: "output",
    artifacts: ["demo/tunnel-smoke.json", "demo/tunnel-*.png"],
  },
  {
    id: "preflight",
    name: "Preflight de demo",
    command: "node",
    args: ["scripts/preflight.mjs"],
    mode: "runtime",
    usesMainServer: true,
    resetBefore: true,
    timeout: 120_000,
    expected: ["PREFLIGHT OK", "18/18"],
    expectedBasis: "output",
    artifacts: [],
  },
  {
    id: "film",
    name: "Film check Stageshow",
    command: "python",
    args: ["scripts/film-check.py"],
    mode: "runtime",
    usesMainServer: true,
    optional: true,
    timeout: 300_000,
    expected: ["FILM OK", "SHEET"],
    expectedBasis: "output",
    artifacts: ["demo/stageshow/film-check.json", "demo/stageshow/*-sheet*.png"],
  },
];

export const GATES_BY_ID = new Map(GATES.map((gate) => [gate.id, gate]));

export const MODE_GATES = {
  fast: ["guard", "lint", "types"],
  static: ["guard", "lint", "types", "deps", "build"],
  full: GATES.filter((gate) => gate.mode !== "build" && !gate.optional).map(
    (gate) => gate.id,
  ),
  partial: [],
};

export class GateConfigError extends Error {}

export function parseArgs(argv) {
  const known = new Set([
    "--fast",
    "--static",
    "--full",
    "--with-film",
    "--only",
    "--skip",
    "--list",
    "--help",
    "-h",
  ]);
  for (const arg of argv) {
    if (arg.startsWith("--only=") || arg.startsWith("--skip=")) continue;
    if (!known.has(arg)) {
      throw new GateConfigError(`Flag desconocido: ${arg}`);
    }
  }

  const getValue = (flag) => {
    const inline = argv.find((arg) => arg.startsWith(`${flag}=`));
    const index = argv.indexOf(flag);
    if (inline && index >= 0) {
      throw new GateConfigError(`Repetiste ${flag} de dos formas distintas.`);
    }
    if (inline) {
      const value = inline.slice(flag.length + 1);
      if (!value) throw new GateConfigError(`Falta el valor de ${flag}.`);
      return value;
    }
    if (index < 0) return null;
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new GateConfigError(`Falta el valor de ${flag}.`);
    }
    return value;
  };

  const modeFlags = ["--fast", "--static", "--full"].filter((flag) =>
    argv.includes(flag),
  );
  if (modeFlags.length > 1) {
    throw new GateConfigError(`Elige un solo modo: ${modeFlags.join(", ")}.`);
  }
  const requestedMode = modeFlags.length ? modeFlags[0].slice(2) : null;
  const only = getValue("--only")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (argv.includes("--only") && !only?.length) {
    throw new GateConfigError("--only necesita al menos un id.");
  }

  const skip = new Set(
    (getValue("--skip") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );

  return {
    requestedMode,
    mode: only?.length ? "partial" : (requestedMode ?? "full"),
    only,
    skip,
    withFilm: argv.includes("--with-film"),
    list: argv.includes("--list"),
    help: argv.includes("--help") || argv.includes("-h"),
  };
}

function validateIds(ids, label) {
  const unknown = ids.filter((id) => !GATES_BY_ID.has(id));
  if (unknown.length) {
    throw new GateConfigError(
      `${label} desconocido(s): ${unknown.join(", ")}. Disponibles: ${GATES.map((gate) => gate.id).join(", ")}`,
    );
  }
}

export function expectedGateIds(options) {
  if (options.mode === "partial") {
    return [...new Set(options.only ?? [])];
  }
  const ids = [...MODE_GATES[options.mode]];
  if (options.mode === "full" && options.withFilm) ids.push("film");
  return ids;
}

export function criticalGateIds(options, expectedIds) {
  return expectedIds.filter((id) => {
    const gate = GATES_BY_ID.get(id);
    if (!gate) return true;
    if (!gate.optional) return true;
    return options.mode === "full" && id === "film";
  });
}

export function selectedGates(options) {
  if (options.only?.length) validateIds(options.only, "Gate");
  if (options.skip.size) validateIds([...options.skip], "Gate en --skip");

  const expectedIds = expectedGateIds(options);
  const ids = expectedIds.filter((id) => !options.skip.has(id));
  const partial = options.mode === "partial" || options.skip.size > 0;
  return {
    mode: options.mode,
    requestedMode: options.requestedMode,
    partial,
    expectedIds,
    criticalIds: criticalGateIds(options, expectedIds),
    skipped: [...options.skip],
    gates: GATES.filter((gate) => ids.includes(gate.id)),
  };
}

function loadEnvValues() {
  const file = path.join(WEB, ".env.local");
  if (!fs.existsSync(file)) return [];
  const values = [];
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equals = trimmed.indexOf("=");
    if (equals === -1) continue;
    const key = trimmed.slice(0, equals).trim();
    let value = trimmed.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (/(SECRET|KEY|TOKEN|PASSWORD)/i.test(key) && value.length >= 6) {
      values.push(value);
    }
  }
  return values;
}

const SECRET_VALUES = loadEnvValues();

function redact(value) {
  let output = String(value ?? "");
  for (const secret of SECRET_VALUES) {
    output = output.split(secret).join("[redacted]");
  }
  output = output.replace(
    /\b(sk-[A-Za-z0-9_-]{20,}|whsec_[A-Za-z0-9_-]{20,})\b/g,
    "[redacted]",
  );
  return output;
}

function gitValue(args) {
  try {
    return spawnSync("git", args, {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 15_000,
      shell: false,
    }).stdout.trim();
  } catch {
    return "";
  }
}

export function getGit() {
  return {
    sha: gitValue(["rev-parse", "HEAD"]) || "unknown",
    branch: gitValue(["rev-parse", "--abbrev-ref", "HEAD"]) || "unknown",
    // Incluye untracked: un archivo nuevo sin commitear también invalida la
    // evidencia. Los artefactos generados están en .gitignore.
    dirty: Boolean(gitValue(["status", "--porcelain", "--untracked-files=all"])),
  };
}

async function getServerHealth(base = BASE) {
  try {
    const response = await fetch(`${base}/api/health`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return { error: `/api/health respondió HTTP ${response.status}` };
    }
    const body = await response.json();
    return {
      buildSha:
        typeof body?.buildSha === "string" && body.buildSha
          ? body.buildSha
          : "unknown",
      body,
    };
  } catch (cause) {
    return {
      error: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

async function resetDemo() {
  const response = await fetch(`${BASE}/api/demo/reset`, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`reset de demo respondió HTTP ${response.status}`);
  }
}

function normalizeOutput(value) {
  return String(value ?? "")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Un expected no es un substring: exige límites de palabra. Así "0 FAIL" no
 * acepta "10 FAIL" ni "25/25" acepta "125/25".
 */
export function expectedMatches(expected, output) {
  if (expected == null) return null;
  const values = Array.isArray(expected) ? expected : [expected];
  if (!values.length) return null;
  const normalized = normalizeOutput(output);
  return values.every((value) => {
    const needle = normalizeOutput(value);
    if (!needle) return true;
    const re = new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRegExp(needle)}(?![\\p{L}\\p{N}])`,
      "u",
    );
    return re.test(normalized);
  });
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function relativeToRoot(file) {
  return path.relative(ROOT, file).replace(/\\/g, "/");
}

/**
 * Expande los artefactos declarados y guarda ruta, existencia, SHA-256 y
 * tamaño. Un patrón sin coincidencias se registra como faltante; el gate
 * falla si declaró artefactos y no existen.
 */
export function collectArtifacts(patterns = []) {
  const artifacts = [];
  for (const pattern of patterns) {
    let matches = [];
    try {
      matches = pattern.includes("*")
        ? fs.globSync(pattern, { cwd: ROOT })
        : [pattern];
    } catch {
      matches = [];
    }
    if (!matches.length) {
      artifacts.push({
        path: pattern,
        exists: false,
        sha256: null,
        size: null,
      });
      continue;
    }
    for (const match of matches) {
      const absolute = path.resolve(ROOT, match);
      const relative = relativeToRoot(absolute);
      try {
        const stat = fs.statSync(absolute);
        if (!stat.isFile()) continue;
        artifacts.push({
          path: relative,
          exists: true,
          sha256: sha256File(absolute),
          size: stat.size,
        });
      } catch {
        artifacts.push({
          path: relative,
          exists: false,
          sha256: null,
          size: null,
        });
      }
    }
  }
  return artifacts;
}

function readBuiltSha() {
  try {
    const file = path.join(WEB, ".next", "BUILD_SHA");
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return typeof parsed?.sha === "string" ? parsed.sha : null;
  } catch {
    return null;
  }
}

function gateEnvironment(gate) {
  return {
    ...process.env,
    BASE_URL: BASE,
    RUNTIME_BASE_URL: BASE,
    CHECKOUT_BASE_URL: BASE,
    MOBILE_BASE_URL: BASE,
    MOTION_BASE_URL: BASE,
    CONTRAST_BASE_URL: BASE,
    HIG_BASE_URL: BASE,
    CI: "1",
    ...(gate.env ?? {}),
  };
}

export function runGate(gate, { serverBuildSha = null } = {}) {
  const command = [gate.command, ...gate.args].join(" ");
  const started = performance.now();
  const result = IS_WIN
    ? spawnSync(command, {
        cwd: WEB,
        encoding: "utf8",
        env: gateEnvironment(gate),
        timeout: gate.timeout,
        maxBuffer: 40 * 1024 * 1024,
        shell: true,
      })
    : spawnSync(gate.command, gate.args, {
        cwd: WEB,
        encoding: "utf8",
        env: gateEnvironment(gate),
        timeout: gate.timeout,
        maxBuffer: 40 * 1024 * 1024,
        shell: false,
      });
  const durationMs = Math.round(performance.now() - started);
  const output = redact(`${result.stdout ?? ""}\n${result.stderr ?? ""}`).trim();
  const expectedMatched = expectedMatches(gate.expected, output);
  const artifacts = collectArtifacts(gate.artifacts ?? []);
  const artifactProblems = artifacts.filter((artifact) => !artifact.exists);
  const exitCode = result.status ?? 1;
  const timedOut =
    Boolean(result.error) &&
    (result.error.code === "ETIMEDOUT" ||
      /timed?\s*out/i.test(result.error.message ?? ""));
  const ok =
    result.status === 0 &&
    !result.error &&
    expectedMatched === true &&
    artifactProblems.length === 0;
  const reason = result.error
    ? timedOut
      ? "timeout"
      : "spawn-error"
    : result.status !== 0
      ? "exit-code"
      : expectedMatched !== true
        ? "expected-mismatch"
        : artifactProblems.length > 0
          ? "artifacts-missing"
          : "ok";
  const tail = output.split(/\r?\n/).slice(-40).join("\n");
  const baseUrl = gate.usesMainServer ? BASE : (gate.baseUrl ?? null);
  const buildSha =
    gate.mode === "runtime"
      ? gate.usesMainServer
        ? serverBuildSha
        : readBuiltSha()
      : null;

  console.log(
    `${ok ? "PASS" : "FAIL"}  ${gate.id.padEnd(12)} ${gate.name} - ${durationMs} ms - esperado: ${
      Array.isArray(gate.expected) ? gate.expected.join(" + ") : gate.expected
    }${expectedMatched === false ? " - MARCADOR NO ENCONTRADO" : ""}${
      artifactProblems.length ? ` - FALTAN ARTEFACTOS: ${artifactProblems.map((item) => item.path).join(", ")}` : ""
    }`,
  );
  if (!ok) {
    console.log("      ---- salida ----");
    console.log(
      tail
        .split(/\r?\n/)
        .map((line) => `      ${line}`)
        .join("\n"),
    );
    if (result.error) console.log(`      error: ${result.error.message}`);
    if (expectedMatched === false) {
      console.log(
        `      expected no apareció en la salida: ${JSON.stringify(gate.expected)}`,
      );
    }
  }

  return {
    id: gate.id,
    name: gate.name,
    command,
    baseUrl,
    buildSha,
    ok,
    exitCode,
    durationMs,
    expected: gate.expected,
    expectedBasis: gate.expectedBasis ?? "output",
    expectedMatched,
    reason,
    artifacts,
    outputTail: tail,
  };
}

export function evaluateRun({
  mode,
  expectedIds,
  criticalIds,
  results,
  gitAtStart,
  gitAtEnd,
  serverBuildSha = null,
  partial = mode === "partial",
}) {
  const executed = new Set(results.map((result) => result.id));
  const ids = results.map((result) => result.id);
  const duplicateResults = ids.filter((id, index) => ids.indexOf(id) !== index);
  const missing = expectedIds.filter((id) => !executed.has(id));
  const criticalMissing = missing.filter((id) => criticalIds.includes(id));
  const unexpected = [...executed].filter((id) => !expectedIds.includes(id));
  const failed = results.filter((result) => !result.ok);
  const expectedMismatches = results.filter(
    (result) => result.expectedMatched !== true,
  );
  const badExit = results.filter(
    (result) => result.exitCode !== 0 || result.reason !== "ok",
  );
  const badArtifacts = results.filter((result) =>
    (result.artifacts ?? []).some((artifact) => !artifact.exists),
  );
  const handoffMode = mode === "full" || mode === "static";
  const badBuild = handoffMode
    ? results.filter((result) => {
        const gate = GATES_BY_ID.get(result.id);
        if (!gate) return true;
        if (gate.mode === "runtime") {
          return result.buildSha !== gitAtStart?.sha;
        }
        return result.buildSha != null && result.buildSha !== gitAtStart?.sha;
      })
    : [];
  const gatesOk =
    results.length > 0 &&
    failed.length === 0 &&
    expectedMismatches.length === 0 &&
    badExit.length === 0 &&
    badArtifacts.length === 0 &&
    badBuild.length === 0 &&
    duplicateResults.length === 0;
  const complete =
    !partial &&
    mode !== "partial" &&
    missing.length === 0 &&
    unexpected.length === 0 &&
    duplicateResults.length === 0;
  const cleanStart =
    Boolean(gitAtStart) &&
    gitAtStart.dirty === false &&
    Boolean(gitAtStart.sha) &&
    gitAtStart.sha !== "unknown";
  const cleanEnd = Boolean(gitAtEnd) && gitAtEnd.dirty === false;
  const shaStable =
    Boolean(gitAtStart && gitAtEnd) &&
    gitAtStart.sha === gitAtEnd.sha &&
    gitAtStart.sha !== "unknown";
  const evidenceValid = cleanStart && cleanEnd && shaStable;
  const buildBound =
    mode === "full" || mode === "static"
      ? Boolean(serverBuildSha) &&
        serverBuildSha === gitAtStart?.sha &&
        serverBuildSha !== "unknown"
      : true;
  const ok =
    complete &&
    gatesOk &&
    criticalMissing.length === 0 &&
    evidenceValid &&
    buildBound;

  const reasons = [];
  if (partial) {
    reasons.push("modo partial (--only/--skip): no cuenta como full/static/fast");
  }
  if (!results.length) reasons.push("no se ejecutó ningún gate");
  if (missing.length) reasons.push(`faltan gates del modo: ${missing.join(", ")}`);
  if (criticalMissing.length) {
    reasons.push(`gates críticos no ejecutados: ${criticalMissing.join(", ")}`);
  }
  if (failed.length) {
    reasons.push(`gates en rojo: ${failed.map((result) => result.id).join(", ")}`);
  }
  if (expectedMismatches.length) {
    reasons.push(
      `expected no coincide: ${expectedMismatches.map((result) => result.id).join(", ")}`,
    );
  }
  if (badExit.length) {
    reasons.push(
      `exitCode/reason inválido: ${badExit.map((result) => result.id).join(", ")}`,
    );
  }
  if (badArtifacts.length) {
    reasons.push(
      `artefactos faltantes: ${badArtifacts.map((result) => result.id).join(", ")}`,
    );
  }
  if (badBuild.length) {
    reasons.push(
      `buildSha por gate no coincide con gitAtStart: ${badBuild.map((result) => result.id).join(", ")}`,
    );
  }
  if (unexpected.length) {
    reasons.push(`gates fuera del modo: ${unexpected.join(", ")}`);
  }
  if (duplicateResults.length) {
    reasons.push(`gates duplicados: ${[...new Set(duplicateResults)].join(", ")}`);
  }
  if (!cleanStart) {
    reasons.push(
      `árbol sucio al inicio (gitAtStart.dirty=${gitAtStart?.dirty ?? "?"}): commitea antes de generar evidencia`,
    );
  }
  if (!shaStable) {
    reasons.push(
      `el SHA cambió durante la corrida (${gitAtStart?.sha ?? "?"} -> ${gitAtEnd?.sha ?? "?"})`,
    );
  }
  if (!cleanEnd) {
    reasons.push(
      `el árbol quedó sucio antes de escribir la evidencia (gitAtEnd.dirty=${gitAtEnd?.dirty ?? "?"})`,
    );
  }
  if (!buildBound) {
    reasons.push(
      `buildSha del servidor ${serverBuildSha ?? "?"} no coincide con gitAtStart ${gitAtStart?.sha ?? "?"}`,
    );
  }

  return {
    ok,
    complete,
    partial,
    gatesOk,
    evidenceValid,
    buildBound,
    cleanStart,
    cleanEnd,
    shaStable,
    missing,
    criticalMissing,
    unexpected,
    duplicateResults: [...new Set(duplicateResults)],
    failed: failed.map((result) => result.id),
    expectedMismatches: expectedMismatches.map((result) => result.id),
    badExit: badExit.map((result) => result.id),
    badArtifacts: badArtifacts.map((result) => result.id),
    badBuild: badBuild.map((result) => result.id),
    reasons,
  };
}

export function buildNotRunInfo(
  selection,
  results,
  options,
  defaultReason = "no-ejecutado",
) {
  const executed = new Set(results.map((result) => result.id));
  const aborted = results.some((result) => !result.ok);
  const notRun = [];
  const notRunReasons = {};
  for (const gate of GATES) {
    if (executed.has(gate.id)) continue;
    notRun.push(gate.id);
    if (options.skip.has(gate.id)) {
      notRunReasons[gate.id] = "skip";
    } else if (!selection.expectedIds.includes(gate.id)) {
      notRunReasons[gate.id] = gate.optional
        ? "opcional-no-solicitado"
        : "fuera-del-modo";
    } else if (aborted) {
      notRunReasons[gate.id] = "no-ejecutado-tras-fallo";
    } else {
      notRunReasons[gate.id] = defaultReason;
    }
  }
  return { notRun, notRunReasons };
}

function runtimeInfo() {
  return {
    node: process.version,
    os: `${process.platform}-${process.arch}`,
    python: (IS_WIN
      ? spawnSync("python --version", {
          encoding: "utf8",
          shell: true,
        })
      : spawnSync("python", ["--version"], {
          encoding: "utf8",
          shell: false,
        })
    ).stdout.trim(),
  };
}

function buildRun({
  selection,
  options,
  startedAt,
  endedAt,
  durationMs,
  gitAtStart,
  gitAtEnd,
  resets,
  results,
  evaluation,
  serverBuildSha,
  error = null,
}) {
  const { notRun, notRunReasons } = buildNotRunInfo(
    selection,
    results,
    options,
    error ? "servidor-no-alcanzable" : "no-ejecutado",
  );
  const runtime = runtimeInfo();
  return {
    schemaVersion: 2,
    mode: selection.mode,
    requestedMode: selection.requestedMode,
    partial: evaluation.partial,
    startedAt,
    endedAt,
    durationMs,
    baseUrl: BASE,
    serverBuildSha: serverBuildSha ?? null,
    buildMatches: Boolean(serverBuildSha) && serverBuildSha === gitAtStart.sha,
    node: runtime.node,
    os: runtime.os,
    python: runtime.python,
    error,
    gitAtStart,
    gitAtEnd,
    expectedGates: selection.expectedIds,
    criticalGates: selection.criticalIds,
    skipped: selection.skipped,
    notRun,
    notRunReasons,
    resets,
    gates: results,
    complete: evaluation.complete,
    gatesOk: evaluation.gatesOk,
    evidenceValid: evaluation.evidenceValid,
    buildBound: evaluation.buildBound,
    cleanStart: evaluation.cleanStart,
    cleanEnd: evaluation.cleanEnd,
    shaStable: evaluation.shaStable,
    missing: evaluation.missing,
    criticalMissing: evaluation.criticalMissing,
    badBuild: evaluation.badBuild,
    reasons: evaluation.reasons,
    ok: evaluation.ok,
  };
}

export function handoffFileName(mode) {
  if (mode === "full") return "latest.json";
  if (mode === "static") return "latest-static.json";
  return null;
}

export function writeEvidence(run, { evidenceDir = EVIDENCE, runsDir = RUNS } = {}) {
  fs.mkdirSync(runsDir, { recursive: true });
  const file = path.join(
    runsDir,
    `${run.startedAt.replace(/[:.]/g, "-")}-${run.mode}.json`,
  );
  fs.writeFileSync(file, `${JSON.stringify(run, null, 2)}\n`, "utf8");
  const name = run.ok === true ? handoffFileName(run.mode) : null;
  const handoffFile = name ? path.join(evidenceDir, name) : null;
  if (handoffFile) {
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(
      handoffFile,
      `${JSON.stringify(run, null, 2)}\n`,
      "utf8",
    );
  }
  return { file, handoff: Boolean(handoffFile), handoffFile };
}

function printList() {
  console.log("Gates disponibles:\n");
  for (const gate of GATES) {
    const server = gate.usesMainServer
      ? `main ${BASE}`
      : gate.mode === "runtime"
        ? "aislado"
        : "sin servidor";
    console.log(
      `  ${gate.id.padEnd(12)} ${gate.mode.padEnd(8)} ${gate.name}${gate.optional ? " (opcional)" : ""}`,
    );
    console.log(`               ${gate.command} ${gate.args.join(" ")} - ${server}`);
    console.log(
      `               expected: ${Array.isArray(gate.expected) ? gate.expected.join(" + ") : gate.expected} - artefactos: ${gate.artifacts.length}`,
    );
  }
  console.log("\nModos:");
  console.log(`  --fast    ${MODE_GATES.fast.length} gates: ${MODE_GATES.fast.join(" + ")}`);
  console.log(
    `  --static  ${MODE_GATES.static.length} gates: fast + deps + build`,
  );
  console.log(
    `  --full    ${MODE_GATES.full.length} gates: runtime + guard/lint/types/deps (build NO corre en full; film solo con --with-film)`,
  );
  console.log(
    "  --only    mode partial: ejecuta solo esos gates y NUNCA queda ok:true",
  );
  console.log("  --skip    marca la corrida como partial y NUNCA queda ok:true");
  console.log(
    `\nCatálogo total: ${GATES.length} gates (build fuera de full, film opcional).`,
  );
}

function printEvaluation(evaluation) {
  for (const reason of evaluation.reasons) {
    console.log(`  - ${reason}`);
  }
}

function errorRun({
  selection,
  options,
  startedAt,
  gitAtStart,
  serverBuildSha,
  error,
}) {
  const gitAtEnd = getGit();
  const evaluation = evaluateRun({
    mode: selection.mode,
    expectedIds: selection.expectedIds,
    criticalIds: selection.criticalIds,
    results: [],
    gitAtStart,
    gitAtEnd,
    serverBuildSha,
    partial: selection.partial,
  });
  const run = buildRun({
    selection,
    options,
    startedAt,
    endedAt: new Date().toISOString(),
    durationMs: 0,
    gitAtStart,
    gitAtEnd,
    resets: [],
    results: [],
    evaluation,
    serverBuildSha,
    error,
  });
  return { run, evaluation, gitAtEnd };
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }

  if (options.help) {
    console.log(
      "Uso: node scripts/harness-gate.mjs [--fast|--static|--full] [--with-film] [--only=a,b] [--skip=c] [--list]",
    );
    return 0;
  }
  if (options.list) {
    printList();
    return 0;
  }

  let selection;
  try {
    selection = selectedGates(options);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
  if (!selection.gates.length) {
    console.error("No hay gates seleccionados.");
    return 2;
  }

  const startedAt = new Date().toISOString();
  const started = performance.now();
  const gitAtStart = getGit();

  console.log(
    `HARNESS ${selection.mode}${selection.partial ? " (partial)" : ""} - ${selection.gates.length}/${selection.expectedIds.length} gates - ${BASE}\n`,
  );
  if (gitAtStart.dirty) {
    console.log(
      "AVISO: árbol sucio al inicio (incluye untracked). Los gates pueden correr, pero `ok` será false; commitea primero.\n",
    );
  }

  const mainRuntimeGates = selection.gates.filter(
    (gate) => gate.mode === "runtime" && gate.usesMainServer,
  );
  let serverBuildSha = null;
  if (mainRuntimeGates.length) {
    const health = await getServerHealth();
    if (health.error) {
      const { run, evaluation } = errorRun({
        selection,
        options,
        startedAt,
        gitAtStart,
        serverBuildSha,
        error: `servidor no alcanzable en ${BASE}: ${health.error}`,
      });
      const evidence = writeEvidence(run);
      console.error(`FALLO: servidor no alcanzable o sin /api/health en ${BASE}`);
      console.error("Arranca el servidor con un build de este commit:");
      console.error("  cd web && npm run build && npm start");
      printEvaluation(evaluation);
      console.log(`EVIDENCIA ${relativeToRoot(evidence.file)}${evidence.handoff ? "" : " (handoff NO actualizado)"}`);
      return 1;
    }
    serverBuildSha = health.buildSha;
    if (serverBuildSha !== gitAtStart.sha) {
      const { run, evaluation } = errorRun({
        selection,
        options,
        startedAt,
        gitAtStart,
        serverBuildSha,
        error: `buildSha del servidor ${serverBuildSha} != HEAD ${gitAtStart.sha}`,
      });
      const evidence = writeEvidence(run);
      console.error(
        `FALLO: el servidor en ${BASE} no es de este commit (buildSha ${serverBuildSha}, HEAD ${gitAtStart.sha}).`,
      );
      console.error("Recompila y reinicia: cd web && npm run build && npm start");
      printEvaluation(evaluation);
      console.log(`EVIDENCIA ${relativeToRoot(evidence.file)}${evidence.handoff ? "" : " (handoff NO actualizado)"}`);
      return 1;
    }
    console.log(`BUILD SHA ${serverBuildSha} (servidor y HEAD coinciden)\n`);
  }

  const resets = [];
  const results = [];

  for (const gate of selection.gates) {
    if (gate.resetBefore) {
      try {
        await resetDemo();
        resets.push({ before: gate.id, ok: true });
        console.log(`RESET demo antes de ${gate.id}`);
      } catch (cause) {
        resets.push({
          before: gate.id,
          ok: false,
          error: cause instanceof Error ? cause.message : String(cause),
        });
        console.error(`FALLO: no pude reiniciar la demo antes de ${gate.id}`);
        results.push({
          id: gate.id,
          name: gate.name,
          command: `${gate.command} ${gate.args.join(" ")}`,
          baseUrl: gate.usesMainServer ? BASE : (gate.baseUrl ?? null),
          buildSha: gate.usesMainServer ? serverBuildSha : readBuiltSha(),
          ok: false,
          exitCode: 1,
          durationMs: 0,
          expected: gate.expected,
          expectedBasis: gate.expectedBasis ?? "output",
          expectedMatched: false,
          reason: "reset-failed",
          artifacts: [],
          outputTail: "reset de demo falló",
        });
        continue;
      }
    }
    const result = runGate(gate, { serverBuildSha });
    results.push(result);
  }

  if (!serverBuildSha) {
    serverBuildSha = readBuiltSha();
  }
  const gitAtEnd = getGit();
  const endedAt = new Date().toISOString();
  const durationMs = Math.round(performance.now() - started);
  const evaluation = evaluateRun({
    mode: selection.mode,
    expectedIds: selection.expectedIds,
    criticalIds: selection.criticalIds,
    results,
    gitAtStart,
    gitAtEnd,
    serverBuildSha,
    partial: selection.partial,
  });
  const run = buildRun({
    selection,
    options,
    startedAt,
    endedAt,
    durationMs,
    gitAtStart,
    gitAtEnd,
    resets,
    results,
    evaluation,
    serverBuildSha,
  });
  const evidence = writeEvidence(run);

  console.log("");
  if (evaluation.ok) {
    console.log(
      `HARNESS OK - ${durationMs} ms - ${results.length}/${selection.expectedIds.length}`,
    );
  } else {
    console.log(
      `HARNESS FALLÓ - ${results.filter((result) => result.ok).length}/${selection.expectedIds.length} en verde`,
    );
    printEvaluation(evaluation);
  }
  console.log(`EVIDENCIA ${relativeToRoot(evidence.file)}`);
  console.log(
    evidence.handoff
      ? `HANDOFF ${relativeToRoot(evidence.handoffFile)} + harness/STATE.md`
      : "HANDOFF no actualizado (solo full escribe latest.json y static latest-static.json con ok:true)",
  );
  console.log("VERIFICA  npm run verify:evidence (compara gitAtStart.sha con HEAD)");
  return evaluation.ok ? 0 : 1;
}

const isDirect =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirect) {
  process.exitCode = await main();
}
