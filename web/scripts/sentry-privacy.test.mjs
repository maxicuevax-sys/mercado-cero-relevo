import assert from 'node:assert/strict';
import test from 'node:test';
import { createSentryOptions, sanitizeSentryEvent, sanitizeSentrySpan } from '../src/lib/observability/sentry-options.ts';

const dsn = 'https://fixture-key@o0.ingest.sentry.io/123';
const release = 'a'.repeat(40);

test('no DSN leaves monitoring off; configured rates are bounded and all sensitive collection is disabled', () => {
  assert.equal(createSentryOptions({ production: true }).enabled, false);
  const options = createSentryOptions({ dsn, release, environment: 'production', production: true });
  assert.equal(options.enabled, true);
  assert.equal(options.tracesSampleRate, 0.05);
  assert.equal(createSentryOptions({ dsn, production: false }).tracesSampleRate, 1);
  assert.deepEqual(options.dataCollection, {
    userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false,
    graphQL: { document: false, variables: false }, genAI: { inputs: false, outputs: false },
    mcp: { inputs: false, outputs: false }, databaseQueryData: false, queues: false,
    stackFrameVariables: false, frameContextLines: 0,
  });
  assert.equal(options.maxBreadcrumbs, 0);
  assert.equal(options.beforeBreadcrumb({ message: 'customer-name' }), null);
  assert.equal(options.beforeSendLog({ body: 'dictated voice' }), null);
  assert.equal(options.beforeSendMetric({ value: 123 }), null);
  assert.equal(options.replaysSessionSampleRate, 0);
  assert.equal(options.replaysOnErrorSampleRate, 0);
  assert.equal(options.profileSessionSampleRate, 0);
  assert.equal(options.release, release);
});

test('error scrubber removes free text, identities, payment/voice details and attachments while retaining grouping frames', () => {
  const hint = { attachments: [{ filename: 'voice.wav', data: 'audio-customer-private' }] };
  const event = {
    event_id: 'b'.repeat(32), timestamp: 1, platform: 'javascript', level: 'error', release,
    environment: 'production', message: 'customer-name owes payment-private',
    logentry:{message:'customer-name'}, transaction_info:{source:'customer-private'},
    user: { id: 'customer-private', email: 'customer@example.test' },
    request: { url: 'https://example.test/fiados/customer-name?voice=voice-private', headers: { Cookie: 'cookie-private' }, data: 'dictated-private' },
    extra: { order: { amount: 3299, bank: 'bank-private' }, audio: 'voice-private' },
    breadcrumbs: [{ message: 'dictated-private' }],
    contexts: { customer: { name: 'customer-name' }, trace: { trace_id: 'c'.repeat(32), span_id: 'd'.repeat(16), data: { secret: 'trace-private' } } },
    tags: { customer: 'customer-private' }, fingerprint: ['customer-name'], transaction: '/fiados/customer-name',
    exception: { values: [{ type: 'TypeError', value: 'customer-name payment-private', mechanism: { type: 'generic', handled: true, data: { secret: 'mechanism-private' } }, stacktrace: { frames: [{ filename: 'https://example.test/_next/static/chunks/app.js?token=frame-private', function: 'customer-name', lineno: 23, colno: 12, vars: { name: 'customer-name' }, pre_context: ['voice-private'], context_line: 'payment-private', post_context: ['bank-private'] }, { filename: 'https://example.test/people/customer-name.js', function: 'customer-name' }] } }] },
  };
  const output = sanitizeSentryEvent(event, hint);
  const serialized = JSON.stringify(output);
  assert.doesNotMatch(serialized, /customer-name|customer-private|customer@example|payment-private|cookie-private|dictated-private|voice-private|bank-private|trace-private|mechanism-private|frame-private|3299/);
  assert.deepEqual(hint.attachments, []);
  assert.equal(output.exception.values[0].type, 'TypeError');
  assert.equal(output.exception.values[0].stacktrace.frames[0].filename, 'https://example.test/_next/static/chunks/app.js');
  assert.equal(output.exception.values[0].stacktrace.frames[0].lineno, 23);
  assert.equal(output.exception.values[0].stacktrace.frames[1].filename, undefined);
  assert.equal(output.release, release);
  assert.equal(output.event_id, event.event_id);
  assert.equal(event.message, 'customer-name owes payment-private', 'does not mutate caller scopes');
});

test('SDK 11 streamed spans drop free names, links, query data and non-public attributes', () => {
 const output = sanitizeSentrySpan({ trace_id:'c'.repeat(32),span_id:'d'.repeat(16),start_timestamp:1,end_timestamp:2,status:'error',is_segment:true,name:'customer-private',attributes:{'sentry.op':'http.server','http.request.method':'POST','http.response.status_code':500,'db.query.text':'payment-private','gen_ai.input.messages':'voice-private'},links:[{attributes:{name:'customer-private'}}] });
 assert.deepEqual(output.attributes,{'http.request.method':'POST','http.response.status_code':500});
 assert.equal(output.name,'http.server');
 assert.doesNotMatch(JSON.stringify(output),/private|links/);
});

test('Windows/file URLs and Linux code paths cannot send local account names',()=>{
 for(const filename of ['file:///C:/Users/customer-private/work/src/app/page.ts','C:\\Users\\customer-private\\work\\src\\app\\page.ts','file:///home/customer-private/work/src/app/page.ts']){
  const output=sanitizeSentryEvent({exception:{values:[{stacktrace:{frames:[{filename,function:'customer-private',lineno:10,colno:3}]}}]}});
  assert.doesNotMatch(JSON.stringify(output),/customer-private/);
  assert.equal(output.exception.values[0].stacktrace.frames[0].lineno,10);
 }
});

test('spans retain trace identity and only public protocol attributes', () => {
  const span = {
    trace_id: 'c'.repeat(32), span_id: 'd'.repeat(16), parent_span_id: 'e'.repeat(16),
    start_timestamp: 1, timestamp: 2, op: 'http.client', description: 'POST /api/voice?customer=private',
    data: { 'http.request.method': 'POST', 'http.response.status_code': 503, 'http.url': 'https://example.test?voice-private', 'customer.name': 'customer-private', 'gen_ai.input.messages': 'dictated-private' },
    tags: { private: 'payment-private' }, events: [{ name: 'voice-private' }],
  };
  const output = sanitizeSentrySpan(span);
  assert.equal(output.trace_id, span.trace_id);
  assert.deepEqual(output.data, { 'http.request.method': 'POST', 'http.response.status_code': 503 });
  assert.doesNotMatch(JSON.stringify(output), /private|dictated|\/api\/voice/);
});
