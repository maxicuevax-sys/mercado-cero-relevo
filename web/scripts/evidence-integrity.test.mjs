import test, { after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GATES, GATES_BY_ID, MODE_GATES } from "./harness-gate.mjs";
import { artifactProblems, validateEvidence } from "./verify-evidence.mjs";

const SHA = "c".repeat(40);
const ROOT = path.resolve(import.meta.dirname, "..", "..");

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function writeFile(root, relative, content) {
  const absolute = path.join(root, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content);
  return {
    path: relative,
    exists: true,
    sha256: sha256(absolute),
    size: fs.statSync(absolute).size,
  };
}

function artifactPathForPattern(pattern) {
  return pattern.includes("*") ? pattern.replace(/\*/g, "1") : pattern;
}

function defaultJson(relative, startSha) {
  if (relative === "harness/evidence/p0-dinero-e2e.json") {
    return JSON.stringify({
      git: { sha: startSha, branch: "test", dirty: false },
    });
  }
  return "{}";
}

function makeArtifactRoot({ startSha = SHA, overrides = {} } = {}) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "mercado-cero-evidence-test-"),
  );
  for (const gate of GATES) {
    for (const pattern of gate.artifacts ?? []) {
      const relative = artifactPathForPattern(pattern);
      const content =
        overrides[relative] ??
        (relative.endsWith(".json")
          ? defaultJson(relative, startSha)
          : `${relative}\n`);
      writeFile(root, relative, content);
    }
  }
  return root;
}

const ARTIFACT_ROOT = makeArtifactRoot();
after(() => fs.rmSync(ARTIFACT_ROOT, { recursive: true, force: true }));

function artifactFor(root, relative) {
  const absolute = path.join(root, relative);
  return {
    path: relative,
    exists: true,
    sha256: sha256(absolute),
    size: fs.statSync(absolute).size,
  };
}

function artifactsForGate(id, root = ARTIFACT_ROOT) {
  const gate = GATES_BY_ID.get(id);
  return (gate.artifacts ?? []).map((pattern) =>
    artifactFor(root, artifactPathForPattern(pattern)),
  );
}

function gateResult(id, overrides = {}, root = ARTIFACT_ROOT) {
  const gate = GATES_BY_ID.get(id);
  return {
    id,
    name: gate.name,
    command: `${gate.command} ${gate.args.join(" ")}`,
    baseUrl: gate.usesMainServer
      ? "http://localhost:3000"
      : (gate.baseUrl ?? null),
    buildSha: gate.mode === "runtime" ? SHA : null,
    ok: true,
    exitCode: 0,
    durationMs: 1,
    expected: gate.expected,
    expectedBasis: gate.expectedBasis,
    expectedMatched: true,
    reason: "ok",
    artifacts: artifactsForGate(id, root),
    outputTail: Array.isArray(gate.expected)
      ? gate.expected.join(" ")
      : gate.expected,
    ...overrides,
  };
}

function makeEvidence(
  mode,
  { withFilm = false, overrides = {}, root = ARTIFACT_ROOT } = {},
) {
  const expectedIds = withFilm
    ? [...MODE_GATES.full, "film"]
    : [...MODE_GATES[mode]];
  const gates = expectedIds.map((id) => gateResult(id, {}, root));
  const resets = expectedIds
    .filter((id) => id === "truth" || id === "preflight")
    .map((id) => ({ before: id, ok: true }));
  const notRun = GATES.map((gate) => gate.id).filter(
    (id) => !expectedIds.includes(id),
  );
  return {
    schemaVersion: 2,
    mode,
    requestedMode: mode,
    partial: false,
    startedAt: "2026-11-02T00:00:00.000Z",
    endedAt: "2026-11-02T00:00:01.000Z",
    durationMs: 1000,
    baseUrl: "http://localhost:3000",
    serverBuildSha: mode === "fast" ? null : SHA,
    buildMatches: mode !== "fast",
    node: "v25.7.0",
    os: "win32-x64",
    python: "Python 3.14.3",
    error: null,
    gitAtStart: { sha: SHA, branch: "test", dirty: false },
    gitAtEnd: { sha: SHA, branch: "test", dirty: false },
    expectedGates: expectedIds,
    criticalGates: expectedIds,
    skipped: [],
    notRun,
    notRunReasons: Object.fromEntries(
      notRun.map((id) => [id, "fuera-del-modo"]),
    ),
    resets,
    gates,
    complete: true,
    gatesOk: true,
    evidenceValid: true,
    buildBound: true,
    cleanStart: true,
    cleanEnd: true,
    shaStable: true,
    missing: [],
    criticalMissing: [],
    reasons: [],
    ok: true,
    ...overrides,
  };
}

function validate(evidence, options = {}) {
  return validateEvidence(evidence, {
    headSha: SHA,
    treeDirty: false,
    allowFast: false,
    root: ARTIFACT_ROOT,
    ...options,
  });
}

function failedChecks(result) {
  return result.checks.filter((check) => !check.ok);
}

test("evidencia static v2 válida (5 gates)", () => {
  const result = validate(makeEvidence("static"));
  assert.equal(result.ok, true, JSON.stringify(failedChecks(result)));
});

test("evidencia full v2 válida (23 gates, build fuera)", () => {
  const result = validate(makeEvidence("full"));
  assert.equal(result.ok, true, JSON.stringify(failedChecks(result)));
  assert.equal(MODE_GATES.full.length, 23);
});

test("evidencia full --with-film v2 válida (24 gates)", () => {
  const result = validate(makeEvidence("full", { withFilm: true }));
  assert.equal(result.ok, true, JSON.stringify(failedChecks(result)));
});

test("evidencia fast se rechaza para handoff salvo --allow-fast", () => {
  const evidence = makeEvidence("fast");
  const rejected = validate(evidence);
  assert.equal(rejected.ok, false);
  assert.ok(
    rejected.checks.some(
      (check) =>
        check.name === "mode full/static (fast solo con --allow-fast)" &&
        !check.ok,
    ),
  );

  const allowed = validate(evidence, { allowFast: true });
  assert.equal(allowed.ok, true, JSON.stringify(failedChecks(allowed)));
  assert.ok(allowed.warnings.some((warning) => warning.includes("fast")));
});

test("evidencia de un SHA distinto a HEAD falla", () => {
  const result = validate(makeEvidence("static"), {
    headSha: "d".repeat(40),
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.checks.some(
      (check) => check.name === "gitAtStart.sha === HEAD" && !check.ok,
    ),
  );
});

test("evidencia con gitAtStart.dirty=true falla", () => {
  const evidence = makeEvidence("static");
  evidence.gitAtStart.dirty = true;
  assert.equal(validate(evidence).ok, false);
});

test("evidencia con árbol actual sucio falla", () => {
  const result = validate(makeEvidence("static"), { treeDirty: true });
  assert.equal(result.ok, false);
  assert.ok(
    result.checks.some(
      (check) =>
        check.name === "árbol actual limpio (ignorando generados)" && !check.ok,
    ),
  );
});

test("evidencia con SHA cambiado al final falla", () => {
  const evidence = makeEvidence("static");
  evidence.gitAtEnd.sha = "e".repeat(40);
  assert.equal(validate(evidence).ok, false);
});

test("evidencia con gitAtEnd.dirty=true falla", () => {
  const evidence = makeEvidence("static");
  evidence.gitAtEnd.dirty = true;
  assert.equal(validate(evidence).ok, false);
});

test("evidencia partial falla aunque los gates pasen", () => {
  const evidence = makeEvidence("static", {
    overrides: { mode: "partial", requestedMode: "full", partial: true },
  });
  const result = validate(evidence);
  assert.equal(result.ok, false);
  assert.ok(
    result.checks.some(
      (check) =>
        check.name === "mode full/static (fast solo con --allow-fast)" &&
        !check.ok,
    ),
  );
});

test("evidencia con ok:false, complete:false o buildSha distinto falla", () => {
  assert.equal(
    validate(makeEvidence("static", { overrides: { ok: false } })).ok,
    false,
  );
  assert.equal(
    validate(makeEvidence("static", { overrides: { complete: false } })).ok,
    false,
  );
  assert.equal(
    validate(
      makeEvidence("static", {
        overrides: { serverBuildSha: "f".repeat(40) },
      }),
    ).ok,
    false,
  );

  const gateBuild = makeEvidence("full");
  gateBuild.gates.find((gate) => gate.id === "webhook").buildSha =
    "f".repeat(40);
  assert.equal(validate(gateBuild).ok, false);

  const nullBuild = makeEvidence("full");
  nullBuild.gates.find((gate) => gate.id === "p0-dinero").buildSha = null;
  assert.equal(validate(nullBuild).ok, false);
});

test("evidencia a la que le falta un gate del modo falla", () => {
  const evidence = makeEvidence("static");
  evidence.gates = evidence.gates.filter((gate) => gate.id !== "deps");
  assert.equal(validate(evidence).ok, false);
});

test("evidencia con expected manipulado, ausente o expectedMatched=false falla", () => {
  const manipulated = makeEvidence("static");
  manipulated.gates[0] = gateResult("guard", { expected: "lo que sea" });
  assert.equal(validate(manipulated).ok, false);

  const mismatch = makeEvidence("static");
  mismatch.gates[0] = gateResult("guard", { expectedMatched: false });
  assert.equal(validate(mismatch).ok, false);

  const oldShape = makeEvidence("static");
  delete oldShape.gates[0].expectedMatched;
  assert.equal(validate(oldShape).ok, false);
});

test("expectedMatched no se confía: se recalcula contra outputTail real", () => {
  const evidence = makeEvidence("static");
  const guard = evidence.gates.find((gate) => gate.id === "guard");
  guard.expectedMatched = true;
  guard.outputTail = "salida sin el marcador";
  const result = validate(evidence);
  assert.equal(result.ok, false);
  assert.ok(
    result.checks.some(
      (check) =>
        check.name === "cada gate ok/exitCode/reason/expected/artefactos válidos" &&
        check.detail.includes("outputTail"),
    ),
  );
});

test("gatesOk, buildMatches y criticalGates manipulados fallan", () => {
  const gatesOk = makeEvidence("static", { overrides: { gatesOk: false } });
  assert.equal(validate(gatesOk).ok, false);

  const buildMatches = makeEvidence("static", {
    overrides: { buildMatches: false },
  });
  assert.equal(validate(buildMatches).ok, false);

  const critical = makeEvidence("full");
  critical.criticalGates = critical.criticalGates.filter(
    (id) => id !== "tunnel",
  );
  assert.equal(validate(critical).ok, false);
});

test("evidencia con exitCode o reason inválido falla", () => {
  const exitCode = makeEvidence("static");
  exitCode.gates[0] = gateResult("guard", { exitCode: 1 });
  assert.equal(validate(exitCode).ok, false);

  const reason = makeEvidence("static");
  reason.gates[0] = gateResult("guard", { reason: "exit-code" });
  assert.equal(validate(reason).ok, false);
});

test("evidencia con skip crítico o gate crítico en notRun falla", () => {
  const skipped = makeEvidence("full");
  skipped.skipped = ["tunnel"];
  assert.equal(validate(skipped).ok, false);

  const notRun = makeEvidence("full");
  notRun.notRun = [...notRun.notRun, "tunnel"];
  assert.equal(validate(notRun).ok, false);
});

test("evidencia full antigua sin deps falla", () => {
  const evidence = makeEvidence("full");
  const oldIds = evidence.expectedGates.filter((id) => id !== "deps");
  evidence.expectedGates = oldIds;
  evidence.gates = evidence.gates.filter((gate) => gate.id !== "deps");
  assert.equal(validate(evidence).ok, false);
});

test("evidencia full --with-film sin el gate film falla", () => {
  const evidence = makeEvidence("full", { withFilm: true });
  evidence.gates = evidence.gates.filter((gate) => gate.id !== "film");
  assert.equal(validate(evidence).ok, false);
});

test("evidencia full sin reset de truth falla", () => {
  const evidence = makeEvidence("full");
  evidence.resets = evidence.resets.filter((reset) => reset.before !== "truth");
  assert.equal(validate(evidence).ok, false);
});

test("schemaVersion distinto de 2 o sin endedAt falla", () => {
  const oldSchema = makeEvidence("static");
  oldSchema.schemaVersion = 1;
  assert.equal(validate(oldSchema).ok, false);

  const noEnd = makeEvidence("static");
  delete noEnd.endedAt;
  assert.equal(validate(noEnd).ok, false);
});

test("artefacto canónico ausente en un gate que lo declara falla", () => {
  const staticBuild = makeEvidence("static");
  staticBuild.gates.find((gate) => gate.id === "build").artifacts = [];
  assert.equal(validate(staticBuild).ok, false);

  const fullP0 = makeEvidence("full");
  fullP0.gates.find((gate) => gate.id === "p0-dinero").artifacts = [];
  const result = validate(fullP0);
  assert.equal(result.ok, false);
  assert.ok(
    result.checks.some(
      (check) =>
        check.name === "cada gate ok/exitCode/reason/expected/artefactos válidos" &&
        check.detail.includes("artifacts=[]"),
    ),
  );
});

test("artefacto existente con hash/tamaño correctos pasa", () => {
  const result = validate(makeEvidence("static"));
  assert.equal(result.ok, true, JSON.stringify(failedChecks(result)));
});

test("artefacto faltante, hash distinto o path fuera del set canónico falla", () => {
  const missing = makeEvidence("static");
  missing.gates.find((gate) => gate.id === "build").artifacts = [
    {
      path: "web/.next/BUILD_SHA",
      exists: false,
      sha256: null,
      size: null,
    },
  ];
  assert.equal(validate(missing).ok, false);

  const badHash = makeEvidence("static");
  const buildArtifact = badHash.gates.find(
    (gate) => gate.id === "build",
  ).artifacts[0];
  buildArtifact.sha256 = "0".repeat(64);
  assert.equal(validate(badHash).ok, false);

  const extra = makeEvidence("static");
  extra.gates
    .find((gate) => gate.id === "build")
    .artifacts.push(artifactFor(ARTIFACT_ROOT, "harness/evidence/motion-check.json"));
  assert.equal(validate(extra).ok, false);
});

test("artefacto JSON con otro commit o dirty:true falla (code)", () => {
  const root = makeArtifactRoot({
    overrides: {
      "web/.next/BUILD_SHA": JSON.stringify({
        code: { commit: "b".repeat(40), dirty: false },
      }),
    },
  });
  try {
    assert.equal(validate(makeEvidence("static", { root })).ok, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  const dirtyRoot = makeArtifactRoot({
    overrides: {
      "web/.next/BUILD_SHA": JSON.stringify({
        code: { commit: SHA, dirty: true },
      }),
    },
  });
  try {
    assert.equal(validate(makeEvidence("static", { root: dirtyRoot })).ok, false);
  } finally {
    fs.rmSync(dirtyRoot, { recursive: true, force: true });
  }
});

test("p0-dinero exige bloque git con sha de HEAD y dirty:false", () => {
  const staleRoot = makeArtifactRoot({
    overrides: {
      "harness/evidence/p0-dinero-e2e.json": JSON.stringify({
        git: { sha: "b".repeat(40), branch: "test", dirty: false },
      }),
    },
  });
  try {
    const artifact = artifactFor(
      staleRoot,
      "harness/evidence/p0-dinero-e2e.json",
    );
    const problems = artifactProblems([artifact], {
      root: staleRoot,
      startSha: SHA,
      requireGitBlock: true,
    });
    assert.ok(problems.some((problem) => problem.includes("git.sha")));
    assert.equal(validate(makeEvidence("full", { root: staleRoot })).ok, false);
  } finally {
    fs.rmSync(staleRoot, { recursive: true, force: true });
  }

  const dirtyRoot = makeArtifactRoot({
    overrides: {
      "harness/evidence/p0-dinero-e2e.json": JSON.stringify({
        git: { sha: SHA, branch: "test", dirty: true },
      }),
    },
  });
  try {
    const artifact = artifactFor(
      dirtyRoot,
      "harness/evidence/p0-dinero-e2e.json",
    );
    const problems = artifactProblems([artifact], {
      root: dirtyRoot,
      startSha: SHA,
      requireGitBlock: true,
    });
    assert.ok(problems.some((problem) => problem.includes("git.dirty")));
    assert.equal(validate(makeEvidence("full", { root: dirtyRoot })).ok, false);
  } finally {
    fs.rmSync(dirtyRoot, { recursive: true, force: true });
  }

  const noGitRoot = makeArtifactRoot({
    overrides: {
      "harness/evidence/p0-dinero-e2e.json": JSON.stringify({
        summary: { pass: 45, fail: 0, known: 3 },
      }),
    },
  });
  try {
    const artifact = artifactFor(
      noGitRoot,
      "harness/evidence/p0-dinero-e2e.json",
    );
    const problems = artifactProblems([artifact], {
      root: noGitRoot,
      startSha: SHA,
      requireGitBlock: true,
    });
    assert.ok(problems.some((problem) => problem.includes("bloque git")));
    assert.equal(validate(makeEvidence("full", { root: noGitRoot })).ok, false);
  } finally {
    fs.rmSync(noGitRoot, { recursive: true, force: true });
  }
});

test("p0-dinero: su artefacto no está trackeado y escribir p0-* no ensucia git", () => {
  const tracked = spawnSync(
    "git",
    ["ls-files", "--error-unmatch", "harness/evidence/p0-dinero-e2e.json"],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.notEqual(tracked.status, 0, "p0-dinero-e2e.json no debe estar en git");

  const ignored = spawnSync(
    "git",
    ["check-ignore", "-q", "harness/evidence/p0-dinero-e2e.json"],
    { cwd: ROOT },
  );
  assert.equal(ignored.status, 0, "p0-dinero-e2e.json debe estar ignorado");

  const probe = `harness/evidence/p0-untracked-test-${process.pid}.json`;
  fs.writeFileSync(path.join(ROOT, probe), "{}\n");
  try {
    const status = spawnSync(
      "git",
      ["status", "--porcelain", "--untracked-files=all"],
      { cwd: ROOT, encoding: "utf8" },
    );
    assert.equal(status.status, 0);
    assert.equal(
      status.stdout.includes(probe),
      false,
      `git status no debe listar ${probe}`,
    );
  } finally {
    fs.rmSync(path.join(ROOT, probe), { force: true });
  }
});

