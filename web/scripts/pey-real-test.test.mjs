import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "trangui-profile-contract-"));
const compiled = new Map();
function compile(relative) {
  if (compiled.has(relative)) return compiled.get(relative);
  const sourcePath = path.join(sourceRoot, relative);
  const output = path.join(temporary, "compiled", relative.replace(/\.ts$/, ".mjs"));
  compiled.set(relative, output);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const source = fs.readFileSync(sourcePath, "utf8").replace(
    /(from\s*|import\(\s*)(["'])([^"']+)\2/g,
    (full, prefix, quote, specifier) => {
      if (specifier.startsWith("node:")) return full;
      let dependency;
      if (specifier.startsWith("@/")) dependency = path.join(sourceRoot, specifier.slice(2) + ".ts");
      else if (specifier.startsWith(".")) dependency = path.resolve(path.dirname(sourcePath), specifier + ".ts");
      else return `${prefix}${quote}${import.meta.resolve(specifier === "next/server" ? "next/server.js" : specifier)}${quote}`;
      return `${prefix}${quote}${pathToFileURL(compile(path.relative(sourceRoot, dependency))).href}${quote}`;
    },
  );
  fs.writeFileSync(output, ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText);
  return output;
}


import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";
const m = await import(pathToFileURL(compile("lib/pey-real-test.ts")).href);
const secret=crypto.randomBytes(24).toString("base64");
Object.assign(process.env,{REAL_TEST_ALLOWED_ACCOUNT_ID:"alpha",REAL_TEST_PEY_ENABLED:"true",REAL_TEST_PEY_RECEIVER_KIND:"official-pey-test-bank",REAL_TEST_PEY_API_KEY:"contract-only",REAL_TEST_PEY_WEBHOOK_SECRET:secret,REAL_TEST_PEY_BANK_ACCOUNT_ID:"01JBAVWE4NS5TGXHWGMX3KH23Q",REAL_TEST_PEY_API_KEY_ID:"01M3QMMR6X9CBVDY1SF3G8QWNW"});
function signed(event,age=0,id="event_1") {
 const raw=JSON.stringify(event),timestamp=String(Math.floor(Date.now()/1000)+age);
 const sig=crypto.createHmac("sha256",Buffer.from(secret,"base64")).update(`${id}.${timestamp}.${raw}`).digest("base64");
 return [raw,new Headers({"webhook-id":id,"webhook-timestamp":timestamp,"webhook-signature":`v1,${sig}`})];
}
function mock(calls) { return async(url,init)=>{calls.push({url,init});return Response.json(url.includes("bank-account")?{id:process.env.REAL_TEST_PEY_BANK_ACCOUNT_ID,codiStatus:"ACTIVE"}:{id:"123abc",qrString:"actual-provider-payload"});}; }
test("requires explicit receiver configuration",()=>{delete process.env.REAL_TEST_PEY_RECEIVER_KIND;assert.equal(m.realTestConfig(),null);process.env.REAL_TEST_PEY_RECEIVER_KIND="official-pey-test-bank";});
test("fixed centavo and one global attempt; accounts isolated; no business orders",async()=>{
 const db=new DatabaseSync(":memory:"),calls=[];const result=await m.createRealTest(db,"alpha",mock(calls));
 assert.equal(result.amountCents,1);assert.equal(result.paidConfirmed,false);
 const body=JSON.parse(calls[1].init.body);assert.equal(body.amount,0.01);assert.equal(body.bankAccountId,process.env.REAL_TEST_PEY_BANK_ACCOUNT_ID);assert.equal(body.expiration,600);
 await assert.rejects(m.createRealTest(db,"beta",mock(calls)),/forbidden/);assert.equal(m.publicRealTest(m.realTestRow(db),"beta"),null);assert.equal(calls.length,2);
 assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE name IN ('orders','payments')").get().n,0);db.close();
});
test("unknown transport result blocks all recreation",async()=>{
 const db=new DatabaseSync(":memory:"),calls=[];
 await assert.rejects(m.createRealTest(db,"alpha",async(url,init)=>{if(url.includes("bank-account"))return mock(calls)(url,init);calls.push({url});throw Error("timeout");}),/outcome_unknown/);
 assert.equal((await m.createRealTest(db,"alpha",mock(calls))).status,"unknown");assert.equal(calls.length,2);db.close();
});
test("inactive receiver cannot issue QR",async()=>{const db=new DatabaseSync(":memory:");await assert.rejects(m.createRealTest(db,"alpha",async()=>Response.json({id:process.env.REAL_TEST_PEY_BANK_ACCOUNT_ID,codiStatus:"PENDING"})),/receiver_unverified/);assert.equal(m.realTestRow(db),undefined);db.close();});
test("signature, timestamp, receiver, key, QR, ref, amount and transaction enforced; duplicate safe",async()=>{
 const db=new DatabaseSync(":memory:");await m.createRealTest(db,"alpha",mock([]));const row=m.realTestRow(db);
 const event={type:"codi.qr.payment_received",amount:0.01,apiKeyId:row.api_key_id,bankAccountId:row.bank_id,codiQrId:row.qr_id,numRef:row.num_ref,transactionId:"01M3QR8H0RH0XBCKYYD242YXNV",datePaid:Math.floor(Date.now()/1000)};
 assert.equal(m.receiveRealTest(db,JSON.stringify(event),new Headers()),401);assert.equal(m.receiveRealTest(db,...signed(event,-301)),401);
 for(const [key,value] of Object.entries({amount:1,currency:"USD",bankAccountId:"other",apiKeyId:"other",codiQrId:"other",numRef:"other",transactionId:"demo_fake",type:"demo_paid",datePaid:0})) {assert.equal(m.receiveRealTest(db,...signed({...event,[key]:value})),422,key);assert.equal(m.realTestRow(db).status,"pending");}
 assert.equal(m.receiveRealTest(db,...signed(event)),200);assert.equal(m.receiveRealTest(db,...signed(event)),200);assert.equal(m.receiveRealTest(db,...signed(event,0,"different")),409);assert.equal(m.publicRealTest(m.realTestRow(db),"alpha").paidConfirmed,true);db.close();
});
test("reject malformed or weak webhook secrets",()=>{const old=process.env.REAL_TEST_PEY_WEBHOOK_SECRET;for(const value of ["x","not base64!",Buffer.from("short").toString("base64"),crypto.randomBytes(23).toString("base64"),crypto.randomBytes(65).toString("base64")]){process.env.REAL_TEST_PEY_WEBHOOK_SECRET=value;assert.equal(m.realTestConfig(),null);}process.env.REAL_TEST_PEY_WEBHOOK_SECRET=old;});
test("signed callback traverses actual Next proxy; payment cross-origin remains forbidden",async()=>{
 process.env.DEMO_MODE="true";process.env.JUDGE_DEMO_ACCOUNTS="true";process.env.OPERATOR_ACCESS_TOKEN="";
 const {proxy}=await import(pathToFileURL(compile("proxy.ts")).href);
 const {NextRequest}=await import("next/server.js");
 const db=new DatabaseSync(":memory:");await m.createRealTest(db,"alpha",mock([]));const row=m.realTestRow(db);
 const event={type:"codi.qr.payment_received",amount:0.01,apiKeyId:row.api_key_id,bankAccountId:row.bank_id,codiQrId:row.qr_id,numRef:row.num_ref,transactionId:"01M3QR8H0RH0XBCKYYD242YXNV",datePaid:Math.floor(Date.now()/1000)};
 const [raw,headers]=signed(event); const request=new NextRequest("https://example.test/api/real-test/webhook",{method:"POST",headers,body:raw});
 const gate=proxy(request);assert.equal(gate.headers.get("x-middleware-next"),"1");
 assert.equal(m.receiveRealTest(db,await request.text(),request.headers),200);
 const foreign=proxy(new NextRequest("https://example.test/api/real-test/payment",{method:"POST",headers:{Origin:"https://evil.test","Sec-Fetch-Site":"cross-site"},body:"{}"}));assert.equal(foreign.status,403);
 const oversized=proxy(new NextRequest("https://example.test/api/real-test/webhook",{method:"POST",headers:{"Content-Length":"65537"},body:"{}"}));assert.equal(oversized.status,413);db.close();
});
test.after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
