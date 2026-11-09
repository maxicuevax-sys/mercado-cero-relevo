import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (specifier.startsWith('.') && context.parentURL?.endsWith('.ts') && !/\.[a-z]+$/i.test(specifier)) return next(specifier+'.ts', context);
    throw error;
  }
}});
const {handleSentryTunnel} = await import('../src/lib/observability/sentry-tunnel.ts');
// Synthetic destination; the only network transport below is replaced in RAM.
const dsn = 'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@o0.ingest.sentry.io/123';
const envelope = destination => JSON.stringify({dsn:destination,event_id:'a'.repeat(32)})+'\n'+JSON.stringify({type:'event'})+'\n'+JSON.stringify({message:'synthetic setup test ñ'});
function request(body, origin='https://trangui.example.test',ip='192.0.2.91') {
  return new Request('https://trangui.example.test/sentry-tunnel',{method:'POST',headers:{Origin:origin,Cookie:'private-cookie','Authorization':'Bearer private-auth','Content-Type':'text/plain','CF-Connecting-IP':ip},body});
}

test('disabled, cross-origin and oversized requests fail closed without any network',async()=>{
 const previous=globalThis.fetch;const calls=[];
 globalThis.fetch=async(...args)=>{calls.push(args);throw Error('Network forbidden in test')};
 try {
  assert.equal((await handleSentryTunnel(request(envelope(dsn)))).status,503);
  assert.equal((await handleSentryTunnel(request(envelope(dsn),'https://foreign.example.test'),dsn)).status,403);
  assert.equal((await handleSentryTunnel(request('x'.repeat(65537)),dsn)).status,413);
  assert.equal(calls.length,0);
 } finally {globalThis.fetch=previous;}
});

test('official handler rejects a foreign DSN and forwards only an allowed envelope without credentials',async()=>{
 const previous=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,init)=>{calls.push([url,{...init,body:await new Response(init.body).text()}]);return new Response('{}',{status:200})};
 try {
  assert.equal((await handleSentryTunnel(request(envelope('https://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb@o0.ingest.sentry.io/456')),dsn)).status,403);
  assert.equal(calls.length,0);
  const response=await handleSentryTunnel(request(envelope(dsn)),dsn);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.equal(calls.length,1);
  const [url,init]=calls[0];
  assert.match(String(url),/^https:\/\/o0\.ingest\.sentry\.io\/api\/123\/envelope\//);
  assert.equal(init.method,'POST');
  assert.match(init.body,/ñ/,'UTF8 envelope survives the recalculated byte length');
  assert.equal(new Headers(init.headers).get('cookie'),null);
  assert.equal(new Headers(init.headers).get('authorization'),null);
  assert.doesNotMatch(JSON.stringify(init),/private-cookie|private-auth/);
 } finally {globalThis.fetch=previous;}
});

test('telemetry ingress returns 429 after its own budget without contacting the vendor',async()=>{
 const previous=globalThis.fetch;const calls=[];
 globalThis.fetch=async(...args)=>{calls.push(args);throw Error('Network forbidden in test')};
 try {
  for(let i=0;i<60;i++) assert.notEqual((await handleSentryTunnel(request('',undefined,'192.0.2.92'),dsn)).status,429);
  const response=await handleSentryTunnel(request('',undefined,'192.0.2.92'),dsn);
  assert.equal(response.status,429);
  assert.ok(Number(response.headers.get('retry-after'))>0);
  assert.equal(calls.length,0);
 } finally {globalThis.fetch=previous;}
});
