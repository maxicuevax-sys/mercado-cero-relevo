import test from "node:test";
import assert from "node:assert/strict";

import { GATES, GATES_BY_ID, MODE_GATES } from "./harness-gate.mjs";
import { validateEvidence } from "./verify-evidence.mjs";

const SHA = "c".repeat(40);

function gateResult(id, overrides = {}) {
  const gate = GATES_BY_ID.get(id);
  return {
    id,
    name: gate.name,
    command: `${gate.command} ${gate.args.join(" ")}`,
    ok: true,
    exitCode: 0,
    durationMs: 1,
    expected: gate.expected,
    expectedBasis: gate.expectedBasis,
    expectedMatched: gate.expected == null ? null : true,
    reason: "ok",
    outputTail: gate.expected ?? "ok",
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
    finishedAt: "2026-11-02T00:00:01.000Z",
    durationMs: 1000,
    baseUrl: "http://localhost:3000",
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
  return validateEvidence(evidence, { headSha: SHA, artifacts: null, ...options });
}

test("evidencia static válida (5 gates)", () => {
  const result = validate(makeEvidence("static"));
  assert.equal(result.ok, true, JSON.stringify(result.checks.filter((c) => !c.ok)));
});

test("evidencia full válida (14 gates, build fuera)", () => {
  const result = validate(makeEvidence("full"));
  assert.equal(result.ok, true, JSON.stringify(result.checks.filter((c) => !c.ok)));
  assert.equal(MODE_GATES.full.length, 14);
});

test("evidencia full --with-film válida (15 gates)", () => {
  const result = validate(makeEvidence("full", { withFilm: true }));
  assert.equal(result.ok, true, JSON.stringify(result.checks.filter((c) => !c.ok)));
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
  assert.ok(
    result.checks.some(
      (check) => check.name === "gitAtStart.dirty === false" && !check.ok,
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
        check.name === "mode es full/static/fast (no partial)" && !check.ok,
    ),
  );
});

test("evidencia con ok:false falla", () => {
  const result = validate(makeEvidence("static", { overrides: { ok: false } }));
  assert.equal(result.ok, false);
});

test("evidencia a la que le falta un gate del modo falla", () => {
  const evidence = makeEvidence("static");
  evidence.gates = evidence.gates.filter((gate) => gate.id !== "deps");
  const result = validate(evidence);
  assert.equal(result.ok, false);
});

test("evidencia con expectedMatched=false falla", () => {
  const evidence = makeEvidence("static");
  evidence.gates[0] = gateResult("guard", { expectedMatched: false });
  const result = validate(evidence);
  assert.equal(result.ok, false);
});

test("evidencia con expected manipulado falla", () => {
  const evidence = makeEvidence("static");
  evidence.gates[0] = gateResult("guard", { expected: "lo que sea" });
  const result = validate(evidence);
  assert.equal(result.ok, false);
});

test("evidencia con skip crítico falla", () => {
  const evidence = makeEvidence("full");
  evidence.skipped = ["tunnel"];
  const result = validate(evidence);
  assert.equal(result.ok, false);
});

test("evidencia con gate crítico en notRun falla", () => {
  const evidence = makeEvidence("full");
  evidence.notRun = [...evidence.notRun, "tunnel"];
  const result = validate(evidence);
  assert.equal(result.ok, false);
});

test("evidencia full antigua de 13 gates (sin deps) falla", () => {
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

test("schemaVersion 1 falla", () => {
  const evidence = makeEvidence("static");
  evidence.schemaVersion = 1;
  const result = validate(evidence);
  assert.equal(result.ok, false);
});

test("artefactos motion/contrast con el mismo commit limpio pasan", () => {
  const artifacts = {
    motion: { code: { commit: SHA, dirty: false } },
    contrast: { code: { commit: SHA, dirty: false } },
    hig: null,
  };
  const result = validate(makeEvidence("full"), { artifacts });
  assert.equal(result.ok, true, JSON.stringify(result.checks.filter((c) => !c.ok)));
  assert.ok(result.warnings.some((warning) => warning.includes("HIG")));
});

test("artefacto motion con dirty:true falla", () => {
  const artifacts = {
    motion: { code: { commit: SHA, dirty: true } },
    contrast: { code: { commit: SHA, dirty: false } },
    hig: null,
  };
  const result = validate(makeEvidence("full"), { artifacts });
  assert.equal(result.ok, false);
});

test("artefacto motion ausente falla", () => {
  const artifacts = {
    motion: null,
    contrast: { code: { commit: SHA, dirty: false } },
    hig: null,
  };
  const result = validate(makeEvidence("full"), { artifacts });
  assert.equal(result.ok, false);
});
