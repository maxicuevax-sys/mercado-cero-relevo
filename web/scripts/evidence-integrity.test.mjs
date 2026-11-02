import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { GATES, GATES_BY_ID, MODE_GATES } from "./harness-gate.mjs";
import { validateEvidence } from "./verify-evidence.mjs";

const SHA = "c".repeat(40);
const ROOT = path.resolve(import.meta.dirname, "..", "..");

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function gateResult(id, overrides = {}) {
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
    artifacts: [],
    outputTail: Array.isArray(gate.expected)
      ? gate.expected.join(" ")
      : gate.expected,
    ...overrides,
  };
}

function makeEvidence(mode, { withFilm = false, overrides = {} } = {}) {
  const expectedIds = withFilm
    ? [...MODE_GATES.full, "film"]
    : [...MODE_GATES[mode]];
  const gates = expectedIds.map((id) => gateResult(id));
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
    ...options,
  });
}

test("evidencia static v2 válida (5 gates)", () => {
  const result = validate(makeEvidence("static"));
  assert.equal(result.ok, true, JSON.stringify(result.checks.filter((c) => !c.ok)));
});

test("evidencia full v2 válida (23 gates, build fuera)", () => {
  const result = validate(makeEvidence("full"));
  assert.equal(result.ok, true, JSON.stringify(result.checks.filter((c) => !c.ok)));
  assert.equal(MODE_GATES.full.length, 23);
});

test("evidencia full --with-film v2 válida (24 gates)", () => {
  const result = validate(makeEvidence("full", { withFilm: true }));
  assert.equal(result.ok, true, JSON.stringify(result.checks.filter((c) => !c.ok)));
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
  assert.equal(allowed.ok, true, JSON.stringify(allowed.checks.filter((c) => !c.ok)));
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
  const result = validate(evidence);
  assert.equal(result.ok, false);
});

test("evidencia con árbol actual sucio falla", () => {
  const result = validate(makeEvidence("static"), { treeDirty: true });
  assert.equal(result.ok, false);
  assert.ok(
    result.checks.some(
      (check) => check.name === "árbol actual limpio (ignorando generados)" && !check.ok,
    ),
  );
});

test("evidencia con SHA cambiado al final falla", () => {
  const evidence = makeEvidence("static");
  evidence.gitAtEnd.sha = "e".repeat(40);
  const result = validate(evidence);
  assert.equal(result.ok, false);
});

test("evidencia con gitAtEnd.dirty=true falla", () => {
  const evidence = makeEvidence("static");
  evidence.gitAtEnd.dirty = true;
  const result = validate(evidence);
  assert.equal(result.ok, false);
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
  assert.equal(validate(makeEvidence("static", { overrides: { ok: false } })).ok, false);
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
  gateBuild.gates.find((gate) => gate.id === "webhook").buildSha = "f".repeat(40);
  assert.equal(validate(gateBuild).ok, false);
});

test("evidencia a la que le falta un gate del modo falla", () => {
  const evidence = makeEvidence("static");
  evidence.gates = evidence.gates.filter((gate) => gate.id !== "deps");
  const result = validate(evidence);
  assert.equal(result.ok, false);
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
  const result = validate(evidence);
  assert.equal(result.ok, false);
});

test("evidencia full --with-film sin el gate film falla", () => {
  const evidence = makeEvidence("full", { withFilm: true });
  evidence.gates = evidence.gates.filter((gate) => gate.id !== "film");
  const result = validate(evidence);
  assert.equal(result.ok, false);
});

test("evidencia full sin reset de truth falla", () => {
  const evidence = makeEvidence("full");
  evidence.resets = evidence.resets.filter((reset) => reset.before !== "truth");
  const result = validate(evidence);
  assert.equal(result.ok, false);
});

test("schemaVersion 1 o sin endedAt falla", () => {
  const oldSchema = makeEvidence("static");
  oldSchema.schemaVersion = 1;
  assert.equal(validate(oldSchema).ok, false);

  const noEnd = makeEvidence("static");
  delete noEnd.endedAt;
  assert.equal(validate(noEnd).ok, false);
});

test("artefacto existente con hash/tamaño correctos pasa", () => {
  const file = path.join(ROOT, "web", "package.json");
  const evidence = makeEvidence("static");
  evidence.gates.find((gate) => gate.id === "build").artifacts = [
    {
      path: "web/package.json",
      exists: true,
      sha256: sha256(file),
      size: fs.statSync(file).size,
    },
  ];
  const result = validate(evidence);
  assert.equal(result.ok, true, JSON.stringify(result.checks.filter((c) => !c.ok)));
});

test("artefacto faltante o con hash distinto falla", () => {
  const missing = makeEvidence("static");
  missing.gates.find((gate) => gate.id === "build").artifacts = [
    {
      path: `harness/evidence/no-existe-${process.pid}.json`,
      exists: false,
      sha256: null,
      size: null,
    },
  ];
  assert.equal(validate(missing).ok, false);

  const file = path.join(ROOT, "web", "package.json");
  const badHash = makeEvidence("static");
  badHash.gates.find((gate) => gate.id === "build").artifacts = [
    {
      path: "web/package.json",
      exists: true,
      sha256: "0".repeat(64),
      size: fs.statSync(file).size,
    },
  ];
  assert.equal(validate(badHash).ok, false);
});

test("artefacto JSON con otro commit o dirty:true falla", () => {
  const dir = path.join(ROOT, "harness", "evidence", "runs");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `artifact-test-${process.pid}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify({ code: { commit: "b".repeat(40), dirty: false } }),
  );
  try {
    const evidence = makeEvidence("static");
    evidence.gates.find((gate) => gate.id === "build").artifacts = [
      {
        path: path.relative(ROOT, file).replace(/\\/g, "/"),
        exists: true,
        sha256: sha256(file),
        size: fs.statSync(file).size,
      },
    ];
    assert.equal(validate(evidence).ok, false);
  } finally {
    fs.rmSync(file, { force: true });
  }
});
