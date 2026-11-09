import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {registerHooks} from 'node:module';
const source=path.resolve('src');
registerHooks({resolve(specifier,context,next){
 if(specifier==='next/server')return next('next/server.js',context);
 if(specifier.startsWith('@/'))return next(pathToFileURL(path.join(source,specifier.slice(2)+'.ts')).href,context);
 try{return next(specifier,context)}catch(error){
  if(specifier.startsWith('.')&&context.parentURL?.endsWith('.ts')&&!path.extname(specifier))return next(specifier+'.ts',context);
  throw error;
 }
}});
const {proxy}=await import('../src/proxy.ts');
const {NextRequest}=await import('next/server.js');

test('diagnostics stays HTTP404 unless both runtime flag and exact canary origin are set',()=>{
 const previous={...process.env};
 try{
  Object.assign(process.env,{DEMO_MODE:'true',JUDGE_DEMO_ACCOUNTS:'true',APP_URL:'https://production.example.test'});
  delete process.env.PEY_API_KEY;delete process.env.OPERATOR_ACCESS_TOKEN;
  const request=()=>new NextRequest('http://127.0.0.1:4599/ops/sentry-diagnostics');
  for(const [flag,url] of [['false','http://127.0.0.1:4599'],['true','https://production.example.test'],['true','http://127.0.0.1:4598']]){
   process.env.SENTRY_DIAGNOSTICS_ENABLED=flag;process.env.APP_URL=url;
   const response=proxy(request());assert.equal(response.status,404);assert.match(response.headers.get('cache-control'),/no-store/);
  }
  process.env.SENTRY_DIAGNOSTICS_ENABLED='true';process.env.APP_URL='http://127.0.0.1:4599';
  assert.equal(proxy(request()).headers.get('x-middleware-next'),'1');
 }finally{for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous)}
});
