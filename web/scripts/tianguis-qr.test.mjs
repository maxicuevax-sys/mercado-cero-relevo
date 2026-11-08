import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { tianguisQrSvg } from "../src/lib/tianguis-qr.ts";

const evidence = path.resolve("../harness/evidence/runs/tianguis-qr", new Date().toISOString().replaceAll(":", "-"));
const payloads = [
  "https://trangui.example/pay/demo-order-17?demo=1",
  "https://trangui.example/pay/order-29?reference=ABC123&amount=123.45",
  // Synthetic provider-shaped text only: not a real CoDi payment request.
  "CODI_TEST_ONLY|ref=83|amount=345.67|concept=Fruta México",
];

test("procedural roofs are deterministic and preserve exact payloads in two independent decoders", async () => {
  fs.mkdirSync(evidence, { recursive: true });
  const inputs = [];
  for (const [index, payload] of payloads.entries()) {
    const svg = tianguisQrSvg(payload);
    assert.equal(svg, tianguisQrSvg(payload));
    assert.ok(!svg.includes("xn--hw9h"));
    fs.writeFileSync(path.join(evidence, `fixture-${index}.svg`), svg);
    for (const size of [180, 236, 320]) {
      const file = path.join(evidence, `fixture-${index}-${size}.png`);
      await sharp(Buffer.from(svg)).resize(size, size).png().toFile(file);
      inputs.push({ file, payload, size });
    }
  }
  const python = String.raw`
import sys,json,hashlib
from PIL import Image
import numpy as np,zxingcpp,cv2
rows=[]
for case in json.loads(sys.stdin.buffer.read().decode('utf-8')):
    arr=np.asarray(Image.open(case['file']).convert('RGB'))
    expected=case['payload'].encode('utf-8')
    zx=zxingcpp.read_barcodes(arr)
    text,_,_=cv2.QRCodeDetector().detectAndDecode(arr)
    row={'file':case['file'],'size':case['size'],'zxingExact':any(r.bytes==expected for r in zx),'opencvExact':text.encode('utf-8')==expected,'payloadSha256':hashlib.sha256(expected).hexdigest()}
    rows.append(row)
print(json.dumps(rows))
sys.exit(0 if all(r['zxingExact'] and r['opencvExact'] for r in rows) else 1)
`;
  const result = spawnSync("python", ["-c", python], { input: JSON.stringify(inputs), encoding: "utf8" });
  fs.writeFileSync(path.join(evidence, "decoders.json"), result.stdout || result.stderr);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(JSON.parse(result.stdout).length, 9);
  console.log(`QR evidence: ${evidence}`);
});

test("empty payload fails instead of displaying a decorative substitute", () => {
  assert.throws(() => tianguisQrSvg(""));
});

test("dense provider payload retains the original instead of generating unreadable art", () => {
  assert.throws(() => tianguisQrSvg("PROVIDER_TEST_ONLY|" + "ab12CD34".repeat(40)), /too dense/);
});
