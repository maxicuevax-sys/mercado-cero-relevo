import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

function moduleUrl(file) {
  return `data:text/javascript;base64,${Buffer.from(ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText).toString("base64")}`;
}
const typesUrl = moduleUrl("../src/components/caja/types.ts");
const adapterJs = ts.transpileModule(readFileSync(new URL("../src/components/caja/voice-draft.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace('from "./types"', `from "${typesUrl}"`);
const { voiceDraft } = await import(`data:text/javascript;base64,${Buffer.from(adapterJs).toString("base64")}`);
const { draftTotalCents } = await import(typesUrl);
const sale = (items, extra = {}) => ({ intent: "sale", items, ...extra });
const item = (patch = {}) => ({ description: " Quesadilla ", quantity: 2, unitPriceCents: 3500, ...patch });

test("dictado conserva precio unitario en centavos y total 70, sin registrar cobro", () => {
  const lines = voiceDraft(sale([item()], { cashCents: 10000, creditCents: 7000, customerName: "Juan" }));
  assert.deepEqual(lines, [{ description: "Quesadilla", quantity: "2", price: "35.00" }]);
  assert.equal(draftTotalCents(lines), 7000);
});
test("conserva cantidad fraccionaria y centavos del ticket", () => {
  const lines = voiceDraft(sale([item({ quantity: 0.125, unitPriceCents: 12345 })]));
  assert.equal(lines[0].quantity, "0.125"); assert.equal(lines[0].price, "123.45");
  assert.equal(draftTotalCents(lines), 1543);
});
test("precio desconocido permanece cero para revisión, nunca inventa precio", () => {
  assert.equal(voiceDraft(sale([item({ unitPriceCents: 0 })]))[0].price, "0.00");
});
test("abonos, consultas y unknown jamás se convierten en venta", () => {
  for (const intent of ["credit_payment", "query", "unknown"]) assert.throws(() => voiceDraft({ intent, items: [item()] }));
});
test("rechaza respuesta inválida o ticket vacío", () => {
  for (const value of [null, [], "sale", {}, sale([]), sale(null)]) assert.throws(() => voiceDraft(value));
});
test("no descarta silenciosamente una línea inválida de una venta mixta", () => {
  assert.throws(() => voiceDraft(sale([item(), item({ unitPriceCents: "3500" })])));
});
test("rechaza NaN, negativos, infinitos, fracciones de centavo y precios fuera del contrato", () => {
  for (const unitPriceCents of [NaN, Infinity, -1, 1.5, 10000001]) assert.throws(() => voiceDraft(sale([item({ unitPriceCents })])));
});
test("no trunca ni redondea silenciosamente cantidades", () => {
  for (const quantity of [0, -1, 1000, NaN, Infinity, 0.0001]) assert.throws(() => voiceDraft(sale([item({ quantity })])));
});
test("respeta límites de descripción y número de líneas", () => {
  for (const description of [" ", "x".repeat(161)]) assert.throws(() => voiceDraft(sale([item({ description })])));
  assert.equal(voiceDraft(sale(Array.from({ length: 50 }, () => item()))).length, 50);
  assert.throws(() => voiceDraft(sale(Array.from({ length: 51 }, () => item()))));
});
test("rechaza total que excede el contrato aunque cada precio sea válido", () => {
  assert.throws(() => voiceDraft(sale([item({ quantity: 999, unitPriceCents: 10000000 })])));
});
