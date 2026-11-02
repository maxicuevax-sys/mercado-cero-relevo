import crypto from "node:crypto";

/**
 * Huella canónica del payload de una petición idempotente.
 *
 * El mismo `requestId` solo puede repetirse con el mismo contenido. El hash
 * ignora el orden de las llaves del objeto, pero conserva el orden de los
 * arreglos (por ejemplo, los productos de una venta). Se guarda junto a la
 * llave para distinguir un reintento legítimo de un requestId reutilizado con
 * otro monto o con otros productos.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = canonicalize(record[key]);
    }
    return sorted;
  }
  return value;
}

export function requestPayloadHash(payload: Record<string, unknown>): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(payload)))
    .digest("hex");
}
