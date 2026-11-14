import { namesMatch } from "./pulso-apply";
import { mockParse } from "./voice-local";

/**
 * La frase solo se vuelve conceptos. No decide efectivo, fiado, pago ni inventario.
 */

export interface PhraseItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface PhraseProduct {
  name: string;
  priceCents: number;
}

export type PhraseOrder =
  | { ok: true; items: PhraseItem[] }
  | { ok: false; reply: string };

export function itemsFromPhrase(phrase: string, products: PhraseProduct[]): PhraseOrder {
  const parsed = mockParse(phrase);
  if (parsed.intent !== "sale" || parsed.items.length === 0) {
    return { ok: false, reply: parsed.reply || "No entendí el pedido." };
  }

  const items: PhraseItem[] = [];
  for (const item of parsed.items) {
    const quantity = Math.round(Number(item.quantity));
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 999) continue;
    const product = products.find((candidate) => namesMatch(item.description, candidate.name));
    const unitPriceCents = product?.priceCents ?? Math.round(Number(item.unitPriceCents));
    if (!Number.isFinite(unitPriceCents) || unitPriceCents <= 0) continue;
    items.push({
      description: product?.name ?? item.description,
      quantity,
      unitPriceCents,
    });
  }

  if (items.length === 0) {
    return { ok: false, reply: "No reconocí productos del puesto en esa frase." };
  }
  return { ok: true, items };
}
