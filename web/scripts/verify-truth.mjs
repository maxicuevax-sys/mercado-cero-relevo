#!/usr/bin/env node
/**
 * Verdad del comprobante: un pago demo nunca debe verificarse.
 *
 * Uso:
 *   node scripts/verify-truth.mjs
 *
 * Solo lee la base y llama a /api/verify. No imprime secretos.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DB_PATH = path.join(ROOT, "data", "mercado-cero.db");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const db = new DatabaseSync(DB_PATH, { readOnly: true });
const demo = db
  .prepare(
    "SELECT transaction_id FROM payments WHERE provider = 'demo' AND transaction_id IS NOT NULL LIMIT 1",
  )
  .get();

if (!demo?.transaction_id) {
  console.error("FALLA: no hay un pago demo con transactionId para probar.");
  process.exit(1);
}

const response = await fetch(
  `${BASE}/api/verify?transactionId=${encodeURIComponent(demo.transaction_id)}`,
);
const body = await response.json();

if (!response.ok) {
  console.error(`FALLA: /api/verify respondió ${response.status}`);
  process.exit(1);
}

if (body.verified !== false) {
  console.error(
    `FALLA: el comprobante demo ${demo.transaction_id} se reportó como verificado.`,
  );
  process.exit(1);
}

console.log(`PASS  comprobante demo no verificado — ${demo.transaction_id}`);
console.log(`PASS  respuesta: ${body.message ?? body.reason ?? "sin detalle"}`);
console.log("VERDAD OK: los pagos demo no pasan como verificados.");
