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
 *   - `ok: true` solo si se ejecutaron TODOS los gates del modo y todos
 *     pasaron, incluida la validación de su marcador `expected`.
 *   - `--only` produce mode `partial` y NUNCA puede quedar `ok: true`.
 *   - Un `--skip` de un gate crítico, o un gate que no se ejecutó, impide
 *     `ok: true`.
 *   - La evidencia exige `gitAtStart.dirty=false` y que el SHA no cambie
 *     durante la corrida (`gitAtEnd.sha`). `dirty` incluye untracked.
 *
 * No arranca ni reinicia el servidor. El runtime es compartido: el agente lo
 * levanta explícitamente. Sí reinicia los datos de demo antes de truth/preflight
 * para que la evidencia sea reproducible.
 *
 * `build` es un gate de modo `build`: corre en `--static`, no en `--full`.
 * `film` es opcional: solo entra a `--full --with-film`.
 */

import { spawnSync } from "node:child_process";
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
  },
  {
    id: "lint",
    name: "ESLint",
    command: "npm",
    args: ["run", "lint"],
    mode: "static",
    timeout: 180_000,
    // ESLint no imprime un resumen en verde; el marcador solo comprueba que
    // el comando real corrió. El veredicto principal es el exit code.
    expected: "eslint",
    expectedBasis: "output",
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
  },
  {
    id: "build",
    name: "Build de producción",
    command: "npm",
    args: ["run", "build"],
    mode: "build",
    timeout: 600_000,
    expected: "compiled successfully",
    expectedBasis: "output",
  },
  {
    id: "truth",
    name: "Verdad del comprobante",
    command: "node",
    args: ["scripts/verify-truth.mjs"],
    mode: "runtime",
    resetBefore: true,
    timeout: 60_000,
    expected: "VERDAD OK",
    expectedBasis: "output",
  },
  {
    id: "webhook",
    name: "Contrato del webhook",
    command: "node",
    args: ["scripts/webhook-contract.mjs"],
    mode: "runtime",
    timeout: 120_000,
    expected: "27/27",
    expectedBasis: "output",
  },
  {
    id: "mobile",
    name: "Flujo móvil 360 px",
    command: "python",
    args: ["scripts/mobile-audit.py"],
    mode: "runtime",
    timeout: 180_000,
    expected: "25/25",
    expectedBasis: "output",
  },
  {
    id: "checkout",
    name: "Checkout público",
    command: "python",
    args: ["scripts/checkout-audit.py"],
    mode: "runtime",
    timeout: 180_000,
    expected: "15/15",
    expectedBasis: "output",
  },
  {
    id: "hig",
    name: "HIG / WCAG 2.2 AA",
    command: "python",
    args: ["scripts/hig-after-audit.py"],
    mode: "runtime",
    timeout: 900_000,
    expected: "PASÓ",
    expectedBasis: "output",
  },
  {
    id: "motion",
    name: "Movimiento y reduced-motion",
    command: "python",
    args: ["scripts/motion-check.py"],
    mode: "runtime",
    timeout: 180_000,
    expected: "0 FAIL",
    expectedBasis: "output",
  },
  {
    id: "contrast",
    name: "Alto contraste",
    command: "python",
    args: ["scripts/a11y-contrast.py"],
    mode: "runtime",
    timeout: 180_000,
    expected: "0 FAIL",
    expectedBasis: "output",
  },
  {
    id: "rehearsal",
    name: "Ensayo del guion",
    command: "python",
    args: ["scripts/rehearse-demo.py"],
    mode: "runtime",
    timeout: 300_000,
    expected: "todo en verde: True",
    expectedBasis: "output",
  },
  {
    id: "tunnel",
    name: "Túnel público",
    command: "python",
    args: ["scripts/tunnel-smoke.py"],
    mode: "runtime",
    timeout: 300_000,
    expected: "8/8",
    expectedBasis: "output",
  },
  {
    id: "preflight",
    name: "Preflight de demo",
    command: "node",
    args: ["scripts/preflight.mjs"],
    mode: "runtime",
    resetBefore: true,
    timeout: 120_000,
    expected: "18/18",
    expectedBasis: "output",
  },
  {
    id: "film",
    name: "Film check Stageshow",
    command: "python",
    args: ["scripts/film-check.py"],
    mode: "runtime",
    optional: true,
    timeout: 300_000,
    expected: "SHEET",
    expectedBasis: "output",
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
    throw new GateConfigError(
      `Elige un solo modo: ${modeFlags.join(", ")}.`,
    );
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
    // `film` solo es crítico cuando se pidió explícitamente con --with-film.
    return options.mode === "full" && id === "film";
  });
}

export function selectedGates(options) {
  if (options.only?.length) validateIds(options.only, "Gate");
  if (options.skip.size) validateIds([...options.skip], "Gate en --skip");

  const expectedIds = expectedGateIds(options);
  const ids = expectedIds.filter((id) => !options.skip.has(id));
  return {
    mode: options.mode,
    requestedMode: options.requestedMode,
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
    // evidencia, no solo un archivo tracked modificado.
    dirty: Boolean(gitValue(["status", "--porcelain", "--untracked-files=all"])),
  };
}

async function serverIsUp() {
  try {
    const response = await fetch(`${BASE}/api/dashboard`, {
      signal: AbortSignal.timeout(8_000),
    });
    return response.ok;
  } catch {
    return false;
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

export function expectedMatches(expected, output) {
  if (expected == null) return null;
  const values = Array.isArray(expected) ? expected : [expected];
  if (!values.length) return null;
  const normalized = normalizeOutput(output);
  return values.every((value) => normalized.includes(normalizeOutput(value)));
}

function runGate(gate) {
  const command = [gate.command, ...gate.args].join(" ");
  const started = performance.now();
  const environment = {
    ...process.env,
    BASE_URL: BASE,
    CI: "1",
  };
  const result = IS_WIN
    ? spawnSync(command, {
        cwd: WEB,
        encoding: "utf8",
        env: environment,
        timeout: gate.timeout,
        maxBuffer: 20 * 1024 * 1024,
        shell: true,
      })
    : spawnSync(gate.command, gate.args, {
        cwd: WEB,
        encoding: "utf8",
        env: environment,
        timeout: gate.timeout,
        maxBuffer: 20 * 1024 * 1024,
        shell: false,
      });
  const durationMs = Math.round(performance.now() - started);
  const output = redact(`${result.stdout ?? ""}\n${result.stderr ?? ""}`).trim();
  const expectedMatched = expectedMatches(gate.expected, output);
  const exitCode = result.status ?? 1;
  const timedOut =
    Boolean(result.error) &&
    (result.error.code === "ETIMEDOUT" ||
      /timed?\s*out/i.test(result.error.message ?? ""));
  const ok =
    result.status === 0 &&
    !result.error &&
    expectedMatched !== false;
  const reason = result.error
    ? timedOut
      ? "timeout"
      : "spawn-error"
    : result.status !== 0
      ? "exit-code"
      : expectedMatched === false
        ? "expected-mismatch"
        : "ok";
  const tail = output.split(/\r?\n/).slice(-40).join("\n");

  console.log(
    `${ok ? "PASS" : "FAIL"}  ${gate.id.padEnd(10)} ${gate.name} — ${durationMs} ms${gate.expected ? ` · esperado: ${gate.expected}` : " · solo exit code"}${expectedMatched === false ? " · MARCADOR NO ENCONTRADO" : ""}`,
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
    ok,
    exitCode,
    durationMs,
    expected: gate.expected,
    expectedBasis: gate.expectedBasis ?? "output",
    expectedMatched,
    reason,
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
}) {
  const executed = new Set(results.map((result) => result.id));
  const ids = results.map((result) => result.id);
  const duplicateResults = ids.filter((id, index) => ids.indexOf(id) !== index);
  const missing = expectedIds.filter((id) => !executed.has(id));
  const criticalMissing = missing.filter((id) => criticalIds.includes(id));
  const unexpected = [...executed].filter((id) => !expectedIds.includes(id));
  const failed = results.filter((result) => !result.ok);
  const expectedMismatches = results.filter(
    (result) => result.expectedMatched === false,
  );
  const gatesOk =
    results.length > 0 &&
    failed.length === 0 &&
    expectedMismatches.length === 0 &&
    duplicateResults.length === 0;
  const complete =
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
  const partial = mode === "partial";
  const ok =
    complete &&
    gatesOk &&
    criticalMissing.length === 0 &&
    evidenceValid;

  const reasons = [];
  if (partial) {
    reasons.push("modo partial (--only): no cuenta como full/static/fast");
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
      `el SHA cambió durante la corrida (${gitAtStart?.sha ?? "?"} → ${gitAtEnd?.sha ?? "?"})`,
    );
  }
  if (!cleanEnd) {
    reasons.push(
      `el árbol quedó sucio antes de escribir la evidencia (gitAtEnd.dirty=${gitAtEnd?.dirty ?? "?"})`,
    );
  }

  return {
    ok,
    complete,
    partial,
    gatesOk,
    evidenceValid,
    cleanStart,
    cleanEnd,
    shaStable,
    missing,
    criticalMissing,
    unexpected,
    duplicateResults: [...new Set(duplicateResults)],
    failed: failed.map((result) => result.id),
    expectedMismatches: expectedMismatches.map((result) => result.id),
    reasons,
  };
}

export function buildNotRunInfo(selection, results, options, defaultReason = "no-ejecutado") {
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
    platform: process.platform,
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
  finishedAt,
  durationMs,
  gitAtStart,
  gitAtEnd,
  resets,
  results,
  evaluation,
  error = null,
}) {
  const { notRun, notRunReasons } = buildNotRunInfo(
    selection,
    results,
    options,
    error ? "servidor-no-alcanzable" : "no-ejecutado",
  );
  return {
    schemaVersion: 2,
    mode: selection.mode,
    requestedMode: selection.requestedMode,
    partial: evaluation.partial,
    startedAt,
    finishedAt,
    durationMs,
    baseUrl: BASE,
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
    cleanStart: evaluation.cleanStart,
    cleanEnd: evaluation.cleanEnd,
    shaStable: evaluation.shaStable,
    missing: evaluation.missing,
    criticalMissing: evaluation.criticalMissing,
    reasons: evaluation.reasons,
    ok: evaluation.ok,
  };
}

function writeEvidence(run) {
  fs.mkdirSync(RUNS, { recursive: true });
  const file = path.join(
    RUNS,
    `${run.startedAt.replace(/[:.]/g, "-")}-${run.mode}.json`,
  );
  fs.writeFileSync(file, `${JSON.stringify(run, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    path.join(EVIDENCE, "latest.json"),
    `${JSON.stringify(run, null, 2)}\n`,
    "utf8",
  );
  return file;
}

function printList() {
  console.log("Gates disponibles:\n");
  for (const gate of GATES) {
    console.log(
      `  ${gate.id.padEnd(10)} ${gate.mode.padEnd(8)} ${gate.name}${gate.optional ? " (opcional)" : ""}`,
    );
    console.log(
      `             ${gate.command} ${gate.args.join(" ")} · ${gate.expectedBasis === "exit-code" ? "solo exit code" : `expected: ${gate.expected}`}`,
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
  console.log(
    "\nCatálogo total: 16 gates (build fuera de full, film opcional).",
  );
}

function printEvaluation(evaluation) {
  for (const reason of evaluation.reasons) {
    console.log(`  - ${reason}`);
  }
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : String(error),
    );
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
    `HARNESS ${selection.mode}${selection.mode === "partial" ? " (--only)" : ""} · ${selection.gates.length}/${selection.expectedIds.length} gates · ${BASE}\n`,
  );
  if (gitAtStart.dirty) {
    console.log(
      "AVISO: árbol sucio al inicio (incluye untracked). Los gates pueden correr, pero `ok` será false; commitea primero.\n",
    );
  }

  const runtimeGates = selection.gates.filter(
    (gate) => gate.mode === "runtime",
  );
  if (runtimeGates.length && !(await serverIsUp())) {
    const gitAtEnd = getGit();
    const evaluation = evaluateRun({
      mode: selection.mode,
      expectedIds: selection.expectedIds,
      criticalIds: selection.criticalIds,
      results: [],
      gitAtStart,
      gitAtEnd,
    });
    const run = buildRun({
      selection,
      options,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Math.round(performance.now() - started),
      gitAtStart,
      gitAtEnd,
      resets: [],
      results: [],
      evaluation,
      error: `servidor no alcanzable en ${BASE}`,
    });
    const file = writeEvidence(run);
    console.error(`FALLO: servidor no alcanzable en ${BASE}`);
    console.error("Arranca el servidor explícitamente:");
    console.error("  cd web && npm run build && npm start");
    console.error(
      "O corre un modo sin servidor: npm run verify:fast / verify:static",
    );
    printEvaluation(evaluation);
    console.log(`EVIDENCIA ${path.relative(ROOT, file).replace(/\\/g, "/")}`);
    return 1;
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
        console.error(
          `FALLO: no pude reiniciar la demo antes de ${gate.id}`,
        );
        results.push({
          id: gate.id,
          name: gate.name,
          command: `${gate.command} ${gate.args.join(" ")}`,
          ok: false,
          exitCode: 1,
          durationMs: 0,
          expected: gate.expected,
          expectedBasis: gate.expectedBasis ?? "output",
          expectedMatched: null,
          reason: "reset-failed",
          outputTail: "reset de demo falló",
        });
        break;
      }
    }
    const result = runGate(gate);
    results.push(result);
    if (!result.ok) break;
  }

  const gitAtEnd = getGit();
  const finishedAt = new Date().toISOString();
  const durationMs = Math.round(performance.now() - started);
  const evaluation = evaluateRun({
    mode: selection.mode,
    expectedIds: selection.expectedIds,
    criticalIds: selection.criticalIds,
    results,
    gitAtStart,
    gitAtEnd,
  });
  const run = buildRun({
    selection,
    options,
    startedAt,
    finishedAt,
    durationMs,
    gitAtStart,
    gitAtEnd,
    resets,
    results,
    evaluation,
  });
  const file = writeEvidence(run);

  console.log("");
  if (evaluation.ok) {
    console.log(
      `HARNESS OK · ${durationMs} ms · ${results.length}/${selection.expectedIds.length}`,
    );
  } else {
    console.log(
      `HARNESS FALLÓ · ${results.filter((result) => result.ok).length}/${selection.expectedIds.length} en verde`,
    );
    printEvaluation(evaluation);
  }
  console.log(`EVIDENCIA ${path.relative(ROOT, file).replace(/\\/g, "/")}`);
  console.log("HANDOFF   harness/evidence/latest.json + harness/STATE.md");
  console.log("VERIFICA  npm run verify:evidence (compara gitAtStart.sha con HEAD)");
  return evaluation.ok ? 0 : 1;
}

const isDirect =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirect) {
  process.exitCode = await main();
}
