#!/usr/bin/env node
/**
 * Genera una tabla Markdown desde harness/evidence/latest.json.
 *
 * Uso:
 *   npm run harness:report
 *   node scripts/harness-report.mjs --json
 *
 * Es de solo lectura. La tabla incluye el SHA, el buildSha servido, el
 * estado de cada gate, los artefactos y los gates no ejecutados. Copiar esta
 * tabla a STATE.md evita que los docs cuenten un verde que la evidencia no
 * sostiene.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const LATEST = path.join(ROOT, "harness", "evidence", "latest.json");
const LATEST_STATIC = path.join(
  ROOT,
  "harness",
  "evidence",
  "latest-static.json",
);
const FILE = fs.existsSync(LATEST)
  ? LATEST
  : fs.existsSync(LATEST_STATIC)
    ? LATEST_STATIC
    : LATEST;

if (!fs.existsSync(FILE)) {
  console.error(
    "No hay harness/evidence/latest.json ni latest-static.json. Corre verify:full o verify:static.",
  );
  process.exit(1);
}

const evidence = JSON.parse(fs.readFileSync(FILE, "utf8"));

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(evidence, null, 2));
  process.exit(0);
}

const short = (value) => String(value ?? "?").slice(0, 7);
const yesNo = (value) => (value ? "sí" : "no");
// Evidence is data, even inside inline code. Encode in one pass so a literal
// entity, backslash or backtick cannot reopen Markdown/HTML syntax. Show control
// characters explicitly instead of letting them create rows or spoof log text.
const text = (value) => String(value ?? "?").replace(
  /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}&<>"'`\\|*_[\]{}()#!+~=\-]/gu,
  (character) => {
    if (character === "\r") return "&#92;r";
    if (character === "\n") return "&#92;n";
    if (character === "\t") return "&#92;t";
    if (/^[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]$/u.test(character)) {
      return `&#92;u${character.codePointAt(0).toString(16).padStart(4, "0")}`;
    }
    return `&#${character.codePointAt(0)};`;
  },
);
const code = (value) => `<code>${text(value)}</code>`;

console.log(
  `<!-- generado por npm run harness:report; no editar a mano -->\n` +
    `**Corrida:** ${text(evidence.mode)}${evidence.partial ? " (partial)" : ""} · ` +
    `ok:${yesNo(evidence.ok)} · complete:${yesNo(evidence.complete)} · ` +
    `build:${yesNo(evidence.buildBound)}\n\n` +
    `- SHA: ${code(evidence.gitAtStart?.sha)} (${text(evidence.gitAtStart?.branch)})\n` +
    `- Build servido: ${code(evidence.serverBuildSha)} (${text(short(evidence.serverBuildSha))})\n` +
    `- Árbol: inicio dirty:${text(evidence.gitAtStart?.dirty)} · fin dirty:${text(evidence.gitAtEnd?.dirty)}\n` +
    `- Inicio: ${text(evidence.startedAt)}\n` +
    `- Fin: ${text(evidence.endedAt)}\n` +
    `- Base: ${text(evidence.baseUrl)}\n` +
    `- Nodo: ${text(evidence.node)} · OS: ${text(evidence.os)}\n`,
);

console.log("| Gate | Estado | Exit | Expected | ms | Artefactos |");
console.log("|---|---|---:|---|---:|---|");

for (const gate of evidence.gates ?? []) {
  const artifacts = (gate.artifacts ?? [])
    .map((artifact) => (artifact.exists ? code(artifact.path) : `FALTA ${code(artifact.path)}`))
    .join("<br>");
  console.log(
    `| ${code(gate.id)} | ${gate.ok ? "PASS" : "FAIL"} | ${text(gate.exitCode)} | ${text(
      Array.isArray(gate.expected) ? gate.expected.join(" + ") : gate.expected ?? "—",
    )} | ${text(gate.durationMs)} | ${artifacts || "—"} |`,
  );
}

if ((evidence.notRun ?? []).length) {
  console.log("\n**No ejecutados:**");
  for (const id of evidence.notRun) {
    console.log(`- ${code(id)}: ${text(evidence.notRunReasons?.[id] ?? "sin razón")}`);
  }
}

if ((evidence.reasons ?? []).length) {
  console.log("\n**Razones del veredicto:**");
  for (const reason of evidence.reasons) console.log(`- ${text(reason)}`);
}

if (evidence.error) console.log(`\n**Error:** ${text(evidence.error)}`);
