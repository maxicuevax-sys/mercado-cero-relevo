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
 * No arranca ni reinicia el servidor. El runtime es compartido: el agente lo
 * levanta explícitamente. Sí reinicia los datos de demo antes de truth/preflight
 * para que la evidencia sea reproducible.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const ROOT = path.resolve(WEB, "..");
const EVIDENCE = path.join(ROOT, "harness", "evidence");
const RUNS = path.join(EVIDENCE, "runs");
const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const IS_WIN = process.platform === "win32";

const GATES = [
  {
    id: "guard",
    name: "Guardrails del repo",
    command: "node",
    args: ["scripts/harness-guard.mjs"],
    mode: "static",
    timeout: 60_000,
    expected: "Guardrails OK.",
  },
  {
    id: "lint",
    name: "ESLint",
    command: "npm",
    args: ["run", "lint"],
    mode: "static",
    timeout: 180_000,
    expected: "sin errores",
  },
  {
    id: "types",
    name: "TypeScript",
    command: "npx",
    args: ["tsc", "--noEmit"],
    mode: "static",
    timeout: 180_000,
    expected: "sin errores",
  },
  {
    id: "build",
    name: "Build de producción",
    command: "npm",
    args: ["run", "build"],
    mode: "build",
    timeout: 600_000,
    expected: "compiled successfully",
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
  },
  {
    id: "webhook",
    name: "Contrato del webhook",
    command: "node",
    args: ["scripts/webhook-contract.mjs"],
    mode: "runtime",
    timeout: 120_000,
    expected: "27/27",
  },
  {
    id: "mobile",
    name: "Flujo móvil 360 px",
    command: "python",
    args: ["scripts/mobile-audit.py"],
    mode: "runtime",
    timeout: 180_000,
    expected: "25/25",
  },
  {
    id: "checkout",
    name: "Checkout público",
    command: "python",
    args: ["scripts/checkout-audit.py"],
    mode: "runtime",
    timeout: 180_000,
    expected: "15/15",
  },
  {
    id: "hig",
    name: "HIG / WCAG 2.2 AA",
    command: "python",
    args: ["scripts/hig-after-audit.py"],
    mode: "runtime",
    timeout: 900_000,
    expected: "PASÓ",
  },
  {
    id: "motion",
    name: "Movimiento y reduced-motion",
    command: "python",
    args: ["scripts/motion-check.py"],
    mode: "runtime",
    timeout: 180_000,
    expected: "0 FAIL",
  },
  {
    id: "rehearsal",
    name: "Ensayo del guion",
    command: "python",
    args: ["scripts/rehearse-demo.py"],
    mode: "runtime",
    timeout: 300_000,
    expected: "todo en verde: True",
  },
  {
    id: "tunnel",
    name: "Túnel público",
    command: "python",
    args: ["scripts/tunnel-smoke.py"],
    mode: "runtime",
    timeout: 300_000,
    expected: "8/8",
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
  },
];

function parseArgs(argv) {
  const getValue = (flag) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : null;
  };
  const mode = argv.includes("--fast")
    ? "fast"
    : argv.includes("--static")
      ? "static"
      : "full";
  return {
    mode,
    withFilm: argv.includes("--with-film"),
    list: argv.includes("--list"),
    help: argv.includes("--help") || argv.includes("-h"),
    only: getValue("--only")
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    skip: new Set(
      (getValue("--skip") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  };
}

function selectedGates(options) {
  let ids;
  if (options.only?.length) {
    ids = options.only;
  } else if (options.mode === "fast") {
    ids = ["guard", "lint", "types"];
  } else if (options.mode === "static") {
    ids = ["guard", "lint", "types", "build"];
  } else {
    ids = GATES.filter(
      (gate) => gate.mode !== "build" && !gate.optional,
    ).map((gate) => gate.id);
    if (options.withFilm) ids.push("film");
  }

  const unknown = ids.filter((id) => !GATES.some((gate) => gate.id === id));
  if (unknown.length) {
    console.error(`Gate(s) desconocido(s): ${unknown.join(", ")}`);
    console.error(`Disponibles: ${GATES.map((gate) => gate.id).join(", ")}`);
    process.exit(2);
  }

  return GATES.filter(
    (gate) => ids.includes(gate.id) && !options.skip.has(gate.id),
  );
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
  output = output.replace(/\b(sk-[A-Za-z0-9_-]{20,}|whsec_[A-Za-z0-9_-]{20,})\b/g, "[redacted]");
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

function getGit() {
  return {
    sha: gitValue(["rev-parse", "HEAD"]) || "unknown",
    branch: gitValue(["rev-parse", "--abbrev-ref", "HEAD"]) || "unknown",
    dirty: Boolean(gitValue(["status", "--porcelain", "--untracked-files=no"])),
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
  const ok = result.status === 0 && !result.error;
  const exitCode = result.status ?? 1;
  const tail = output.split(/\r?\n/).slice(-40).join("\n");

  console.log(
    `${ok ? "PASS" : "FAIL"}  ${gate.id.padEnd(10)} ${gate.name} — ${durationMs} ms${gate.expected ? ` · esperado: ${gate.expected}` : ""}`,
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
  }

  return {
    id: gate.id,
    name: gate.name,
    command,
    ok,
    exitCode,
    durationMs,
    expected: gate.expected,
    outputTail: tail,
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
    const mode =
      gate.mode === "runtime"
        ? "runtime"
        : gate.mode === "build"
          ? "build"
          : "static";
    console.log(
      `  ${gate.id.padEnd(10)} ${mode.padEnd(8)} ${gate.name}${gate.optional ? " (opcional)" : ""}`,
    );
    console.log(`             ${gate.command} ${gate.args.join(" ")}`);
  }
  console.log("\nModos:");
  console.log("  --fast    guard + lint + types");
  console.log("  --static  fast + build");
  console.log("  --full    todo el runtime (sin film salvo --with-film)");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
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

  const gates = selectedGates(options);
  if (!gates.length) {
    console.error("No hay gates seleccionados.");
    return 2;
  }

  const runtimeGates = gates.filter((gate) => gate.mode === "runtime");
  if (runtimeGates.length && !(await serverIsUp())) {
    console.error(`FALLO: servidor no alcanzable en ${BASE}`);
    console.error("Arranca el servidor explícitamente:");
    console.error("  cd web && npm run build && npm start");
    console.error("O corre un modo sin servidor: npm run verify:fast / verify:static");
    return 1;
  }

  const gitAtStart = getGit();
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const evidenceGates = [];
  const resets = [];

  console.log(`HARNESS ${options.mode} · ${gates.length} gates · ${BASE}\n`);

  for (const gate of gates) {
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
        evidenceGates.push({
          id: gate.id,
          name: gate.name,
          command: `${gate.command} ${gate.args.join(" ")}`,
          ok: false,
          exitCode: 1,
          durationMs: 0,
          expected: gate.expected,
          outputTail: "reset de demo falló",
        });
        break;
      }
    }
    const result = runGate(gate);
    evidenceGates.push(result);
    if (!result.ok) break;
  }

  const finishedAt = new Date().toISOString();
  const durationMs = Math.round(performance.now() - started);
  const ok = evidenceGates.length === gates.length && evidenceGates.every((gate) => gate.ok);
  const run = {
    schemaVersion: 1,
    mode: options.mode,
    startedAt,
    finishedAt,
    durationMs,
    baseUrl: BASE,
    gitAtStart,
    git: getGit(),
    runtime: {
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
    },
    skipped: [...options.skip],
    notRun: GATES.filter((gate) => !gates.includes(gate)).map((gate) => gate.id),
    resets,
    gates: evidenceGates,
    ok,
  };
  const file = writeEvidence(run);

  console.log("");
  if (ok) {
    console.log(`HARNESS OK · ${durationMs} ms · ${evidenceGates.length}/${gates.length}`);
  } else {
    console.log(`HARNESS FALLÓ · ${evidenceGates.filter((gate) => gate.ok).length}/${gates.length} en verde`);
  }
  console.log(`EVIDENCIA ${path.relative(ROOT, file).replace(/\\/g, "/")}`);
  console.log("HANDOFF   harness/evidence/latest.json + harness/STATE.md");
  return ok ? 0 : 1;
}

process.exitCode = await main();
