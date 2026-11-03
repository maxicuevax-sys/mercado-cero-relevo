import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const sourcePath = fileURLToPath(
  new URL("../src/lib/payment-labels.ts", import.meta.url),
);
const source = readFileSync(sourcePath, "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const labels = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);

test("demo nunca se llama Pagado ni entregable", () => {
  const demo = labels.PAYMENT_STATES.demo;
  assert.match(demo.label, /demo/i);
  assert.match(demo.label, /simulado/i);
  assert.doesNotMatch(demo.label, /pagado/i);
  assert.doesNotMatch(demo.label, /entregable/i);
  assert.match(demo.detail, /no es dinero real/i);
  assert.match(demo.detail, /no se entrega/i);
});

test("verificado solo para pey", () => {
  assert.match(
    labels.PAYMENT_STATES.digital_verified.label,
    /verificado por pey/i,
  );
  assert.doesNotMatch(
    labels.PAYMENT_STATES.digital_declared.label,
    /verificado por pey/i,
  );
  assert.match(
    labels.PAYMENT_STATES.digital_declared.label,
    /sin verificar/i,
  );
  assert.match(labels.PAYMENT_STATES.cash_received.label, /efectivo/i);
});

test("verify local no afirma que el dinero llegó", () => {
  const local = labels.verifySourceCopy("local");
  assert.equal(local.label, "Registrado por webhook firmado");
  assert.doesNotMatch(local.label, /dinero sí llegó/i);
  assert.doesNotMatch(local.speech, /dinero sí llegó/i);
  const pey = labels.verifySourceCopy("pey");
  assert.equal(pey.label, "Confirmado ahora por pey");
  assert.match(pey.detail, /pey/i);
  const demo = labels.verifySourceCopy("demo");
  assert.doesNotMatch(demo.label, /verificado/i);
});

test("estados de pedido no confunden demo con pagado", () => {
  assert.equal(
    labels.orderStatusCopy("demo_paid").label,
    labels.PAYMENT_STATES.demo.label,
  );
  assert.match(labels.orderStatusCopy("demo_paid").detail, /no se entrega/i);
  assert.equal(labels.orderStatusCopy("confirmed").label, "Por cobrar");
  assert.equal(labels.orderStatusCopy("partially_paid").label, "Pago parcial");
});

test("success pendiente espera firma y no retiene al comprador", () => {
  const pending = labels.SUCCESS_COPY.pending;
  assert.match(pending.body, /confirmación firmada de pey/i);
  assert.match(pending.body, /Puedes cerrar/i);
  assert.doesNotMatch(pending.body, /salió del banco/i);
  assert.doesNotMatch(pending.body, /No cierres/i);
});

test("success demo dice simulado y no verificado", () => {
  const demo = labels.SUCCESS_COPY.demo;
  assert.match(demo.title, /demo/i);
  assert.match(demo.body, /no es dinero real/i);
  assert.doesNotMatch(`${demo.title} ${demo.body}`, /verificado/i);
});
