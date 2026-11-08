import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mockParse } from '../src/lib/voice-local.ts';
import { BUSINESS_PRESETS } from '../src/lib/business-presets.ts';

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
