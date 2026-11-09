import test from 'node:test';import assert from 'node:assert/strict';
import {parseQuantity,lineTotalCents,QUANTITY_ERROR} from '../src/components/caja/types.ts';
test('quantity rejects overflow and unsupported precision instead of clamping or rounding',()=>{
 for(const raw of ['1000','999.001','1000,5','1.2345','0.0001','-1','0','NaN','1e3','1,2,3'])assert.equal(parseQuantity(raw),0,raw);
 assert.equal(lineTotalCents({id:'invalid',description:'QA',quantity:'1000',price:'1'}),0);
 assert.match(QUANTITY_ERROR,/999/);
});
test('supported decimal quantities retain the exact intended quantity and total',()=>{
 for(const [raw,expected]of [['999',999],['0,5',0.5],['0.001',0.001],['1.234',1.234],['1.2300',1.23],['2',2]])assert.equal(parseQuantity(raw),expected,raw);
 assert.equal(lineTotalCents({id:'fraction',description:'QA',quantity:'0,5',price:'30'}),1500);
});
