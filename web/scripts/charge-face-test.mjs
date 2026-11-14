import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const sourcePath = fileURLToPath(new URL("../src/lib/charge-face.ts", import.meta.url));
const source = readFileSync(sourcePath, "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { chargeFace, CHARGE_LATE_WITHIN_MS } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);

const now = Date.parse("2026-11-14T18:00:00.000Z");

test("sin reloj no afirma tardío ni vencido", () => {
  const face = chargeFace({
    status: "payment_pending",
    qrExpiresAt: new Date(now - 1000).toISOString(),
    now: null,
  });
  assert.equal(face.face, "waiting");
  assert.equal(face.label, "Por cobrar");
});

test("quedan dos minutos o menos: tardío, sin pagar", () => {
  const face = chargeFace({
    status: "payment_pending",
    qrExpiresAt: new Date(now + CHARGE_LATE_WITHIN_MS).toISOString(),
    now,
  });
  assert.equal(face.face, "late");
  assert.equal(face.label, "Tardío");
  assert.match(face.detail, /no confirma/i);
  assert.doesNotMatch(face.label, /pagado/i);
});

test("pasó la vigencia: vencido, y el pedido sigue abierto", () => {
  const face = chargeFace({
    status: "payment_pending",
    qrExpiresAt: new Date(now - 1).toISOString(),
    now,
  });
  assert.equal(face.face, "expired");
  assert.equal(face.label, "Vencido");
  assert.match(face.detail, /no hay pago/i);
});

test("pey no creó el cobro: rechazado", () => {
  const face = chargeFace({
    status: "payment_pending",
    qrExpiresAt: new Date(now + 600_000).toISOString(),
    rejected: true,
    now,
  });
  assert.equal(face.face, "rejected");
  assert.equal(face.label, "Rechazado");
  assert.match(face.detail, /sin pagar/i);
});

test("la simulación no se llama pagado", () => {
  for (const rejected of [false, true]) {
    const face = chargeFace({
      status: "payment_pending",
      simulation: true,
      rejected,
      qrExpiresAt: new Date(now - 1).toISOString(),
      now,
    });
    assert.match(face.label, /demo/i);
    assert.doesNotMatch(face.label, /pagado/i);
    assert.match(face.detail, /no es (un pago|dinero real)/i);
  }
});

test("un 4xx de pey se responde como cobro no aceptado", async () => {
  const rejectionPath = fileURLToPath(new URL("../src/lib/pey-rejection.ts", import.meta.url));
  const rejectionJs = ts.transpileModule(readFileSync(rejectionPath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const rejection = await import(
    `data:text/javascript;base64,${Buffer.from(rejectionJs).toString("base64")}`
  );
  const response = rejection.peyRejectionResponse(
    new Error('pey 400: {"message":"refused","type":"INVALID_STATE"}'),
  );
  assert.equal(response.status, 422);
  const body = await response.json();
  assert.equal(body.code, "pey_rejected");
  assert.match(body.error, /sin pagar/i);
  assert.equal(JSON.stringify(body).includes("INVALID_STATE"), false);
  assert.equal(rejection.peyRejectionResponse(new Error("pey 503: down")), null);
});

test("un pedido pagado no cambia de cara por el reloj", () => {
  const face = chargeFace({
    status: "paid",
    qrExpiresAt: new Date(now - 1).toISOString(),
    now,
  });
  assert.equal(face.face, "waiting");
});
