import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Contrato de la adopción compacta de Inicio sobre B.1.
 *
 * Congela tres cosas:
 * 1. Las consultas, fórmulas y el fallback demo de `page.tsx` no cambian.
 * 2. Las rutas y capas financieras/shell/Caja/Ventas permanecen intactas.
 * 3. La composición compacta no reintroduce alturas artificiales ni el
 *    breakpoint antiguo de 1340 px.
 *
 * La base es el cierre B.1 (`424fdd2`). Se puede sobreescribir con
 * INICIO_ADOPTION_BASE para auditar otra integración, pero nunca se usa una
 * base móvil como HEAD.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const base =
  process.env.INICIO_ADOPTION_BASE ||
  "424fdd2d197aab550f52244413df7eb8b45414de";
const file = "web/src/app/inicio/page.tsx";
const before = execFileSync("git", ["show", `${base}:${file}`], {
  cwd: root,
  encoding: "utf8",
}).replaceAll("\r\n", "\n");
const after = readFileSync(path.join(root, file), "utf8").replaceAll("\r\n", "\n");

assert.equal(
  after.split("  return (")[0],
  before.split("  return (")[0],
  "Imports, queries, financial formulas and demo fallback must stay identical",
);

const links = (text) =>
  [...text.matchAll(/(?:href|activeHref|mainId)="([^"]+)"/g)].map((m) => m[0]);
assert.deepEqual(
  links(after),
  links(before),
  "No route, action or main id may change",
);

assert.ok(
  after.includes('className="inicio-shell--compact"'),
  "The compact scope must be declared on AppShell",
);
assert.ok(
  after.indexOf('className="inicio-picado"') > after.indexOf('className="inicio-greeting"'),
  "Papel picado must live inside the greeting, not above the content",
);

const css = readFileSync(path.join(root, "web/src/app/inicio/inicio.css"), "utf8");
assert.ok(
  css.includes("@container inicio-main (min-width: 52rem)"),
  "The compact layout must use the real content container",
);
assert.ok(
  !css.includes("min-height: 196px"),
  "The old artificial KPI height must not return",
);
const shellBreakpoint =
  css.match(/@media \(max-width: 1340px\) \{[\s\S]*?\n\}/)?.[0] ?? "";
assert.ok(
  !shellBreakpoint.includes(".inicio-kpis"),
  "The 1340 px breakpoint may only resize the shell, never the KPI grid",
);
assert.ok(
  css.includes(".inicio-shell--compact .inicio-content"),
  "The compact scope must reach the real content layer",
);
assert.ok(
  css.includes("overflow-wrap: anywhere"),
  "Long amounts must reflow instead of overflowing",
);

const protectedPaths = [
  "web/src/lib",
  "web/src/app/api",
  "web/src/app/pay",
  "web/src/components/shell",
  "web/src/components/caja",
  "web/src/app/ventas",
];
const financialDiff = execFileSync(
  "git",
  ["diff", "--name-only", base, "--", ...protectedPaths],
  { cwd: root, encoding: "utf8" },
).trim();
assert.equal(
  financialDiff,
  "",
  "Financial code, shared shell, Caja and Ventas remain untouched",
);

console.log(
  "INICIO ADOPTION CONTRACT OK: datos, rutas y capas protegidas sin cambios.",
);
