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

console.log(
  `<!-- generado por npm run harness:report; no editar a mano -->\n` +
    `**Corrida:** ${evidence.mode}${evidence.partial ? " (partial)" : ""} · ` +
    `ok:${yesNo(evidence.ok)} · complete:${yesNo(evidence.complete)} · ` +
    `build:${yesNo(evidence.buildBound)}\n\n` +
    `- SHA: \`${evidence.gitAtStart?.sha ?? "?"}\` (${evidence.gitAtStart?.branch ?? "?"})\n` +
    `- Build servido: \`${evidence.serverBuildSha ?? "?"}\` (${short(evidence.serverBuildSha)})\n` +
    `- Árbol: inicio dirty:${evidence.gitAtStart?.dirty} · fin dirty:${evidence.gitAtEnd?.dirty}\n` +
    `- Inicio: ${evidence.startedAt}\n` +
    `- Fin: ${evidence.endedAt}\n` +
    `- Base: ${evidence.baseUrl}\n` +
    `- Nodo: ${evidence.node} · OS: ${evidence.os}\n`,
);

console.log("| Gate | Estado | Exit | Expected | ms | Artefactos |");
console.log("|---|---|---:|---|---:|---|");

for (const gate of evidence.gates ?? []) {
  const artifacts = (gate.artifacts ?? [])
    .map((artifact) => (artifact.exists ? `\`${artifact.path}\`` : `FALTA \`${artifact.path}\``))
    .join("<br>");
  console.log(
    `| \`${gate.id}\` | ${gate.ok ? "PASS" : "FAIL"} | ${gate.exitCode} | ${String(
      Array.isArray(gate.expected) ? gate.expected.join(" + ") : gate.expected ?? "—",
    ).replace(/\|/g, "\\|")} | ${gate.durationMs} | ${artifacts || "—"} |`,
  );
}

if ((evidence.notRun ?? []).length) {
  console.log("\n**No ejecutados:**");
  for (const id of evidence.notRun) {
    console.log(`- \`${id}\`: ${evidence.notRunReasons?.[id] ?? "sin razón"}`);
  }
}

if ((evidence.reasons ?? []).length) {
  console.log("\n**Razones del veredicto:**");
  for (const reason of evidence.reasons) console.log(`- ${reason}`);
}

if (evidence.error) console.log(`\n**Error:** ${evidence.error}`);
