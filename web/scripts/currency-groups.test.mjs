import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch(error) { if(specifier.startsWith('.') && context.parentURL?.endsWith('.ts') && !specifier.endsWith('.ts')) return nextResolve(specifier+'.ts',context); throw error; }
}});
const { currencyGroups } = await import('../src/components/ui/currency-groups.ts');
test('all groups retain cents and comma separators even above one million', () => {
  for (const [cents, expected] of [[100005000,['$1,','000,','050.00']], [123456789012345,['$1,','234,','567,','890,','123.45']], [0,['$0.00']]]) {
    assert.deepEqual(currencyGroups(cents), expected);
    assert.equal(currencyGroups(cents).join(''), new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:2}).format(cents/100));
    assert.match(currencyGroups(cents).at(-1), /\d\.\d{2}$/);
  }
});
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const source=readFileSync(new URL('../src/components/ui/grouped-currency.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText;
const renderedModule={exports:{}};
new Function('require','exports',compiled)(id=>id==='./currency-groups'?{currencyGroups}:require(id),renderedModule.exports);
test('render keeps groups atomic, break opportunities explicit, full accessible amount',()=>{
  for(const cents of [100005000,123456789012345]) {
    const html=renderToStaticMarkup(React.createElement(renderedModule.exports.GroupedCurrency,{cents,label:'Saldo'}));
    const groups=currencyGroups(cents);
    assert.equal((html.match(/<wbr\/>/g)||[]).length,groups.length-1);
    assert.equal((html.match(/data-currency-group/g)||[]).length,groups.length);
    assert.ok(html.includes(`aria-label="Saldo: ${groups.join('')} MXN"`));
    assert.ok(html.includes(`${groups.at(-1)}</span>`));
    assert.ok(!html.includes('font-size'));
  }
});
