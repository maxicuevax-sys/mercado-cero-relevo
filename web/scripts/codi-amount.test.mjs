import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCodiAmountCents} from '../src/components/codi/codi-amount.ts';

test('CoDi preserves decimal comma and dot and explicit thousands grouping',()=>{
 for(const [raw,cents]of [['1,5',150],['1.50',150],['1,234.56',123456],['1.234,56',123456],[' 1,50 ',150],['0.01',1],['0,01',1],['20.00',2000],['50.00',5000],['100.00',10000],['0',0],['',0]])assert.equal(parseCodiAmountCents(raw),cents,raw);
});
test('CoDi rejects negatives, foreign characters, malformed grouping and extra precision without dropping characters',()=>{
 for(const raw of ['-2','−2','+2','1-2','abc','a1.5','$1.50','1..5','1,,5','1,2,3','1.23.4','1,234,56','0.005','12.345','1.234','1,234','12.3456','1.','1,','1 234,56','999999999999999999999'])assert.equal(parseCodiAmountCents(raw),null,raw);
});
test('accepted input canonicalizes without changing cents on blur',()=>{
 for(const raw of ['1,5','1.50','1,234.56','1.234,56','0.01','0,01','100000.00']){
  const cents=parseCodiAmountCents(raw);assert.notEqual(cents,null);assert.equal(parseCodiAmountCents((cents/100).toFixed(2)),cents,raw);
 }
});
