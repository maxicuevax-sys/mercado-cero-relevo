#!/usr/bin/env node
/**
 * Genera un QR imprimible para abrir la demo desde el teléfono.
 *
 * Uso:
 *   node scripts/make-demo-qr.mjs
 *
 * Lee APP_URL de .env.local. Si el túnel cambia, vuelve a correrlo.
 * No imprime secretos.
 */

import fs from "node:fs";
import path from "node:path";
import QRCode from "qrcode";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "..", "demo");
fs.mkdirSync(OUT, { recursive: true });

function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  const values = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equals = trimmed.indexOf("=");
    if (equals === -1) continue;
    values[trimmed.slice(0, equals).trim()] = trimmed.slice(equals + 1).trim();
  }
  return values;
}

const env = loadEnv(path.join(ROOT, ".env.local"));
const url = (process.env.APP_URL ?? env.APP_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  "",
);

if (!url.startsWith("https://")) {
  console.error("APP_URL debe ser HTTPS para que el QR funcione en un teléfono.");
  process.exit(1);
}

const pngPath = path.join(OUT, "qr-demo.png");
const svgPath = path.join(OUT, "qr-demo.svg");
const htmlPath = path.join(OUT, "qr-demo.html");

await QRCode.toFile(pngPath, url, {
  width: 1200,
  margin: 2,
  errorCorrectionLevel: "H",
  color: { dark: "#0b5a43", light: "#f3eee5" },
});
await QRCode.toFile(svgPath, url, {
  width: 1200,
  margin: 2,
  errorCorrectionLevel: "H",
  color: { dark: "#0b5a43", light: "#f3eee5" },
});

const dataUrl = await QRCode.toDataURL(url, {
  width: 1200,
  margin: 2,
  errorCorrectionLevel: "H",
  color: { dark: "#0b5a43", light: "#f3eee5" },
});

const html = `<!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8" />
<title>Mercado Cero · QR de demo</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #f3eee5;
    color: #1b241f;
    font-family: "DM Sans", system-ui, sans-serif;
    display: grid;
    place-items: center;
    min-height: 100vh;
    padding: 22mm;
  }
  .card {
    width: 100%;
    border: 2px solid #0b5a43;
    padding: 14mm;
    text-align: center;
    background: #fbf8f1;
  }
  .brand { display: flex; align-items: center; justify-content: center; gap: 10px; }
  .mark {
    width: 42px; height: 42px; display: grid; place-items: center;
    background: #0b5a43; color: #f3eee5; font-weight: 800; font-size: 24px;
  }
  h1 { font-family: Georgia, serif; font-size: 34px; margin: 8px 0 0; letter-spacing: -0.02em; }
  .kicker { font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: #5f6b63; margin-top: 4px; }
  img { width: 112mm; height: 112mm; margin: 10mm auto 6mm; display: block; image-rendering: pixelated; }
  .stamp {
    display: inline-block; border: 2px solid #9e4529; color: #9e4529;
    padding: 4px 14px; transform: rotate(-4deg); font-weight: 800;
    letter-spacing: .08em; text-transform: uppercase; font-size: 13px;
  }
  p { font-size: 15px; line-height: 1.45; color: #3d4a43; margin: 8px 0 0; }
  .url { font-size: 11px; color: #5f6b63; margin-top: 8px; word-break: break-all; }
  .foot { margin-top: 10mm; font-size: 11px; color: #5f6b63; }
</style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <div class="mark">0</div>
      <div style="text-align:left">
        <div style="font-family:Georgia,serif;font-size:26px;line-height:1">Mercado Cero</div>
        <div class="kicker">La caja que habla</div>
      </div>
    </div>
    <h1>Abre la caja en tu teléfono</h1>
    <div class="stamp">Modo demo</div>
    <img src="${dataUrl}" alt="QR para abrir Mercado Cero" />
    <p>Escanea con la cámara. Es la misma caja que ve la comerciante: ventas, cobros, fiado, corte y metas.</p>
    <p class="url">${url}</p>
    <div class="foot">Prototipo DevDay Exchange CDMX 2026 · pey + OpenAI · datos de demostración</div>
  </div>
</body>
</html>`;

fs.writeFileSync(htmlPath, html, "utf8");

console.log(`URL: ${url}`);
console.log(`QR:  ${pngPath}`);
console.log(`SVG: ${svgPath}`);
console.log(`HTML: ${htmlPath}`);
console.log("PDF: corre `python scripts/print-qr-pdf.py` después de generar el HTML.");
