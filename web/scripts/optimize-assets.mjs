#!/usr/bin/env node
/**
 * Genera iconos móviles y recomprime las fotos públicas.
 *
 * Uso:
 *   node scripts/optimize-assets.mjs
 *   node scripts/optimize-assets.mjs --check
 *
 * No añade dependencias: usa `sharp`, que Next ya instala para su optimizador
 * de imágenes. Los originales viven en `assets/`; las copias servidas viven en
 * `public/` y se reescriben con dimensiones y calidad aptas para un teléfono
 * de gama baja.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const ICON = path.join(WEB, "assets", "icon.svg");
const CHECK = process.argv.includes("--check");

const PHOTOS = [
  { file: "puesto-flores.jpg", width: 1080, quality: 78 },
  { file: "tianguis-metepequense.jpg", width: 1000, quality: 78 },
  { file: "tianguis-zitacuaro.jpg", width: 900, quality: 78 },
];

let sharp;
try {
  ({ default: sharp } = await import("sharp"));
} catch {
  console.error(
    "No encontré sharp. Corre `npm ci` en web/ (Next lo instala para /_next/image).",
  );
  process.exit(2);
}

function writeIco(pngs, target) {
  // ICO con PNG embebido: cabecera + directorio + datos. Compatible con
  // todos los navegadores modernos y mucho más pequeño que BMP sin comprimir.
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }
  fs.writeFileSync(target, Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]));
}

async function renderIcon(size, { maskable = false } = {}) {
  const svg = fs.readFileSync(ICON);
  const image = sharp(svg, { density: 384 });
  if (maskable) {
    // Zona segura: el arte ocupa el 76 % central; el fondo verde llega al borde.
    const inner = Math.round(size * 0.76);
    const pad = Math.round((size - inner) / 2);
    const art = await sharp(svg, { density: 384 })
      .resize(inner, inner, { fit: "contain" })
      .png()
      .toBuffer();
    return image
      .resize(size, size, { fit: "contain" })
      .composite([{ input: art, top: pad, left: pad }])
      .png({ compressionLevel: 9 })
      .toBuffer();
  }
  return image.resize(size, size, { fit: "contain" }).png({ compressionLevel: 9 }).toBuffer();
}

async function main() {
  if (CHECK) {
    const missing = [
      "src/app/icon.png",
      "src/app/apple-icon.png",
      "src/app/favicon.ico",
      "public/icons/icon-192.png",
      "public/icons/icon-512.png",
      "public/icons/icon-maskable-512.png",
    ].filter((rel) => !fs.existsSync(path.join(WEB, rel)));
    if (missing.length) {
      console.error(`ASSETS FAIL: faltan ${missing.join(", ")}`);
      return 1;
    }
    for (const { file } of PHOTOS) {
      const stat = fs.statSync(path.join(WEB, "public", file));
      console.log(`OK ${file} ${(stat.size / 1024).toFixed(1)} KiB`);
    }
    console.log("ASSETS OK");
    return 0;
  }

  fs.mkdirSync(path.join(WEB, "public", "icons"), { recursive: true });

  const icon512 = await renderIcon(512);
  const icon192 = await renderIcon(192);
  const apple = await renderIcon(180);
  const maskable = await renderIcon(512, { maskable: true });
  const favicon32 = await renderIcon(32);
  const favicon16 = await renderIcon(16);
  const favicon48 = await renderIcon(48);

  fs.writeFileSync(path.join(WEB, "src", "app", "icon.png"), icon512);
  fs.writeFileSync(path.join(WEB, "src", "app", "apple-icon.png"), apple);
  fs.writeFileSync(path.join(WEB, "public", "icons", "icon-192.png"), icon192);
  fs.writeFileSync(path.join(WEB, "public", "icons", "icon-512.png"), icon512);
  fs.writeFileSync(path.join(WEB, "public", "icons", "icon-maskable-512.png"), maskable);
  writeIco(
    [
      { size: 16, data: favicon16 },
      { size: 32, data: favicon32 },
      { size: 48, data: favicon48 },
    ],
    path.join(WEB, "src", "app", "favicon.ico"),
  );

  for (const { file, width, quality } of PHOTOS) {
    const source = path.join(WEB, "public", file);
    const input = fs.readFileSync(source);
    const before = input.length;
    const buffer = await sharp(input)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true, progressive: true, chromaSubsampling: "4:2:0" })
      .toBuffer();
    // Escribir en temporal y renombrar: sharp aún puede tener abierto el origen.
    const temp = `${source}.tmp`;
    fs.writeFileSync(temp, buffer);
    fs.renameSync(temp, source);
    console.log(
      `${file}: ${(before / 1024).toFixed(1)} KiB → ${(buffer.length / 1024).toFixed(1)} KiB`,
    );
  }

  console.log("Iconos y fotos regenerados. Corré `node scripts/perf-budget.mjs`.");
  return 0;
}

process.exitCode = await main();

