import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const source = path.resolve('src');
registerHooks({resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) return next(pathToFileURL(path.join(source, specifier.slice(2)+'.ts')).href,context);
  try { return next(specifier,context); } catch(error) {
    if (specifier.startsWith('.') && context.parentURL?.endsWith('.ts') && !path.extname(specifier)) return next(specifier+'.ts',context);
    throw error;
  }
}});
const root=mkdtempSync(path.join(tmpdir(),'trangui-guest-entry-'));
Object.assign(process.env,{DEMO_MODE:'true',JUDGE_DEMO_ACCOUNTS:'true',JUDGE_DATA_ROOT:root,APP_URL:'https://guest-entry.example.test',PILOT_AUTH_SECRET:'guest-entry-test-explicit-secret-over-32-characters'});
for(const key of ['PEY_API_KEY','PEY_WEBHOOK_SECRET','OPENAI_API_KEY','OPERATOR_ACCESS_TOKEN'])delete process.env[key];
const {POST}=await import('../src/app/api/access/guest/route.ts');
const {getJudgeRuntime,verifiedJudgeAccount}=await import('../src/lib/auth/pilot-runtime.ts');
const request=(cookie='',body='{}',origin=process.env.APP_URL)=>new Request(process.env.APP_URL+'/api/access/guest',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body});
const cookieOf=r=>r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
test.after(async()=>{(await getJudgeRuntime()).identity.close();assert.match(path.basename(root),/^trangui-guest-entry-/);rmSync(root,{recursive:true,force:true});});

test('retrying guest entry retains the session and consumes only one account slot',async()=>{
  const first=await POST(request());assert.equal(first.status,200);
  const cookie=cookieOf(first);const account=await verifiedJudgeAccount(new Headers({Cookie:cookie}));
  const second=await POST(request(cookie));assert.equal(second.status,200);
  assert.equal(second.headers.get('set-cookie') === null,true,'a retry must not switch identity');
  assert.equal((await getJudgeRuntime()).identity.database.prepare('SELECT count(*) AS n FROM user').get().n,1);
  assert.equal((await verifiedJudgeAccount(new Headers({Cookie:cookie}))).id,account.id);
});
test('a registered user is not replaced by a new guest',async()=>{
  const {identity}=await getJudgeRuntime();
  const signed=await identity.auth.handler(new Request(process.env.APP_URL+'/api/auth/sign-up/email',{method:'POST',headers:{Origin:process.env.APP_URL,'Content-Type':'application/json'},body:JSON.stringify({name:'Registered',email:'registered@example.test',password:'a'})}));
  assert.equal(signed.status,200);const cookie=cookieOf(signed);
  const before=identity.database.prepare('SELECT count(*) AS n FROM user').get().n;
  const result=await POST(request(cookie));assert.equal(result.status,200);assert.equal(result.headers.get('set-cookie') === null,true);
  assert.equal(identity.database.prepare('SELECT count(*) AS n FROM user').get().n,before);
});
test('visitors sharing venue WiFi are not blocked and returning guests consume no extra slots',async()=>{
  const {identity}=await getJudgeRuntime();const before=identity.database.prepare('SELECT count(*) AS n FROM user').get().n;
  let cookie='';let last;
  const fromSameClient=(cookie='')=>new Request(process.env.APP_URL+'/api/access/guest',{method:'POST',headers:{Origin:process.env.APP_URL,Cookie:cookie,'CF-Connecting-IP':'192.0.2.88'},body:'{}'});
  for(let i=0;i<12;i++){
    last=await POST(fromSameClient());
    if(i===0)cookie=cookieOf(last);
    assert.equal(last.status,200);
  }
  for(let i=0;i<8;i++)assert.equal((await POST(fromSameClient(cookie))).status,200);
  assert.equal(identity.database.prepare('SELECT count(*) AS n FROM user').get().n,before+12);
});
test('foreign origins and oversized guest payloads fail without creating an account',async()=>{
  const {identity}=await getJudgeRuntime();const before=identity.database.prepare('SELECT count(*) AS n FROM user').get().n;
  assert.equal((await POST(request('','{}','https://attacker.test'))).status,403);
  assert.equal((await POST(request('','x'.repeat(65)))).status,413);
  assert.equal(identity.database.prepare('SELECT count(*) AS n FROM user').get().n,before);
});
