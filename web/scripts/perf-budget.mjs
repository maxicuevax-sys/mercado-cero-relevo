#!/usr/bin/env node
/**
 * Presupuesto de performance para el teléfono de gama baja.
 *
 * Uso:
 *   npm run build
 *   npm run test:perf-budget
 *   node scripts/perf-budget.mjs --json
 *
 * Mide lo que el navegador descarga al abrir `/` en producción:
 *   - JS inicial (scripts del HTML, sin el polyfill `nomodule`)
 *   - CSS crítico
 *   - fuentes latin realmente precargadas por next/font
 *   - peso de los assets públicos (fotos, iconos)
 *
 * Los números se eligen para un Android Go / Moto E con 2 GB de RAM:
 * el costo dominante no es solo la red, es parsear e hidratar JavaScript.
 *
 * Presupuestos (gzip salvo fuentes, que ya son woff2):
 *   JS inicial        ≤ 200 KiB  (7–8 chunks; 1,4 s de CPU a 4× en Slow 3G)
 *   CSS inicial       ≤  16 KiB
 *   Fuentes latin     ≤  65 KiB  (2 archivos: Manrope variable + Fraunces)
 *   Total inicial     ≤ 285 KiB  (HTML + JS + CSS + fuentes)
 *   Peticiones        ≤  12      (sin contar APIs de datos)
 *   Foto más pesada   ≤ 200 KiB  (fuente para next/image, no la respuesta optimizada)
 *   Fotos públicas    ≤ 400 KiB  (todas juntas)
 *   Iconos móviles    ≤  40 KiB  (manifest + apple + favicon)
 *   Favicon           ≤   8 KiB
 *
 * El baseline medido en 76ce5ee fue: JS 191.6 KiB, CSS 12.3 KiB, fuentes
 * 61.0 KiB, total 264.9 KiB, 10 peticiones. Las fotos públicas pesaban
 * 1.52 MiB y el favicon 15 KiB.
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const NEXT = path.join(WEB, ".next");
const HTML = path.join(NEXT, "server", "app", "index.html");
const JSON_MODE = process.argv.includes("--json");

const BUDGET = {
  jsGzip: 200 * 1024,
  cssGzip: 16 * 1024,
  fonts: 65 * 1024,
  totalInitial: 285 * 1024,
  requests: 12,
  maxPhoto: 200 * 1024,
  totalPhotos: 400 * 1024,
  icons: 40 * 1024,
  favicon: 8 * 1024,
};

function gzipSize(buffer) {
  return zlib.gzipSync(buffer, { level: 9 }).length;
}

function fail(message) {
  console.error(`PERF BUDGET FAIL: ${message}`);
  process.exitCode = 1;
}

function toStaticPath(url) {
  const clean = url.split("?")[0];
  if (!clean.startsWith("/_next/")) throw new Error(`URL inesperada: ${url}`);
  return path.join(NEXT, clean.replace("/_next/", ""));
}

function readHtml() {
  if (!fs.existsSync(HTML)) return null;
  const html = fs.readFileSync(HTML, "utf8");
  // Con Cache Components, una ruta que bloquea para leer datos vivos puede
  // producir un `index.html` vacío. En ese caso medimos los manifests del
  // build, que son la misma lista de chunks que sirve `next start`.
  return html.length > 0 ? html : null;
}

function withNextPrefix(value) {
  return value.startsWith("/_next/") ? value : `/_next/${value.replace(/^\/+/, "")}`;
}

/**
 * Fallback para rutas dinámicas: el HTML prerenderizado no tiene scripts
 * porque el request se renderiza completo. `build-manifest.json` aporta los
 * chunks raíz y `page_client-reference-manifest.js` los de la página.
 */
function assetsFromManifests() {
  const buildManifest = JSON.parse(
    fs.readFileSync(path.join(NEXT, "build-manifest.json"), "utf8"),
  );
  const clientManifestPath = path.join(
    NEXT,
    "server",
    "app",
    "page_client-reference-manifest.js",
  );
  const source = fs.readFileSync(clientManifestPath, "utf8");
  const sandbox = { globalThis: {} };
  vm.runInNewContext(source, sandbox, { timeout: 1000 });
  const manifest = sandbox.globalThis.__RSC_MANIFEST?.["/page"];
  if (!manifest) throw new Error("El manifest del cliente no trae /page.");
  const entry = manifest.entryJSFiles?.["[project]/src/app/page"] ?? [];
  const css = (manifest.entryCSSFiles?.["[project]/src/app/page"] ?? []).map(
    (item) => withNextPrefix(item.path),
  );
  const scripts = [
    ...(buildManifest.rootMainFiles ?? []),
    ...entry,
  ].map(withNextPrefix);
  return {
    scripts: [...new Set(scripts)],
    styles: [...new Set(css)],
  };
}

function initialAssets(html) {
  const scriptTags = [...html.matchAll(/<script[^>]*src="([^"]+)"[^>]*>/g)];
  const scripts = [
    ...new Set(
      scriptTags
        .filter((match) => !/nomodule/i.test(match[0]))
        .map((match) => match[1])
        .filter((src) => src.startsWith("/_next/")),
    ),
  ];
  const styles = [
    ...new Set(
      [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(
        (match) => match[1],
      ),
    ),
  ];
  return { scripts, styles };
}

function latinFonts(cssText) {
  const files = new Set();
  for (const block of cssText.matchAll(/@font-face\{([^}]+)\}/g)) {
    const body = block[1];
    // El bloque latin es el único con el rango comodín `U+??`; los demás son
    // subconjuntos cirílico/griego/vietnamita que el navegador no descarga.
    if (!/unicode-range:U\+\?\?/.test(body)) continue;
    const url = body.match(/url\(([^)]+)\)/);
    if (url) files.add(url[1].replace("../media/", ""));
  }
  return [...files];
}

function publicRasters() {
  const roots = [
    path.join(WEB, "public"),
    path.join(WEB, "src", "app"),
  ];
  const out = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root, { recursive: true })) {
      const file = path.join(root, entry);
      if (!fs.statSync(file).isFile()) continue;
      if (!/\.(jpe?g|png|webp|avif|ico)$/i.test(file)) continue;
      out.push({
        file: path.relative(WEB, file).replaceAll("\\", "/"),
        bytes: fs.statSync(file).size,
      });
    }
  }
  return out.sort((a, b) => b.bytes - a.bytes);
}

function fmt(kib) {
  return `${(kib / 1024).toFixed(1)} KiB`;
}

function main() {
  let assets;
  let source;
  try {
    const html = readHtml();
    if (html) {
      assets = initialAssets(html);
      source = "html";
    } else {
      assets = assetsFromManifests();
      source = "manifests";
    }
  } catch (error) {
    fail(
      `No hay build medible. Corre \`npm run build\` antes del presupuesto. ${
        error.message ?? ""
      }`.trim(),
    );
    return;
  }

  const { scripts, styles } = assets;
  const js = scripts.map((src) => {
    const buffer = fs.readFileSync(toStaticPath(src));
    return { url: src, raw: buffer.length, gzip: gzipSize(buffer) };
  });
  const css = styles.map((href) => {
    const buffer = fs.readFileSync(toStaticPath(href));
    return { url: href, raw: buffer.length, gzip: gzipSize(buffer), text: buffer.toString("utf8") };
  });

  const fonts = [];
  for (const sheet of css) {
    for (const name of latinFonts(sheet.text)) {
      const buffer = fs.readFileSync(path.join(NEXT, "static", "media", name));
      fonts.push({ file: name, bytes: buffer.length });
    }
  }

  const rasters = publicRasters();
  const photos = rasters.filter((item) => /\.(jpe?g|webp|avif)$/i.test(item.file));
  const icons = rasters.filter((item) => /\.(png|ico)$/i.test(item.file));
  const favicon = rasters.find((item) => item.file.endsWith("favicon.ico"));
  const totals = {
    jsGzip: js.reduce((sum, item) => sum + item.gzip, 0),
    jsRaw: js.reduce((sum, item) => sum + item.raw, 0),
    cssGzip: css.reduce((sum, item) => sum + item.gzip, 0),
    fonts: fonts.reduce((sum, item) => sum + item.bytes, 0),
    requests: scripts.length + styles.length + fonts.length,
  };
  totals.initial = totals.jsGzip + totals.cssGzip + totals.fonts;
  const biggestPhoto = photos[0]?.bytes ?? 0;
  const totalPhotos = photos.reduce((sum, item) => sum + item.bytes, 0);
  const totalIcons = icons.reduce((sum, item) => sum + item.bytes, 0);

  const checks = [
    ["JS inicial (gzip)", totals.jsGzip, BUDGET.jsGzip, "bytes"],
    ["CSS inicial (gzip)", totals.cssGzip, BUDGET.cssGzip, "bytes"],
    ["Fuentes latin", totals.fonts, BUDGET.fonts, "bytes"],
    ["Total inicial", totals.initial, BUDGET.totalInitial, "bytes"],
    ["Peticiones iniciales", totals.requests, BUDGET.requests, "count"],
    ["Foto más pesada", biggestPhoto, BUDGET.maxPhoto, "bytes"],
    ["Fotos públicas", totalPhotos, BUDGET.totalPhotos, "bytes"],
    ["Iconos móviles", totalIcons, BUDGET.icons, "bytes"],
    ["Favicon", favicon?.bytes ?? 0, BUDGET.favicon, "bytes"],
  ];
  const failures = checks.filter(([, actual, limit]) => actual > limit);

  if (JSON_MODE) {
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          source,
          budget: BUDGET,
          totals,
          chunks: js,
          css: css.map((sheet) => ({
            url: sheet.url,
            raw: sheet.raw,
            gzip: sheet.gzip,
          })),
          fonts,
          photos,
          icons,
          checks: checks.map(([name, actual, limit, unit]) => ({
            name,
            actual,
            limit,
            unit,
            ok: actual <= limit,
          })),
          ok: failures.length === 0,
        },
        null,
        2,
      ),
    );
    if (failures.length) process.exitCode = 1;
    return;
  }

  console.log("Perf budget — build de producción\n");
  console.log(`  JS inicial   ${fmt(totals.jsGzip)} gzip (${fmt(totals.jsRaw)} crudo, ${js.length} chunks)`);
  for (const item of [...js].sort((a, b) => b.gzip - a.gzip)) {
    console.log(`    ${fmt(item.gzip).padStart(11)}  ${item.url}`);
  }
  console.log(`  CSS inicial  ${fmt(totals.cssGzip)} gzip`);
  console.log(`  Fuentes      ${fmt(totals.fonts)} (${fonts.length})`);
  for (const item of fonts) console.log(`    ${fmt(item.bytes).padStart(11)}  ${item.file}`);
  console.log(`  Total        ${fmt(totals.initial)} · ${totals.requests} peticiones`);
  console.log(`  Foto mayor   ${fmt(biggestPhoto)}  ${photos[0]?.file ?? ""}`);
  console.log(`  Fotos        ${fmt(totalPhotos)} (${photos.length} archivos)`);
  console.log(`  Iconos       ${fmt(totalIcons)} (${icons.length} archivos)`);
  console.log(`  Favicon      ${fmt(favicon?.bytes ?? 0)}`);

  console.log("\nPresupuesto:");
  for (const [name, actual, limit, unit] of checks) {
    const ok = actual <= limit;
    const pct = ((actual / limit) * 100).toFixed(0);
    const show = (value) => (unit === "count" ? String(value) : fmt(value));
    console.log(
      `  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(22)} ${show(actual).padStart(10)} / ${show(limit).padStart(10)}  (${pct}%)`,
    );
  }

  if (failures.length) {
    fail(`${failures.length} métrica(s) fuera de presupuesto.`);
    return;
  }
  console.log("\nPERF BUDGET OK");
}

main();
