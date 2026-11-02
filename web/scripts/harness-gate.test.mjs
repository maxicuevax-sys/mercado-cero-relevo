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

function resultsFor(ids) {
  return ids.map((id) => gateResult(id));
}

function evaluationFor({
  mode = "static",
  expectedIds = MODE_GATES[mode],
  results = resultsFor(expectedIds),
  gitAtStart = { sha: SHA, branch: "test", dirty: false },
  gitAtEnd = { sha: SHA, branch: "test", dirty: false },
  withFilm = false,
} = {}) {
  return evaluateRun({
    mode,
    expectedIds,
    criticalIds: criticalGateIds({ mode, withFilm }, expectedIds),
    results,
    gitAtStart,
    gitAtEnd,
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

test("parseArgs: modos contradictorios y valores faltantes fallan", () => {
  assert.throws(() => parseArgs(["--fast", "--static"]), GateConfigError);
  assert.throws(() => parseArgs(["--only"]), GateConfigError);
  assert.throws(() => parseArgs(["--skip"]), GateConfigError);
});

test("catálogo: 16 gates, full 14, static 5, fast 3", () => {
  assert.equal(GATES.length, 16);
  assert.equal(MODE_GATES.fast.length, 3);
  assert.equal(MODE_GATES.static.length, 5);
  assert.equal(MODE_GATES.full.length, 14);
  assert.ok(MODE_GATES.full.includes("deps"));
  assert.ok(!MODE_GATES.full.includes("build"));
  assert.ok(!MODE_GATES.full.includes("film"));
});

test("selectedGates: full excluye build y film, incluye deps", () => {
  const selection = selectedGates(parseArgs(["--full"]));
  assert.equal(selection.mode, "full");
  assert.equal(selection.expectedIds.length, 14);
  assert.equal(selection.gates.length, 14);
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
  assert.equal(selection.expectedIds.length, 15);
  assert.ok(selection.expectedIds.includes("film"));
  assert.ok(selection.criticalIds.includes("film"));
});

test("selectedGates: --skip deja el gate fuera de la ejecución pero sigue esperado", () => {
  const selection = selectedGates(parseArgs(["--full", "--skip=tunnel"]));
  assert.equal(selection.expectedIds.length, 14);
  assert.equal(selection.gates.length, 13);
  assert.ok(selection.criticalIds.includes("tunnel"));
  assert.ok(!selection.gates.some((gate) => gate.id === "tunnel"));
});

test("selectedGates: --only es partial y valida ids", () => {
  const selection = selectedGates(parseArgs(["--only=truth,webhook"]));
  assert.equal(selection.mode, "partial");
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

test("expectedMatches: marcador, mayúsculas, acentos y ANSI", () => {
  assert.equal(expectedMatches("27/27", "PASS 27/27 pruebas"), true);
  assert.equal(expectedMatches("PASÓ", "paso: sin violaciones"), true);
  assert.equal(expectedMatches("Compiled successfully", "\u001b[32m✓ Compiled successfully\u001b[0m"), true);
  assert.equal(expectedMatches("0 FAIL", "15 PASS · 1 FAIL"), false);
  assert.equal(expectedMatches(["27/27", "webhook"], "27/27 webhook"), true);
  assert.equal(expectedMatches(["27/27", "firma"], "27/27"), false);
  assert.equal(expectedMatches(null, "cualquier cosa"), null);
});

test("evaluateRun: corrida static completa y limpia es ok", () => {
  const evaluation = evaluationFor();
  assert.equal(evaluation.ok, true);
  assert.equal(evaluation.complete, true);
  assert.equal(evaluation.evidenceValid, true);
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

test("evaluateRun: gate en rojo o expected no validado impide ok", () => {
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
