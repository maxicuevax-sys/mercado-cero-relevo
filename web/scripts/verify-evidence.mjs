#!/usr/bin/env node
/**
 * Verificación de integridad de la evidencia del harness.
 *
 * Uso:
 *   node scripts/verify-evidence.mjs
 *   node scripts/verify-evidence.mjs --json
 *   node scripts/verify-evidence.mjs --allow-fast
 *   node scripts/verify-evidence.mjs --static
 *
 * Compara `harness/evidence/latest.json` (full) o
 * `harness/evidence/latest-static.json` (static, con --static) con el HEAD y
 * el árbol actual. Falla si:
 *   - el modo es `fast` sin --allow-fast, o es partial;
 *   - falta complete/ok/exitCode 0/reason "ok"/expectedMatched;
 *   - el expected canónico no aparece en outputTail (se recalcula);
 *   - gitAtStart no es HEAD, el árbol está sucio o el SHA cambió;
 *   - serverBuildSha o el buildSha de cada gate runtime no coincide;
 *   - falta un gate, un skip crítico o criticalGates está manipulado;
 *   - un artefacto declarado no existe, su hash/tamaño no coincide o no
 *     pertenece al set canónico del gate;
 *   - un JSON de evidencia declara otro commit o dirty:true (code o git).
 *
 * No genera evidencia ni toca la app. Es el chequeo de handoff.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GATES_BY_ID, MODE_GATES, expectedMatches, getGit } from "./harness-gate.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const ROOT = path.resolve(WEB, "..");
const LATEST = path.join(ROOT, "harness", "evidence", "latest.json");
const LATEST_STATIC = path.join(
  ROOT,
  "harness",
  "evidence",
  "latest-static.json",
);
const KNOWN_MODES = ["fast", "static", "full"];
const KNOWN_FLAGS = new Set(["--json", "--allow-fast", "--static"]);

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

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/**
 * Comprueba los artefactos embebidos: ruta relativa segura, existencia,
 * SHA-256 y tamaño. También cruza `code.commit`/`code.dirty` y
 * `git.sha`/`git.dirty` cuando el JSON los declara, para que un artefacto
 * viejo o sucio no pase como evidencia de este HEAD. p0-dinero debe declarar
 * el bloque `git` (no `code`).
 */
export function artifactProblems(
  artifacts,
  { root = ROOT, startSha, requireGitBlock = false } = {},
) {
  const problems = [];
  if (!Array.isArray(artifacts)) {
    return ["artifacts no es un array"];
  }
  const seen = new Set();
  for (const artifact of artifacts) {
    if (!artifact || typeof artifact !== "object") {
      problems.push("artefacto sin objeto");
      continue;
    }
    const relative = String(artifact.path ?? "").replace(/\\/g, "/");
    if (!relative) {
      problems.push("artefacto sin path");
      continue;
    }
    if (seen.has(relative)) {
      problems.push(`${relative}: artefacto duplicado`);
    }
    seen.add(relative);
    if (path.isAbsolute(relative) || relative.split("/").includes("..")) {
      problems.push(`${relative}: ruta fuera del repo`);
      continue;
    }
    const absolute = path.join(root, relative);
    if (artifact.exists !== true) {
      problems.push(`${relative}: marcado como no existente`);
      continue;
    }
    if (!fs.existsSync(absolute)) {
      problems.push(`${relative}: no existe`);
      continue;
    }
    const stat = fs.statSync(absolute);
    if (!stat.isFile()) {
      problems.push(`${relative}: no es un archivo`);
      continue;
    }
    if (!/^[0-9a-f]{64}$/i.test(String(artifact.sha256 ?? ""))) {
      problems.push(`${relative}: sha256 inválido`);
    } else {
      const actual = sha256File(absolute);
      if (actual !== artifact.sha256) {
        problems.push(`${relative}: sha256 no coincide`);
      }
    }
    if (artifact.size !== stat.size) {
      problems.push(`${relative}: tamaño ${artifact.size} != ${stat.size}`);
    }
    if (relative.endsWith(".json")) {
      try {
        const body = JSON.parse(fs.readFileSync(absolute, "utf8"));
        if (body?.code && startSha && body.code.commit !== startSha) {
          problems.push(
            `${relative}: code.commit ${body.code.commit ?? "?"} != ${startSha}`,
          );
        }
        if (body?.code && body.code.dirty !== false) {
          problems.push(`${relative}: code.dirty=${body.code.dirty}`);
        }
        if (body?.git && typeof body.git === "object") {
          if (startSha && body.git.sha !== startSha) {
            problems.push(
              `${relative}: git.sha ${body.git.sha ?? "?"} != ${startSha}`,
            );
          }
          if (body.git.dirty !== false) {
            problems.push(`${relative}: git.dirty=${body.git.dirty}`);
          }
        }
        if (requireGitBlock && (!body?.git || typeof body.git !== "object")) {
          problems.push(`${relative}: falta el bloque git (sha/dirty)`);
        }
      } catch {
        problems.push(`${relative}: JSON inválido`);
      }
    }
  }
  return problems;
}

function globMatches(pattern, relative) {
  const escaped = String(pattern)
    .replace(/\\/g, "/")
    .split("*")
    .map((part) => part.replace(/[.+^${}()|[\]\\]/g, "\\$&"))
    .join("[^/]*");
  return new RegExp(`^${escaped}$`).test(relative);
}

/**
 * El set de artefactos de un gate no puede ser inventado. Si el catálogo
 * declara patrones, cada patrón debe estar cubierto y ningún path puede quedar
 * fuera. Un `artifacts: []` en un gate que declara artefactos es FAIL.
 */
export function canonicalArtifactProblems(
  gate,
  canonical,
  { root = ROOT, startSha } = {},
) {
  const problems = [];
  const patterns = (canonical.artifacts ?? []).map((pattern) =>
    String(pattern).replace(/\\/g, "/"),
  );
  const artifacts = Array.isArray(gate.artifacts) ? gate.artifacts : [];
  if (!patterns.length) {
    if (artifacts.length) {
      problems.push(
        `${gate.id}: declara artefactos que el catálogo no permite (${artifacts
          .map((artifact) => artifact.path)
          .join(", ")})`,
      );
    }
    return problems;
  }
  if (!artifacts.length) {
    problems.push(
      `${gate.id}: artifacts=[] pero el gate declara ${patterns.join(", ")}`,
    );
    return problems;
  }
  const covered = new Set();
  for (const artifact of artifacts) {
    const relative = String(artifact?.path ?? "").replace(/\\/g, "/");
    const matched = patterns.filter((pattern) =>
      globMatches(pattern, relative),
    );
    if (!matched.length) {
      problems.push(`${gate.id}: ${relative} no está en el set canónico`);
    }
    for (const pattern of matched) covered.add(pattern);
  }
  for (const pattern of patterns) {
    if (!covered.has(pattern)) {
      problems.push(`${gate.id}: falta el artefacto canónico ${pattern}`);
    }
  }
  problems.push(
    ...artifactProblems(artifacts, {
      root,
      startSha,
      requireGitBlock: canonical.id === "p0-dinero",
    }).map((problem) => `${gate.id}: ${problem}`),
  );
  return problems;
}


export function validateEvidence(
  evidence,
  { headSha, treeDirty = null, allowFast = false, root = ROOT } = {},
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
    "schemaVersion === 2",
    Number(evidence.schemaVersion) === 2,
    `schemaVersion=${evidence.schemaVersion}`,
  );
  check(
    "mode full/static (fast solo con --allow-fast)",
    KNOWN_MODES.includes(mode) &&
      evidence.partial !== true &&
      (mode !== "fast" || allowFast),
    `mode=${mode} partial=${evidence.partial} allowFast=${allowFast}`,
  );
  if (mode === "fast" && allowFast) {
    warnings.push("Evidencia fast aceptada con --allow-fast: no es handoff de demo.");
  }
  check("ok global es true", evidence.ok === true, `ok=${evidence.ok}`);
  check(
    "complete es true",
    evidence.complete === true,
    `complete=${evidence.complete}`,
  );
  check(
    "partial es false",
    evidence.partial === false,
    `partial=${evidence.partial}`,
  );
  check(
    "error es null",
    evidence.error == null,
    `error=${evidence.error ?? "null"}`,
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
  if (treeDirty !== null) {
    check(
      "árbol actual limpio (ignorando generados)",
      treeDirty === false,
      `dirty=${treeDirty}`,
    );
  }
  const handoffMode = mode === "full" || mode === "static";
  check(
    "serverBuildSha === gitAtStart.sha (full/static)",
    !handoffMode ||
      (evidence.serverBuildSha === evidence.gitAtStart?.sha &&
        evidence.gitAtStart?.sha !== "unknown"),
    `${evidence.serverBuildSha ?? "?"} vs ${evidence.gitAtStart?.sha ?? "?"}`,
  );
  check(
    "buildBound es true (full/static)",
    !handoffMode || evidence.buildBound === true,
    `buildBound=${evidence.buildBound}`,
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

  const gateProblems = [];
  for (const gate of gates) {
    const canonical = GATES_BY_ID.get(gate.id);
    if (!canonical) {
      gateProblems.push(`${gate.id}: gate desconocido`);
      continue;
    }
    if (gate.ok !== true) gateProblems.push(`${gate.id}: ok=${gate.ok}`);
    if (gate.exitCode !== 0) {
      gateProblems.push(`${gate.id}: exitCode=${gate.exitCode}`);
    }
    if (gate.reason !== "ok") {
      gateProblems.push(`${gate.id}: reason=${gate.reason}`);
    }
    if (gate.expectedMatched !== true) {
      gateProblems.push(`${gate.id}: expectedMatched=${gate.expectedMatched}`);
    }
    if (!Array.isArray(gate.artifacts)) {
      gateProblems.push(`${gate.id}: sin artifacts[]`);
    }
    if (
      handoffMode &&
      (canonical.mode === "runtime"
        ? gate.buildSha == null || gate.buildSha !== evidence.gitAtStart?.sha
        : gate.buildSha != null &&
          gate.buildSha !== evidence.gitAtStart?.sha)
    ) {
      gateProblems.push(
        `${gate.id}: buildSha ${gate.buildSha ?? "?"} != ${evidence.gitAtStart?.sha ?? "?"}`,
      );
    }
    if (
      (canonical.usesMainServer || canonical.baseUrl) &&
      typeof gate.baseUrl !== "string"
    ) {
      gateProblems.push(`${gate.id}: sin baseUrl registrado`);
    }
    if (JSON.stringify(gate.expected) !== JSON.stringify(canonical.expected)) {
      gateProblems.push(
        `${gate.id}: expected declarado ${JSON.stringify(gate.expected)} != canonico ${JSON.stringify(canonical.expected)}`,
      );
    }
    if (expectedMatches(canonical.expected, gate.outputTail) !== true) {
      gateProblems.push(
        `${gate.id}: expected no aparece en outputTail (no se confía en expectedMatched)`,
      );
    }
    if (gate.expectedBasis !== canonical.expectedBasis) {
      gateProblems.push(
        `${gate.id}: expectedBasis ${gate.expectedBasis} != ${canonical.expectedBasis}`,
      );
    }
    const problems = canonicalArtifactProblems(gate, canonical, {
      root,
      startSha: evidence.gitAtStart?.sha,
    });
    for (const problem of problems) {
      gateProblems.push(problem);
    }
  }
  check(
    "cada gate ok/exitCode/reason/expected/artefactos válidos",
    gateProblems.length === 0,
    gateProblems.slice(0, 8).join(" | "),
  );

  const recomputedGatesOk =
    gates.length > 0 &&
    gateProblems.length === 0 &&
    new Set(gateIds).size === gateIds.length;
  check(
    "gatesOk coincide con los gates y no está manipulado",
    evidence.gatesOk === recomputedGatesOk && recomputedGatesOk === true,
    `declarado=${evidence.gatesOk} recalculado=${recomputedGatesOk}`,
  );

  const recomputedBuildMatches =
    Boolean(evidence.serverBuildSha) &&
    evidence.serverBuildSha === evidence.gitAtStart?.sha &&
    evidence.gitAtStart?.sha !== "unknown";
  check(
    "buildMatches coincide con serverBuildSha y no está manipulado",
    evidence.buildMatches === recomputedBuildMatches,
    `declarado=${evidence.buildMatches} recalculado=${recomputedBuildMatches}`,
  );

  check(
    "criticalGates coincide con el set canónico y no está manipulado",
    sameSet(evidence.criticalGates, criticalIds),
    `declarado=${(evidence.criticalGates ?? []).join(",")} esperado=${criticalIds.join(",")}`,
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
  const ended = timestamp(evidence.endedAt);
  check(
    "timestamps coherentes (startedAt/endedAt)",
    started !== null &&
      ended !== null &&
      ended >= started &&
      Number(evidence.durationMs) >= 0,
    `${evidence.startedAt} -> ${evidence.endedAt} (${evidence.durationMs} ms)`,
  );

  check(
    "baseUrl presente",
    typeof evidence.baseUrl === "string" && evidence.baseUrl.length > 0,
    evidence.baseUrl,
  );
  check(
    "node y os presentes",
    typeof evidence.node === "string" &&
      evidence.node.length > 0 &&
      typeof evidence.os === "string" &&
      evidence.os.length > 0,
    `node=${evidence.node} os=${evidence.os}`,
  );

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

function main() {
  const json = process.argv.includes("--json");
  const allowFast = process.argv.includes("--allow-fast");
  const staticMode = process.argv.includes("--static");
  for (const arg of process.argv.slice(2)) {
    if (!KNOWN_FLAGS.has(arg)) {
      console.error(`Flag desconocido: ${arg}`);
      return 2;
    }
  }

  const file = staticMode
    ? LATEST_STATIC
    : fs.existsSync(LATEST)
      ? LATEST
      : LATEST_STATIC;
  if (!fs.existsSync(file)) {
    console.error(
      `EVIDENCIA INVÁLIDA: falta ${path.relative(ROOT, file)}. Full escribe latest.json; static escribe latest-static.json (usa --static).`,
    );
    return 1;
  }
  if (!staticMode && file === LATEST_STATIC) {
    console.log("NOTA  no hay latest.json; valido latest-static.json (static).");
  }

  const latest = readJson(file);
  if (latest.invalid) {
    console.error(
      `EVIDENCIA INVÁLIDA: ${path.relative(ROOT, file)} no parsea (${latest.error})`,
    );
    return 1;
  }

  const head = getGit();
  const result = validateEvidence(latest, {
    headSha: head.sha,
    treeDirty: head.dirty,
    allowFast,
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
            serverBuildSha: latest.serverBuildSha,
            startedAt: latest.startedAt,
            endedAt: latest.endedAt,
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
      `EVIDENCIA ${latest.mode} - ${String(latest.gitAtStart?.sha ?? "?").slice(0, 7)} - HEAD ${head.sha.slice(0, 7)} - build ${String(latest.serverBuildSha ?? "?").slice(0, 7)}\n`,
    );
    for (const item of result.checks) {
      console.log(
        `${item.ok ? "PASS" : "FAIL"}  ${item.name}${item.detail ? ` - ${item.detail}` : ""}`,
      );
    }
    for (const warning of result.warnings) {
      console.log(`WARN  ${warning}`);
    }
    console.log("");
    if (result.ok) {
      console.log(
        `EVIDENCIA OK: ${latest.mode} en ${latest.gitAtStart?.sha} - ${latest.gates?.length ?? 0} gates - buildSha ${latest.serverBuildSha} - árbol limpio.`,
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
