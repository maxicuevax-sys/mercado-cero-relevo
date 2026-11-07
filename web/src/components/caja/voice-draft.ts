import { parseMoneyCents, parseQuantity, type DraftLine } from "./types";

/** Adaptar el parser existente al ticket editable; nunca aceptar una operación de cobro. */
export function voiceDraft(value: unknown): Array<Omit<DraftLine, "id">> {
  if (!value || typeof value !== "object" || !("intent" in value) || value.intent !== "sale" ||
      !("items" in value) || !Array.isArray(value.items) || !value.items.length || value.items.length > 50) {
    throw new Error("Describe una venta con productos y precios. No se registró ninguna operación.");
  }
  let total = 0;
  return value.items.map((item: unknown) => {
    if (!item || typeof item !== "object" || !("description" in item) ||
        typeof item.description !== "string" || !item.description.trim() || item.description.trim().length > 160 ||
        !("quantity" in item) || typeof item.quantity !== "number" ||
        !Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 999 ||
        parseQuantity(String(item.quantity)) !== item.quantity ||
        !("unitPriceCents" in item) || typeof item.unitPriceCents !== "number" ||
        !Number.isSafeInteger(item.unitPriceCents) || item.unitPriceCents < 0 || item.unitPriceCents > 10_000_000) {
      throw new Error("No pude leer todos los conceptos con seguridad. Revisa la frase o agrégalos a mano.");
    }
    total += Math.round(item.quantity * item.unitPriceCents);
    if (!Number.isSafeInteger(total) || total > 100_000_000) throw new Error("El importe está fuera del rango permitido.");
    const price = (item.unitPriceCents / 100).toFixed(2);
    if (parseMoneyCents(price) !== item.unitPriceCents) throw new Error("El precio no se puede representar con seguridad.");
    return { description: item.description.trim(), quantity: String(item.quantity), price };
  });
}
