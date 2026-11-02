import assert from "node:assert/strict";
import { test } from "node:test";

import { assertPaymentProvider, coveredStatus } from "../src/lib/payment-rules.ts";

test("allowlist: pey y demo son los únicos proveedores de dinero", () => {
  assert.equal(assertPaymentProvider("pey"), "pey");
  assert.equal(assertPaymentProvider(" demo "), "demo");
});

test("allowlist: cash, mixed y proveedores inventados lanzan", () => {
  for (const provider of ["cash", "mixed", "stripe", "manual", ""]) {
    assert.throws(
      () => assertPaymentProvider(provider),
      /Proveedor de pago no permitido/,
      provider,
    );
  }
});

test("un pago cubierto nunca se marca fulfilled", () => {
  assert.equal(coveredStatus("pey"), "paid");
  assert.equal(coveredStatus("demo"), "demo_paid");
  assert.notEqual(coveredStatus("pey"), "fulfilled");
  assert.notEqual(coveredStatus("demo"), "fulfilled");
});
