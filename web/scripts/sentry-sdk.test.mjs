import assert from 'node:assert/strict';
import test from 'node:test';
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
