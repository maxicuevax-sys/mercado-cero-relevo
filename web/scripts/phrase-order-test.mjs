import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

function transpile(relative) {
  const sourcePath = fileURLToPath(new URL(relative, import.meta.url));
  return ts.transpileModule(readFileSync(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

const voiceUrl = `data:text/javascript;base64,${Buffer.from(transpile("../src/lib/voice-local.ts")).toString("base64")}`;
const timelineUrl = `data:text/javascript;base64,${Buffer.from(transpile("../src/lib/pulso-timeline.ts")).toString("base64")}`;
const applyJs = transpile("../src/lib/pulso-apply.ts").replaceAll(
  'from "./pulso-timeline"',
  `from "${timelineUrl}"`,
);
const applyUrl = `data:text/javascript;base64,${Buffer.from(applyJs).toString("base64")}`;
const phraseJs = transpile("../src/lib/phrase-order.ts")
  .replaceAll('from "./voice-local"', `from "${voiceUrl}"`)
  .replaceAll('from "./pulso-apply"', `from "${applyUrl}"`);
const phrase = await import(`data:text/javascript;base64,${Buffer.from(phraseJs).toString("base64")}`);

const products = [
  { name: "Quesadilla", priceCents: 4500 },
  { name: "Agua", priceCents: 2000 },
  { name: "Taco", priceCents: 3500 },
];

test("una quesadilla y un agua queda en dos conceptos, sin pago", () => {
  const result = phrase.itemsFromPhrase("una quesadilla y un agua", products);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.items, [
    { description: "Quesadilla", quantity: 1, unitPriceCents: 4500 },
    { description: "Agua", quantity: 1, unitPriceCents: 2000 },
  ]);
  assert.equal("cashCents" in result, false);
  assert.equal("creditCents" in result, false);
});

test("la frase no interpreta un abono como venta", () => {
  const result = phrase.itemsFromPhrase("abono de 50 pesos a Juan", products);
  assert.equal(result.ok, false);
});
