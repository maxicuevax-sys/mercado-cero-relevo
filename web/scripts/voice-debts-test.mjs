import assert from "node:assert/strict";
import { test } from "node:test";

import { toSpeechText } from "../src/lib/speech.ts";
import { answerDebtQuery } from "../src/lib/voice-debts.ts";
import { mockParse } from "../src/lib/voice-local.ts";

const BASE_CREDITS = Object.freeze([
  Object.freeze({
    id: "credit-juan-1",
    customerId: "customer-juan",
    customerName: "Juan",
    balanceCents: 5000,
    status: "open",
  }),
  Object.freeze({
    id: "credit-juan-2",
    customerId: "customer-juan",
    customerName: "Juan",
    balanceCents: 8000,
    status: "open",
  }),
  Object.freeze({
    id: "credit-juan-settled",
    customerId: "customer-juan",
    customerName: "Juan",
    balanceCents: 9900,
    status: "settled",
  }),
  Object.freeze({
    id: "credit-ana",
    customerId: "customer-ana",
    customerName: "Ana",
    balanceCents: 2500,
    status: "open",
  }),
  Object.freeze({
    id: "credit-luis-zero",
    customerId: "customer-luis",
    customerName: "Luis",
    balanceCents: 0,
    status: "open",
  }),
  Object.freeze({
    id: "credit-pedro-settled",
    customerId: "customer-pedro",
    customerName: "Pedro",
    balanceCents: 3000,
    status: "settled",
  }),
]);

test("suma las dos deudas abiertas de Juan e ignora la liquidada", () => {
  const result = answerDebtQuery("¿Cuánto me debe Juan?", BASE_CREDITS);
  assert.ok(result);
  assert.equal(result.kind, "customer");
  assert.equal(result.customerName, "Juan");
  assert.equal(result.totalCents, 13000);
  assert.equal(result.debtCount, 2);
  assert.equal(result.answer, "Juan te debe $130.00 en 2 fiados.");
});

test("una sola deuda usa el singular", () => {
  const result = answerDebtQuery("cuánto me debe Ana", BASE_CREDITS);
  assert.ok(result);
  assert.equal(result.kind, "customer");
  assert.equal(result.totalCents, 2500);
  assert.equal(result.debtCount, 1);
  assert.equal(result.answer, "Ana te debe $25.00 en 1 fiado.");
});

test("sin deuda abierta responde con el nombre consultado", () => {
  for (const phrase of ["cuánto me debe Luis", "cuánto me debe Pedro"]) {
    const result = answerDebtQuery(phrase, BASE_CREDITS);
    assert.ok(result);
    assert.equal(result.kind, "not_found");
    const name = phrase.endsWith("Luis") ? "Luis" : "Pedro";
    assert.equal(result.answer, `No encontré deudas abiertas de ${name}.`);
  }
});

test("sin nombre no inventa un cliente", () => {
  const result = answerDebtQuery("cuánto me debe", BASE_CREDITS);
  assert.ok(result);
  assert.equal(result.kind, "needs_name");
});

test("consulta general suma todo y cuenta deudas y clientes", () => {
  for (const phrase of ["¿quién me debe?", "¿cuánto me deben?"]) {
    const result = answerDebtQuery(phrase, BASE_CREDITS);
    assert.ok(result);
    assert.equal(result.kind, "general");
    assert.equal(result.totalCents, 15500);
    assert.equal(result.debtCount, 3);
    assert.equal(result.customerCount, 2);
    assert.equal(result.answer, "Te deben $155.00 en 3 fiados de 2 clientes.");
  }
});

test("consulta general sin deudas abiertas", () => {
  const result = answerDebtQuery("quién me debe", [
    { customerId: "customer-pedro", customerName: "Pedro", balanceCents: 3000, status: "settled" },
  ]);
  assert.ok(result);
  assert.equal(result.kind, "general");
  assert.equal(result.debtCount, 0);
  assert.equal(result.answer, "No hay deudas abiertas.");
});

test("nombres ambiguos no adivinan y piden elegir", () => {
  const result = answerDebtQuery("cuánto me debe José", [
    { customerId: "customer-jose-1", customerName: "José", balanceCents: 1000, status: "open" },
    { customerId: "customer-jose-2", customerName: "Jose", balanceCents: 2000, status: "open" },
  ]);
  assert.ok(result);
  assert.equal(result.kind, "ambiguous");
  assert.equal(result.candidates.length, 2);
  assert.match(result.answer, /dime cuál/i);
  assert.match(result.answer, /\$10\.00/);
  assert.match(result.answer, /\$20\.00/);
  assert.doesNotMatch(result.answer, /\$30\.00/);
});

test("dos fiados del mismo customerId no son ambiguos", () => {
  const result = answerDebtQuery("cuánto me debe Juan", [
    { customerId: "customer-juan", customerName: "Juan", balanceCents: 5000, status: "open" },
    { customerId: "customer-juan", customerName: "Juan", balanceCents: 8000, status: "open" },
  ]);
  assert.ok(result);
  assert.equal(result.kind, "customer");
  assert.equal(result.debtCount, 2);
  assert.equal(result.totalCents, 13000);
});

test("toma el nombre de otro fiado del mismo customerId si falta", () => {
  const result = answerDebtQuery("cuánto me debe Juan", [
    { customerId: "customer-juan", customerName: "", balanceCents: 5000, status: "open" },
    { customerId: "customer-juan", customerName: "Juan", balanceCents: 8000, status: "open" },
  ]);
  assert.ok(result);
  assert.equal(result.kind, "customer");
  assert.equal(result.customerName, "Juan");
  assert.equal(result.totalCents, 13000);
});

test("deudas abiertas de <nombre> también es consulta por cliente", () => {
  const result = answerDebtQuery("deudas abiertas de Juan", BASE_CREDITS);
  assert.ok(result);
  assert.equal(result.kind, "customer");
  assert.equal(result.answer, "Juan te debe $130.00 en 2 fiados.");
});

test("no es consulta de deuda", () => {
  assert.equal(answerDebtQuery("dos quesadillas y un agua", BASE_CREDITS), null);
  assert.equal(answerDebtQuery("cuánto vendí hoy", BASE_CREDITS), null);
  assert.equal(answerDebtQuery("", BASE_CREDITS), null);
});

test("la consulta no muta los créditos ni intenta usar la red", () => {
  const snapshot = JSON.stringify(BASE_CREDITS);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("answerDebtQuery no debe hacer fetch");
  };
  try {
    const result = answerDebtQuery("¿cuánto me deben?", BASE_CREDITS);
    assert.ok(result);
    assert.equal(result.kind, "general");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(JSON.stringify(BASE_CREDITS), snapshot);
});

test("'me transfirió ... del fiado' se clasifica como abono digital", () => {
  const parsed = mockParse("me transfirió 50 del fiado");
  assert.equal(parsed.intent, "credit_payment");
  assert.equal(parsed.creditCents, 5000);
  assert.equal(parsed.creditMethod, "codi");
});

test("'Juan me transfirió 50' es abono digital sin exigir la palabra fiado", () => {
  const parsed = mockParse("Juan me transfirió 50");
  assert.equal(parsed.intent, "credit_payment");
  assert.equal(parsed.creditMethod, "codi");
});

test("métodos explícitos: CoDi/depósito/digital, tarjeta, efectivo y sin señal", () => {
  const codi = mockParse("Juan me pagó 50 del fiado con CoDi");
  assert.equal(codi.intent, "credit_payment");
  assert.equal(codi.creditMethod, "codi");

  const deposit = mockParse("Juan me depositó 50 del fiado");
  assert.equal(deposit.intent, "credit_payment");
  assert.equal(deposit.creditMethod, "codi");

  const card = mockParse("Juan me pagó 50 con tarjeta del fiado");
  assert.equal(card.intent, "credit_payment");
  assert.equal(card.creditMethod, "card");
  assert.equal(card.customerName, null);

  const cash = mockParse("Juan me pagó 50 en efectivo");
  assert.equal(cash.intent, "credit_payment");
  assert.equal(cash.creditMethod, "cash");

  const noSignal = mockParse("Juan me pagó 50");
  assert.equal(noSignal.intent, "credit_payment");
  assert.equal(noSignal.creditMethod, null);
});

test("una venta normal sigue siendo venta y no lleva método de abono", () => {
  const sale = mockParse("dos quesadillas y un agua");
  assert.equal(sale.intent, "sale");
  assert.equal(sale.items.length, 2);
  assert.equal(sale.creditMethod, null);

  const paidSale = mockParse("dos quesadillas, me pagó con 100");
  assert.equal(paidSale.intent, "sale");
  assert.equal(paidSale.creditMethod, null);
});

test("el TTS convierte montos con y sin signo de pesos", () => {
  assert.equal(
    toSpeechText("Escuché 70.00 pesos. ¿Confirmas?"),
    "Escuché 70 pesos. ¿Confirmas?",
  );
  assert.equal(toSpeechText("Cuesta $50.50."), "Cuesta 50 pesos con 50 centavos.");
  assert.equal(toSpeechText("Saldo: $0.00."), "Saldo: cero pesos.");
  assert.equal(toSpeechText("Hoy $1,800.00."), "Hoy 1800 pesos.");
  assert.equal(toSpeechText("Son 0.00 pesos."), "Son cero pesos.");
});
