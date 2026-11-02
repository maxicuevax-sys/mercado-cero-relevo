#!/usr/bin/env node
/**
 * Verificación de integridad de la evidencia del harness.
 *
 * Uso:
 *   node scripts/verify-evidence.mjs
 *   node scripts/verify-evidence.mjs --json
 *
 * Compara `harness/evidence/latest.json` con el HEAD actual y falla si:
 *   - `gitAtStart.sha` no es HEAD,
 *   - `gitAtStart.dirty` no es false,
 *   - `gitAtEnd.sha` cambió,
 *   - `ok`/`complete` no son true,
 *   - falta un gate del modo, hay un skip crítico o un expected no validado,
 *   - los artefactos de motion/contraste no declaran el mismo commit limpio.
 *
 * No genera evidencia ni toca la app. Es el chequeo de handoff.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GATES_BY_ID, MODE_GATES, getGit } from "./harness-gate.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const ROOT = path.resolve(WEB, "..");
const LATEST = path.join(ROOT, "harness", "evidence", "latest.json");
const KNOWN_MODES = ["fast", "static", "full"];

const ARTIFACTS = {
  motion: "harness/evidence/motion-check.json",
  contrast: "harness/evidence/a11y-contrast.json",
  hig: "demo/hig-after/audit.json",
};

export function expectedIdsForEvidence(evidence) {
  const mode = evidence?.mode;
  const base = MODE_GATES[mode];
  if (!base) return [];
  if (
    mode === "full" &&
    Array.isArray(evidence.expectedGates) &&
    evidence.expectedGates.includes("film")
  ) {
    return [...base, "film"];
  }
  return [...base];
}

function criticalIdsForEvidence(evidence, expectedIds) {
  return expectedIds.filter((id) => {
    const gate = GATES_BY_ID.get(id);
    if (!gate) return true;
    return !gate.optional || (evidence.mode === "full" && id === "film");
  });
}

function sameSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  const leftSet = new Set(left);
  if (leftSet.size !== left.length) return false;
  return right.every((value) => leftSet.has(value));
}

function timestamp(value) {
  const time = Date.parse(String(value ?? ""));
  return Number.isFinite(time) ? time : null;
}

export function validateEvidence(
  evidence,
  { headSha, artifacts = null } = {},
) {
  const checks = [];
  const warnings = [];
  const check = (name, ok, detail = "") => {
    checks.push({ name, ok: Boolean(ok), detail });
  };

  if (!evidence || typeof evidence !== "object") {
    return {
      ok: false,
      checks: [{ name: "latest.json es un objeto", ok: false, detail: "" }],
      warnings,
    };
  }

  const mode = evidence.mode;
  const expectedIds = expectedIdsForEvidence(evidence);
  const criticalIds = criticalIdsForEvidence(evidence, expectedIds);
  const gates = Array.isArray(evidence.gates) ? evidence.gates : [];
  const gateIds = gates.map((gate) => gate.id);
  const expectedField = Array.isArray(evidence.expectedGates)
    ? evidence.expectedGates
    : [];

  check(
    "schemaVersion >= 2",
    Number(evidence.schemaVersion) >= 2,
    `schemaVersion=${evidence.schemaVersion}`,
  );
  check(
    "mode es full/static/fast (no partial)",
    KNOWN_MODES.includes(mode) && evidence.partial !== true,
    `mode=${mode} partial=${evidence.partial}`,
  );
  check("ok global es true", evidence.ok === true, `ok=${evidence.ok}`);
  check(
    "complete es true",
    evidence.complete === true,
    `complete=${evidence.complete}`,
  );
  check(
    "gitAtStart.sha === HEAD",
    Boolean(headSha) && evidence.gitAtStart?.sha === headSha,
    `${evidence.gitAtStart?.sha ?? "?"} vs ${headSha ?? "?"}`,
  );
  check(
    "gitAtStart.dirty === false",
    evidence.gitAtStart?.dirty === false,
    `dirty=${evidence.gitAtStart?.dirty}`,
  );
  check(
    "gitAtEnd.sha === gitAtStart.sha",
    Boolean(evidence.gitAtEnd) &&
      evidence.gitAtEnd?.sha === evidence.gitAtStart?.sha,
    `${evidence.gitAtEnd?.sha ?? "?"} vs ${evidence.gitAtStart?.sha ?? "?"}`,
  );
  check(
    "gitAtEnd.dirty === false",
    evidence.gitAtEnd?.dirty === false,
    `dirty=${evidence.gitAtEnd?.dirty}`,
  );
  check(
    "expectedGates coincide con el modo",
    expectedIds.length > 0 && sameSet(expectedField, expectedIds),
    `declarado=${expectedField.join(",")} esperado=${expectedIds.join(",")}`,
  );
  check(
    "gates[] tiene exactamente los gates del modo",
    expectedIds.length > 0 &&
      gates.length === expectedIds.length &&
      sameSet(gateIds, expectedIds),
    `${gates.length}/${expectedIds.length}: ${gateIds.join(",")}`,
  );
  check(
    "no hay gates duplicados",
    new Set(gateIds).size === gateIds.length,
    "",
  );
  check(
    "todos los gates están ok",
    gates.length > 0 && gates.every((gate) => gate.ok === true),
    gates
      .filter((gate) => gate.ok !== true)
      .map((gate) => gate.id)
      .join(","),
  );

  const expectedProblems = [];
  for (const gate of gates) {
    const canonical = GATES_BY_ID.get(gate.id);
    if (!canonical) {
      expectedProblems.push(`${gate.id}: gate desconocido`);
      continue;
    }
    if (gate.expected !== canonical.expected) {
      expectedProblems.push(
        `${gate.id}: expected declarado ${JSON.stringify(gate.expected)} ≠ canónico ${JSON.stringify(canonical.expected)}`,
      );
    }
    if (gate.expectedBasis !== canonical.expectedBasis) {
      expectedProblems.push(
        `${gate.id}: expectedBasis ${gate.expectedBasis} ≠ ${canonical.expectedBasis}`,
      );
    }
    if (canonical.expected == null) {
      if (gate.expectedMatched !== null) {
        expectedProblems.push(
          `${gate.id}: sin expected pero expectedMatched=${gate.expectedMatched}`,
        );
      }
    } else if (gate.expectedMatched !== true) {
      expectedProblems.push(
        `${gate.id}: expectedMatched=${gate.expectedMatched}`,
      );
    }
  }
  check(
    "cada expected se validó contra la salida",
    expectedProblems.length === 0,
    expectedProblems.slice(0, 6).join(" | "),
  );

  const skipped = Array.isArray(evidence.skipped) ? evidence.skipped : [];
  const criticalSkips = skipped.filter((id) => criticalIds.includes(id));
  check(
    "no hay skips críticos",
    criticalSkips.length === 0,
    criticalSkips.join(","),
  );

  const notRun = Array.isArray(evidence.notRun) ? evidence.notRun : [];
  const criticalNotRun = notRun.filter((id) => criticalIds.includes(id));
  check(
    "no hay gates críticos en notRun",
    criticalNotRun.length === 0,
    criticalNotRun.join(","),
  );

  const missing = Array.isArray(evidence.missing) ? evidence.missing : [];
  const criticalMissing = Array.isArray(evidence.criticalMissing)
    ? evidence.criticalMissing
    : [];
  check(
    "missing y criticalMissing están vacíos",
    missing.length === 0 && criticalMissing.length === 0,
    [...missing, ...criticalMissing].join(","),
  );

  const resets = Array.isArray(evidence.resets) ? evidence.resets : [];
  const resetProblems = expectedIds
    .filter((id) => id === "truth" || id === "preflight")
    .filter(
      (id) =>
        !resets.some((reset) => reset.before === id && reset.ok === true),
    );
  check(
    "truth/preflight tienen reset de demo registrado",
    resetProblems.length === 0,
    resetProblems.join(","),
  );

  const started = timestamp(evidence.startedAt);
  const finished = timestamp(evidence.finishedAt);
  check(
    "timestamps coherentes",
    started !== null &&
      finished !== null &&
      finished >= started &&
      Number(evidence.durationMs) >= 0,
    `${evidence.startedAt} → ${evidence.finishedAt} · ${evidence.durationMs} ms`,
  );

  check(
    "baseUrl presente",
    typeof evidence.baseUrl === "string" && evidence.baseUrl.length > 0,
    evidence.baseUrl,
  );

  if (artifacts) {
    for (const id of ["motion", "contrast"]) {
      const gate = gates.find((item) => item.id === id && item.ok === true);
      if (!gate) continue;
      const artifact = artifacts[id];
      if (!artifact || typeof artifact !== "object") {
        check(`artefacto ${id} presente`, false, ARTIFACTS[id]);
        continue;
      }
      check(
        `artefacto ${id} declara el mismo commit`,
        artifact.code?.commit === evidence.gitAtStart?.sha,
        `${artifact.code?.commit ?? "?"} vs ${evidence.gitAtStart?.sha ?? "?"}`,
      );
      check(
        `artefacto ${id} declara dirty:false`,
        artifact.code?.dirty === false,
        `dirty=${artifact.code?.dirty}`,
      );
    }

    const higGate = gates.find((item) => item.id === "hig" && item.ok === true);
    if (higGate) {
      const hig = artifacts.hig;
      if (hig && typeof hig === "object" && hig.code) {
        check(
          "artefacto hig declara el mismo commit",
          hig.code.commit === evidence.gitAtStart?.sha,
          `${hig.code.commit ?? "?"} vs ${evidence.gitAtStart?.sha ?? "?"}`,
        );
        check(
          "artefacto hig declara dirty:false",
          hig.code.dirty === false,
          `dirty=${hig.code.dirty}`,
        );
      } else {
        warnings.push(
          "HIG: demo/hig-after/audit.json no está disponible (gitignored); no se pudo cruzar el commit.",
        );
      }
    }
  }

  return {
    ok: checks.every((item) => item.ok),
    checks,
    warnings,
  };
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return {
      invalid: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function readArtifacts() {
  const artifacts = {};
  for (const [id, relative] of Object.entries(ARTIFACTS)) {
    const file = path.join(ROOT, relative);
    artifacts[id] = fs.existsSync(file) ? readJson(file) : null;
  }
  return artifacts;
}

function main() {
  const json = process.argv.includes("--json");
  if (!fs.existsSync(LATEST)) {
    console.error(`EVIDENCIA INVÁLIDA: falta ${path.relative(ROOT, LATEST)}`);
    return 1;
  }

  const latest = readJson(LATEST);
  if (latest.invalid) {
    console.error(`EVIDENCIA INVÁLIDA: latest.json no parsea (${latest.error})`);
    return 1;
  }

  const head = getGit();
  const result = validateEvidence(latest, {
    headSha: head.sha,
    artifacts: readArtifacts(),
  });

  if (json) {
    console.log(
      JSON.stringify(
        {
          ok: result.ok,
          head,
          evidence: {
            mode: latest.mode,
            sha: latest.gitAtStart?.sha,
            startedAt: latest.startedAt,
            finishedAt: latest.finishedAt,
          },
          checks: result.checks,
          warnings: result.warnings,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(
      `EVIDENCIA ${latest.mode} · ${String(latest.gitAtStart?.sha ?? "?").slice(0, 7)} · HEAD ${head.sha.slice(0, 7)}\n`,
    );
    for (const item of result.checks) {
      console.log(
        `${item.ok ? "PASS" : "FAIL"}  ${item.name}${item.detail ? ` — ${item.detail}` : ""}`,
      );
    }
    for (const warning of result.warnings) {
      console.log(`WARN  ${warning}`);
    }
    console.log("");
    if (result.ok) {
      console.log(
        `EVIDENCIA OK: ${latest.mode} en ${latest.gitAtStart?.sha} · ${latest.gates?.length ?? 0} gates · gitAtStart.dirty:false.`,
      );
    } else {
      const failed = result.checks.filter((item) => !item.ok);
      console.log(
        `EVIDENCIA INVÁLIDA: ${failed.length} chequeo(s) fallaron. La corrida no es handoff de este HEAD.`,
      );
    }
  }

  return result.ok ? 0 : 1;
}

const isDirect =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirect) {
  process.exitCode = main();
}
