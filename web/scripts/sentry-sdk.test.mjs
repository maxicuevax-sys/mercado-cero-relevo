import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import * as Sentry from '@sentry/nextjs';
import { createSentryOptions } from '../src/lib/observability/sentry-options.ts';

test('real SDK error pipeline strips identity, voice/payment data and attachment envelope items before transport', async()=>{
 const envelopes=[];
 const client=Sentry.init({
  ...createSentryOptions({dsn:'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@o0.ingest.sentry.io/123',production:true,release:'a'.repeat(40)}),
  tracesSampleRate:1,
  defaultIntegrations:false,
  transport:()=>({send:async envelope=>{envelopes.push(envelope);return{statusCode:200}},flush:async()=>true}),
 });
 try {
  Sentry.withScope(scope=>{
   scope.setUser({id:'customer-private',email:'customer-private@example.test'});
   scope.setExtra('voice','voice-private');scope.setTag('payment','payment-private');
   scope.addAttachment({filename:'voice-private.wav',data:'voice-private'});
   const error=new Error('customer-private payment-private');
   error.stack='Error: customer-private\n    at customer-private (https://example.test/_next/static/chunks/app.js?token=payment-private:12:3)';
   Sentry.startSpan({op:'http.client',name:'customer-private',attributes:{private:'payment-private'}},()=>Sentry.captureException(error));
   Sentry.startSession();
   Sentry.captureSession();
  });
  assert.equal(await Sentry.flush(2000),true);
  assert.ok(envelopes.length>0);
  const serialized=JSON.stringify(envelopes);
  assert.doesNotMatch(serialized,/customer-private|payment-private|voice-private/);
  assert.equal(envelopes.some(([,items])=>items.some(([header])=>header.type==='attachment')),false);
  const session=envelopes.flatMap(([,items])=>items).find(([header])=>header.type==='session')?.[1];
  assert.ok(session,'session pipeline was exercised independently of beforeSend');
  assert.equal(session.did,undefined);
  const event=envelopes.flatMap(([,items])=>items).find(([header])=>header.type==='event')?.[1];
  assert.equal(event.release,'a'.repeat(40));
  assert.ok(event.exception.values[0].stacktrace.frames.length>0);
  const transaction=envelopes.flatMap(([,items])=>items).find(([header])=>header.type==='transaction')?.[1];
  assert.ok(transaction,'real SDK tracing pipeline was exercised');
  assert.equal(transaction.transaction,'Trangui application');
 } finally {await client.close(2000);}
});


registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (specifier.startsWith('.') && context.parentURL?.endsWith('.ts') && !/\.[a-z]+$/i.test(specifier)) return next(specifier+'.ts', context);
    throw error;
  }
} });
const { captureUnexpectedError } = await import('../src/lib/observability/capture-unexpected.ts');

test('native errors retain a real synchronous application boundary and their scrubbed cause', async () => {
  const dsn = 'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@o0.ingest.sentry.io/123';
  const previousDsn = process.env.SENTRY_DSN;
  process.env.SENTRY_DSN = dsn;
  let deliver;
  const delivered = new Promise(resolve => { deliver = resolve; });
  const envelopes = [];
  const options = createSentryOptions({ dsn, production: true, release: 'b'.repeat(40) });
  const client = Sentry.init({
    ...options,
    defaultIntegrations: false,
    integrations: defaults => [...options.integrations(defaults), Sentry.linkedErrorsIntegration()],
    transport: () => ({ send: async envelope => { envelopes.push(envelope); deliver(); return { statusCode: 200 }; }, flush: async () => true }),
  });
  let timer;
  try {
    let nativeError;
    try { new URL('https://[dictado-private'); } catch (error) { nativeError = error; }
    assert.ok(nativeError instanceof TypeError);
    assert.doesNotMatch(nativeError.stack, /[\\/]src[\\/]/, 'native error has no application frame before capture');
    captureUnexpectedError(nativeError);
    await Promise.race([delivered, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('capture was not delivered')), 2000); })]);
    await Sentry.flush(2000);
    const events = envelopes.flatMap(([, items]) => items).filter(([header]) => header.type === 'event').map(([, event]) => event);
    assert.equal(events.length, 1, 'one operation failure produces one error event');
    const event = events[0];
    const values = event.exception.values;
    const boundary = values.flatMap(value => value.stacktrace?.frames ?? []).find(frame => /src[\\/]lib[\\/]observability[\\/]capture-unexpected\.ts$/.test(frame.filename ?? ''));
    assert.ok(boundary, 'a real application boundary survives the SDK and privacy pipeline');
    assert.ok(boundary.lineno > 0 && boundary.colno > 0);
    assert.ok(values.some(value => value.type === 'TypeError'), 'native cause remains available');
    assert.ok(values.some(value => value.type === 'Error'), 'boundary wrapper remains available');
    assert.equal(event.release, 'b'.repeat(40));
    assert.doesNotMatch(JSON.stringify(envelopes), /dictado-private/);
  } finally {
    clearTimeout(timer);
    await client.close(2000);
    if (previousDsn === undefined) delete process.env.SENTRY_DSN; else process.env.SENTRY_DSN = previousDsn;
  }
});
