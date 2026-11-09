import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';

const formatUrl = new URL('../src/lib/format.ts', import.meta.url).href;
const configUrl = new URL('../src/lib/config.ts', import.meta.url).href;
const script = `
  const ActualDate=Date;
  globalThis.Date=class extends ActualDate {
    constructor(...args){ super(...(args.length ? args : ['2027-01-01T00:30:00Z'])); }
  };
  const f=await import(${JSON.stringify(formatUrl)});
  const c=await import(${JSON.stringify(configUrl)});
  const normalize=s=>s.replace(/\\s/g,'');
  console.log(JSON.stringify({
    clock:normalize(f.formatTime('2026-11-09T00:15:00Z')),
    receiptClock:normalize(c.formatTime('2026-11-09T00:15:00Z')),
    today:normalize(f.formatActivityDate('2026-12-31T23:15:00Z')),
    yesterday:normalize(f.formatActivityDate('2026-12-31T05:00:00Z')),
    nextYear:normalize(f.formatActivityDate('2027-01-01T06:15:00Z')),
    longDate:normalize(f.formatLongDate()),
    dates:['2026-11-08','2027-01-01','2026-02-11'].map(v=>normalize(f.formatDayMonth(v)))
  }));
`;
for (const timezone of ['UTC', 'America/Mexico_City']) {
  test(`receipt and activity clocks use Mexico while date-only values retain their day on ${timezone}`, () => {
    const value=JSON.parse(execFileSync(process.execPath,['--no-warnings','--input-type=module','-e',script],{env:{...process.env,TZ:timezone},encoding:'utf8'}));
    assert.equal(value.clock,'06:15p.m.');
    assert.equal(value.receiptClock,value.clock);
    assert.equal(value.today,'Hoy5:15p.m.');
    assert.equal(value.yesterday,'Ayer11:00p.m.');
    assert.match(value.nextYear,/1ene2027/);
    assert.match(value.longDate,/31dediciembre/);
    assert.deepEqual(value.dates,['8nov','1ene','11feb']);
  });
}
