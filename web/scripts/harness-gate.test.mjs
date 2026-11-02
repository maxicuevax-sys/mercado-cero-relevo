import test from "node:test";
import assert from "node:assert/strict";

import {
  GATES,
  GATES_BY_ID,
  MODE_GATES,
  GateConfigError,
  criticalGateIds,
  evaluateRun,
  expectedMatches,
  parseArgs,
  selectedGates,
} from "./harness-gate.mjs";

const SHA = "a".repeat(40);

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

function resultsFor(ids) {
  return ids.map((id) => gateResult(id));
}

function evaluationFor({
  mode = "static",
  expectedIds = MODE_GATES[mode],
  results = resultsFor(expectedIds),
  gitAtStart = { sha: SHA, branch: "test", dirty: false },
  gitAtEnd = { sha: SHA, branch: "test", dirty: false },
  serverBuildSha = SHA,
  partial = mode === "partial",
  withFilm = false,
} = {}) {
  return evaluateRun({
    mode,
    expectedIds,
    criticalIds: criticalGateIds({ mode, withFilm }, expectedIds),
    results,
    gitAtStart,
    gitAtEnd,
    serverBuildSha,
    partial,
  });
}

test("parseArgs: fast, static, full y --with-film", () => {
  assert.equal(parseArgs(["--fast"]).mode, "fast");
  assert.equal(parseArgs(["--static"]).mode, "static");
  assert.equal(parseArgs(["--full"]).mode, "full");
  const fullFilm = parseArgs(["--full", "--with-film"]);
  assert.equal(fullFilm.mode, "full");
  assert.equal(fullFilm.withFilm, true);
});

test("parseArgs: --only produce mode partial, nunca full", () => {
  const options = parseArgs(["--only=truth,webhook"]);
  assert.equal(options.mode, "partial");
  assert.equal(options.requestedMode, null);
  assert.deepEqual(options.only, ["truth", "webhook"]);

  const forced = parseArgs(["--full", "--only=truth"]);
  assert.equal(forced.mode, "partial");
  assert.equal(forced.requestedMode, "full");
});

test("parseArgs: modos contradictorios, valores faltantes y flags desconocidos fallan", () => {
  assert.throws(() => parseArgs(["--fast", "--static"]), GateConfigError);
  assert.throws(() => parseArgs(["--only"]), GateConfigError);
  assert.throws(() => parseArgs(["--skip"]), GateConfigError);
  assert.throws(() => parseArgs(["--nope"]), GateConfigError);
  assert.throws(() => parseArgs(["--full", "--allow-fast"]), GateConfigError);
});

test("catálogo: 25 gates, full 23, static 5, fast 3", () => {
  assert.equal(GATES.length, 25);
  assert.equal(MODE_GATES.fast.length, 3);
  assert.equal(MODE_GATES.static.length, 5);
  assert.equal(MODE_GATES.full.length, 23);
  assert.ok(MODE_GATES.full.includes("deps"));
  assert.ok(MODE_GATES.full.includes("security"));
  assert.ok(MODE_GATES.full.includes("data"));
  assert.ok(MODE_GATES.full.includes("perf"));
  assert.ok(MODE_GATES.full.includes("mobile-320"));
  assert.ok(MODE_GATES.full.includes("p0-venta"));
  assert.ok(MODE_GATES.full.includes("p0-dinero"));
  assert.ok(!MODE_GATES.full.includes("build"));
  assert.ok(!MODE_GATES.full.includes("film"));
});

test("selectedGates: full excluye build y film, incluye deps y p0", () => {
  const selection = selectedGates(parseArgs(["--full"]));
  assert.equal(selection.mode, "full");
  assert.equal(selection.partial, false);
  assert.equal(selection.expectedIds.length, 23);
  assert.equal(selection.gates.length, 23);
  assert.ok(selection.expectedIds.includes("deps"));
  assert.ok(!selection.expectedIds.includes("build"));
  assert.ok(!selection.expectedIds.includes("film"));
  assert.deepEqual(
    selection.gates.map((gate) => gate.id),
    selection.expectedIds,
  );
});

test("selectedGates: --with-film añade film y lo vuelve crítico", () => {
  const selection = selectedGates(parseArgs(["--full", "--with-film"]));
  assert.equal(selection.expectedIds.length, 24);
  assert.ok(selection.expectedIds.includes("film"));
  assert.ok(selection.criticalIds.includes("film"));
});

test("selectedGates: --skip deja el gate esperado pero marca partial", () => {
  const selection = selectedGates(parseArgs(["--full", "--skip=tunnel"]));
  assert.equal(selection.mode, "full");
  assert.equal(selection.partial, true);
  assert.equal(selection.expectedIds.length, 23);
  assert.equal(selection.gates.length, 22);
  assert.ok(selection.criticalIds.includes("tunnel"));
  assert.ok(!selection.gates.some((gate) => gate.id === "tunnel"));
});

test("selectedGates: --only es partial y valida ids", () => {
  const selection = selectedGates(parseArgs(["--only=truth,webhook"]));
  assert.equal(selection.mode, "partial");
  assert.equal(selection.partial, true);
  assert.deepEqual(selection.expectedIds, ["truth", "webhook"]);
  assert.throws(
    () => selectedGates(parseArgs(["--only=no-existe"])),
    GateConfigError,
  );
  assert.throws(
    () => selectedGates(parseArgs(["--full", "--skip=no-existe"])),
    GateConfigError,
  );
});

test("expectedMatches: límites de palabra, no substrings", () => {
  assert.equal(expectedMatches("0 FAIL", "19 PASS · 0 FAIL"), true);
  assert.equal(expectedMatches("0 FAIL", "10 FAIL"), false);
  assert.equal(expectedMatches("19 PASS", "119 PASS · 0 FAIL"), false);
  assert.equal(expectedMatches("25/25", "125/125 checks"), false);
  assert.equal(expectedMatches("25/25", "25/25 checks"), true);
  assert.equal(expectedMatches("4 viewports", "14 viewports"), false);
  assert.equal(expectedMatches(["34/34", "WEBHOOK OK"], "34/34 WEBHOOK OK"), true);
  assert.equal(expectedMatches(["34/34", "WEBHOOK OK"], "34/34"), false);
  assert.equal(expectedMatches("PASÓ", "paso: sin violaciones"), true);
  assert.equal(
    expectedMatches("Compiled successfully", "\u001b[32m✓ Compiled successfully\u001b[0m"),
    true,
  );
  assert.equal(expectedMatches(null, "cualquier cosa"), null);
});

test("evaluateRun: corrida static completa y limpia es ok", () => {
  const evaluation = evaluationFor();
  assert.equal(evaluation.ok, true);
  assert.equal(evaluation.complete, true);
  assert.equal(evaluation.evidenceValid, true);
  assert.equal(evaluation.buildBound, true);
  assert.deepEqual(evaluation.reasons, []);
});

test("evaluateRun: full sin film es ok; film no está esperado", () => {
  const evaluation = evaluationFor({ mode: "full" });
  assert.equal(evaluation.ok, true);
  assert.equal(evaluation.complete, true);
});

test("evaluateRun: full --with-film sin film falla", () => {
  const expectedIds = [...MODE_GATES.full, "film"];
  const evaluation = evaluationFor({
    mode: "full",
    expectedIds,
    results: resultsFor(MODE_GATES.full),
    withFilm: true,
  });
  assert.equal(evaluation.ok, false);
  assert.ok(evaluation.criticalMissing.includes("film"));
  assert.ok(evaluation.reasons.some((reason) => reason.includes("film")));
});

test("evaluateRun: --only partial nunca es ok", () => {
  const evaluation = evaluationFor({
    mode: "partial",
    expectedIds: ["truth", "webhook"],
    results: resultsFor(["truth", "webhook"]),
  });
  assert.equal(evaluation.ok, false);
  assert.equal(evaluation.partial, true);
  assert.ok(evaluation.reasons.some((reason) => reason.includes("partial")));
});

test("evaluateRun: --skip en full marca partial y nunca es ok", () => {
  const selection = selectedGates(parseArgs(["--full", "--skip=tunnel"]));
  const evaluation = evaluationFor({
    mode: selection.mode,
    expectedIds: selection.expectedIds,
    results: resultsFor(
      selection.expectedIds.filter((id) => id !== "tunnel"),
    ),
    partial: selection.partial,
  });
  assert.equal(evaluation.ok, false);
  assert.equal(evaluation.partial, true);
  assert.ok(evaluation.criticalMissing.includes("tunnel"));
  assert.ok(evaluation.reasons.some((reason) => reason.includes("partial")));
});

test("evaluateRun: árbol sucio al inicio impide ok", () => {
  const evaluation = evaluationFor({
    gitAtStart: { sha: SHA, branch: "test", dirty: true },
    gitAtEnd: { sha: SHA, branch: "test", dirty: true },
  });
  assert.equal(evaluation.ok, false);
  assert.equal(evaluation.cleanStart, false);
  assert.ok(evaluation.reasons.some((reason) => reason.includes("sucio")));
});

test("evaluateRun: SHA cambiado durante la corrida impide ok", () => {
  const evaluation = evaluationFor({
    gitAtEnd: { sha: "b".repeat(40), branch: "test", dirty: false },
  });
  assert.equal(evaluation.ok, false);
  assert.equal(evaluation.shaStable, false);
  assert.ok(evaluation.reasons.some((reason) => reason.includes("SHA")));
});

test("evaluateRun: faltar un gate del modo impide ok", () => {
  const results = resultsFor(MODE_GATES.static).filter(
    (result) => result.id !== "deps",
  );
  const evaluation = evaluationFor({ results });
  assert.equal(evaluation.ok, false);
  assert.deepEqual(evaluation.missing, ["deps"]);
  assert.deepEqual(evaluation.criticalMissing, ["deps"]);
});

test("evaluateRun: gate en rojo, exitCode o reason inválido impide ok", () => {
  const failed = resultsFor(MODE_GATES.static);
  failed[1] = gateResult("lint", { ok: false, exitCode: 1, reason: "exit-code" });
  const failedEvaluation = evaluationFor({ results: failed });
  assert.equal(failedEvaluation.ok, false);
  assert.ok(failedEvaluation.failed.includes("lint"));

  const mismatch = resultsFor(MODE_GATES.static);
  mismatch[0] = gateResult("guard", {
    ok: false,
    expectedMatched: false,
    reason: "expected-mismatch",
  });
  const mismatchEvaluation = evaluationFor({ results: mismatch });
  assert.equal(mismatchEvaluation.ok, false);
  assert.ok(mismatchEvaluation.expectedMismatches.includes("guard"));

  const badExit = resultsFor(MODE_GATES.static);
  badExit[2] = gateResult("types", { exitCode: 9, reason: "ok" });
  const badExitEvaluation = evaluationFor({ results: badExit });
  assert.equal(badExitEvaluation.ok, false);
  assert.ok(badExitEvaluation.badExit.includes("types"));
});

test("evaluateRun: artefacto declarado faltante impide ok", () => {
  const results = resultsFor(MODE_GATES.static);
  results[0] = gateResult("guard", {
    artifacts: [{ path: "demo/no-existe.json", exists: false, sha256: null, size: null }],
  });
  const evaluation = evaluationFor({ results });
  assert.equal(evaluation.ok, false);
  assert.ok(evaluation.badArtifacts.includes("guard"));
});

test("evaluateRun: gate inesperado o duplicado impide ok", () => {
  const unexpected = [...resultsFor(MODE_GATES.static), gateResult("truth")];
  const unexpectedEvaluation = evaluationFor({ results: unexpected });
  assert.equal(unexpectedEvaluation.ok, false);
  assert.deepEqual(unexpectedEvaluation.unexpected, ["truth"]);

  const duplicated = [...resultsFor(MODE_GATES.static), gateResult("guard")];
  const duplicatedEvaluation = evaluationFor({ results: duplicated });
  assert.equal(duplicatedEvaluation.ok, false);
  assert.ok(duplicatedEvaluation.duplicateResults.includes("guard"));
});

test("evaluateRun: buildSha distinto o ausente impide ok en full/static", () => {
  const mismatch = evaluationFor({ serverBuildSha: "b".repeat(40) });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.buildBound, false);
  assert.ok(mismatch.reasons.some((reason) => reason.includes("buildSha")));

  const missing = evaluationFor({ serverBuildSha: null });
  assert.equal(missing.ok, false);
  assert.equal(missing.buildBound, false);
});
