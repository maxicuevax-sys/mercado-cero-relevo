import test from "node:test";
import assert from "node:assert/strict";

import { parseAuditReport } from "./check-deps.mjs";

function report(vulnerabilities, extra = {}) {
  return JSON.stringify({
    auditReportVersion: 2,
    vulnerabilities: extra.vulnerabilities ?? {},
    metadata: { vulnerabilities },
  });
}

test("parseAuditReport: 0 high/critical es ok", () => {
  const parsed = parseAuditReport(
    report({ info: 0, low: 2, moderate: 3, high: 0, critical: 0, total: 5 }),
  );
  assert.equal(parsed.ok, true);
  assert.equal(parsed.high, 0);
  assert.equal(parsed.critical, 0);
  assert.equal(parsed.moderate, 3);
  assert.equal(parsed.total, 5);
});

test("parseAuditReport: high bloquea y lista el paquete", () => {
  const parsed = parseAuditReport(
    report(
      { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 },
      {
        vulnerabilities: {
          "paquete-malo": { severity: "high", via: ["x"] },
        },
      },
    ),
  );
  assert.equal(parsed.ok, false);
  assert.equal(parsed.high, 1);
  assert.deepEqual(parsed.blocking, [
    { name: "paquete-malo", severity: "high" },
  ]);
});

test("parseAuditReport: critical bloquea", () => {
  const parsed = parseAuditReport(
    report({ info: 0, low: 0, moderate: 0, high: 0, critical: 2, total: 2 }),
  );
  assert.equal(parsed.ok, false);
  assert.equal(parsed.critical, 2);
});

test("parseAuditReport: JSON inválido o sin metadata falla", () => {
  assert.equal(parseAuditReport("").ok, false);
  assert.equal(parseAuditReport("no es json").ok, false);
  assert.equal(parseAuditReport("{\"metadata\":{}}").ok, false);
  assert.equal(parseAuditReport("{\"error\":{\"summary\":\"network\"}}").ok, false);
});

test("parseAuditReport: tolera texto antes del JSON", () => {
  const parsed = parseAuditReport(
    `npm WARN algo\n${report({ info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 })}`,
  );
  assert.equal(parsed.ok, true);
});
