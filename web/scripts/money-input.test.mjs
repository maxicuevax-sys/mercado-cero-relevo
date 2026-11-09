import test from 'node:test';import assert from 'node:assert/strict';
import {parseMoneyCents,lineTotalCents} from '../src/components/caja/types.ts';
test('money rejects letters and internal signs before stripping',()=>{
 for(const raw of ['1-2','a1.5','2a0','1+2','--2','$$2','1$2','1-','1.5abc','Infinity','1..5','1,2,3','1.23.4','0.005','1,234,56'])assert.equal(parseMoneyCents(raw),0,raw);
 assert.equal(lineTotalCents({id:'bad',description:'QA',quantity:'1',price:'1-2'}),0);
});
test('money keeps supported decimal, thousands, dollar and initial negative semantics',()=>{
 for(const [raw,cents]of [['1,5',150],['1.50',150],['1,234.56',123456],['1.234,56',123456],['1.234',123400],['35.500',3550000],['$1,234.56',123456],[' $ 1.50 ',150],['-1.50',-150],['-$1.50',-150],['$-1.50',-150],['.50',50],['',0],['0',0]])assert.equal(parseMoneyCents(raw),cents,raw);
});
