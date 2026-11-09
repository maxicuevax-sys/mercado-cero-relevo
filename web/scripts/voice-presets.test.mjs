import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mockParse } from '../src/lib/voice-local.ts';
import { BUSINESS_PRESETS } from '../src/lib/business-presets.ts';

test('credit payment keeps comma cents rather than truncating the amount', () => {
  const parsed = mockParse('Juan me abonó 20,50 del fiado');
  assert.equal(parsed.intent, 'credit_payment');
  assert.equal(parsed.creditCents, 2050);
});
test('cash received keeps comma cents in a sale', () => {
  const parsed = mockParse('dos tacos de 20 en efectivo 50,50');
  assert.equal(parsed.intent, 'sale');
  assert.equal(parsed.cashCents, 5050);
  assert.deepEqual(parsed.items, [{ description: 'Tacos', quantity: 2, unitPriceCents: 2000 }]);
});
test('sale credit amount keeps comma cents', () => {
  const parsed = mockParse('2 tacos a 20 y fiado 10,50');
  assert.equal(parsed.intent, 'sale');
  assert.equal(parsed.creditCents, 1050);
});

for (const quantity of ['0.5', '0,5']) {
  test(`preserves fractional produce quantity ${quantity} instead of charging five kilos`, () => {
    const parsed = mockParse(`${quantity} kilos de jitomate a 30 pesos`);
    assert.deepEqual(parsed.items, [{ description: 'Kilos de jitomate', quantity: 0.5, unitPriceCents: 3000 }]);
    assert.equal(parsed.items.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPriceCents), 0), 1500);
  });
}
test('fractional explicit concept and catalog items remain ordered and are counted once', () => {
  const parsed = mockParse('1.5 kilos de jitomate a 30 pesos y dos aguas');
  assert.deepEqual(parsed.items, [
    { description: 'Kilos de jitomate', quantity: 1.5, unitPriceCents: 3000 },
    { description: 'Aguas', quantity: 2, unitPriceCents: 2000 },
  ]);
  assert.equal(parsed.items.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPriceCents), 0), 8500);
});
test('fractional catalog quantities retain their decimal value', () => {
  assert.deepEqual(mockParse('1,5 aguas').items, [{ description: 'Aguas', quantity: 1.5, unitPriceCents: 2000 }]);
});
for (const [quantity, price] of [['0.5', '30.50'], ['0,5', '30,50']]) {
  test(`preserves decimal quantity and explicit unit price ${quantity} at ${price}`, () => {
    const parsed = mockParse(`${quantity} kilo de jitomate a ${price} pesos`);
    assert.deepEqual(parsed.items, [{ description: 'Kilo de jitomate', quantity: 0.5, unitPriceCents: 3050 }]);
    assert.equal(parsed.items.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPriceCents), 0), 1525);
  });
}

for (const [business, preset] of Object.entries(BUSINESS_PRESETS)) {
  for (const example of [preset.example.replace(/^Ej\. /, ''), ...preset.suggestions.map(s => s.text)]) {
    test(`${business}: offered example parses with its explicit price: ${example}`, () => {
      const value = mockParse(example);
      assert.equal(value.intent, 'sale');
      assert.equal(value.items.length, 1);
      assert.equal(value.items[0].quantity, Number(example.match(/^\d+/)[0]));
      assert.equal(value.items[0].unitPriceCents, Number(example.match(/a (\d+) pesos/)[1]) * 100);
    });
  }
}
test('mixed explicit multiword and catalog concepts stay ordered without duplicates', () => {
  assert.deepEqual(mockParse('2 playeras de algodón a 100 pesos y un agua').items, [
    { description: 'Playeras de algodón', quantity: 2, unitPriceCents: 10000 },
    { description: 'Agua', quantity: 1, unitPriceCents: 2000 },
  ]);
});
