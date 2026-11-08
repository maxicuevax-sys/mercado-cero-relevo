// Parser local puro: sin OpenAI y seguro para pruebas Node.

import type { ParsedSale } from "./types";

export const CATALOG = [
  { name: "Quesadilla", priceCents: 3500 },
  { name: "Agua", priceCents: 2000 },
  { name: "Refresco", priceCents: 2200 },
  { name: "Atole", priceCents: 2500 },
  { name: "Taco", priceCents: 1800 },
  { name: "Tortilla (kilo)", priceCents: 2500 },
  { name: "Pan", priceCents: 800 },
  { name: "Café", priceCents: 1500 },
  { name: "Jugo", priceCents: 1800 },
  { name: "Elote", priceCents: 2000 },
  { name: "Tamal", priceCents: 2200 },
  { name: "Sope", priceCents: 2500 },
];

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  quince: 15,
  veinte: 20,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  cien: 100,
};

function parseNumber(raw: string | undefined): number {
  if (!raw) return 1;
  const normalized = raw.toLowerCase().trim();
  if (NUMBER_WORDS[normalized]) return NUMBER_WORDS[normalized];
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 1;
}

function catalogPrice(name: string): number {
  const normalized = name.toLowerCase();
  const found = CATALOG.find((item) => normalized.includes(item.name.toLowerCase().split(" ")[0]));
  return found?.priceCents ?? 0;
}

function detectCreditMethod(text: string): ParsedSale["creditMethod"] {
  if (/(transfer|transfir|dep[oó]sit|codi|digital)/.test(text)) return "codi";
  if (/(tarjeta|d[eé]bito|cr[eé]dito)/.test(text)) return "card";
  if (/(efectivo|billetes?)/.test(text)) return "cash";
  return null;
}

const PAYMENT_VERB_RE =
  /(me pag[oó]|abon[oó]|liquid[oó]|transfir[ií][oó]|transfiri[oó]|deposit[oó])/;
const TRANSFER_VERB_RE = /(transfir[ií][oó]|transfiri[oó]|deposit[oó])/;
const CREDIT_SIGNAL_RE = /(fiado|debe|deuda)/;
const NON_NAME_START = new Set([
  "un",
  "una",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "la",
  "el",
  "los",
  "las",
  "mi",
  "mis",
  "su",
  "sus",
  "hoy",
  "ayer",
  "cliente",
  "clientes",
]);

/**
 * Reconoce "Juan me pagó/transfirió…" sin exigir la palabra "fiado".
 * Evita que una venta ("dos quesadillas, me pagó 100") caiga en abono.
 */
function startsWithCustomerName(text: string): boolean {
  const match = text.match(
    /^\s*([a-záéíóúñü]+(?:\s+[a-záéíóúñü]+)?)\s+me\s+(?:pag|abon|liquid|transfi|deposit)/i,
  );
  if (!match) return false;
  const first = match[1].trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  return Boolean(first) && !NON_NAME_START.has(first);
}

function looksLikeCreditPayment(text: string): boolean {
  // Frase fija del WAV de Kokoro: "Abono de 50 pesos a Juan, saldo 0 pesos."
  // No trae verbo conjugado ("me pagó"), pero sí intención explícita de abono.
  if (/^\s*abono\b/i.test(text)) return true;
  if (!PAYMENT_VERB_RE.test(text)) return false;
  return (
    CREDIT_SIGNAL_RE.test(text) ||
    TRANSFER_VERB_RE.test(text) ||
    startsWithCustomerName(text)
  );
}

/**
 * Parser local para que la demo funcione sin OPENAI_API_KEY.
 * No pretende ser perfecto: cubre las frases del guion y vocabulario de tienda.
 */
export function mockParse(transcript: string): ParsedSale {
  const text = transcript.toLowerCase();

  if (
    /(cu[aá]ntos? (me )?debe(n)?|qui[eé]n(?:es)? me debe(n)?|cu[aá]nto me deben)/.test(
      text,
    )
  ) {
    return {
      intent: "query",
      items: [],
      cashCents: 0,
      customerName: null,
      creditCents: 0,
      creditMethod: null,
      query: transcript,
      confidence: 0.9,
      reply: "Reviso lo que te deben.",
    };
  }

  if (/(cu[aá]nto vend[ií]|corte|cuenta del d[ií]a|resumen)/.test(text)) {
    return {
      intent: "query",
      items: [],
      cashCents: 0,
      customerName: null,
      creditCents: 0,
      creditMethod: null,
      query: transcript,
      confidence: 0.9,
      reply: "Te doy el corte del día.",
    };
  }

  if (looksLikeCreditPayment(text)) {
    const nameMatch = text.match(/(?:^|\s)(?:que|a|de)\s+([a-záéíóúñ]+)/);
    const amountMatch = text.match(/(\d+(?:\.\d+)?)/);
    const amount = amountMatch ? Math.round(Number(amountMatch[1]) * 100) : 0;
    return {
      intent: "credit_payment",
      items: [],
      cashCents: 0,
      customerName: nameMatch ? capitalize(nameMatch[1]) : null,
      creditCents: amount,
      creditMethod: detectCreditMethod(text),
      query: null,
      confidence: 0.8,
      reply: amount > 0 ? `Abono de ${amount / 100} pesos registrado.` : "¿De cuánto fue el abono?",
    };
  }

  const ordered: Array<{ index: number; item: ParsedSale["items"][number] }> = [];
  // Match explicit prices first so units and multiword names offered by the UI
  // ("1 kilo de jitomate a 30 pesos") are not reduced to "1 kilo".
  const explicitRegex = /\b(\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce|quince|veinte)\s+([a-záéíóúñ]+(?:\s+(?!(?:y|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce|quince|veinte)\b)[a-záéíóúñ]+)*?)\s+(?:de|a)\s+\$?(\d+(?:\.\d+)?)/gi;
  let remaining = text;
  let explicit: RegExpExecArray | null;
  while ((explicit = explicitRegex.exec(text)) !== null) {
    const unitPriceCents = Math.round(Number(explicit[3]) * 100);
    if (unitPriceCents > 0) ordered.push({ index: explicit.index, item: {
      description: capitalize(explicit[2]), quantity: parseNumber(explicit[1]), unitPriceCents,
    } });
    remaining = remaining.slice(0, explicit.index) + " ".repeat(explicit[0].length) + remaining.slice(explicit.index + explicit[0].length);
  }
  const itemRegex =
    /(\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce|quince|veinte)\s+([a-záéíóúñ]+)(?:\s+(?:de|a)\s+\$?(\d+(?:\.\d+)?))?/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(remaining)) !== null) {
    const quantity = parseNumber(match[1]);
    const description = capitalize(match[2]);
    const explicitPrice = match[3] ? Math.round(Number(match[3]) * 100) : 0;
    const unitPriceCents = explicitPrice || catalogPrice(description);
    if (unitPriceCents > 0) {
      ordered.push({ index: match.index, item: { description, quantity, unitPriceCents } });
    }
  }
  const items = ordered.sort((a, b) => a.index - b.index).map(entry => entry.item);

  const cashMatch = text.match(/(?:efectivo|en efectivo|con)\s+\$?(\d+(?:\.\d+)?)/);
  const cashCents = cashMatch ? Math.round(Number(cashMatch[1]) * 100) : 0;
  const creditMatch = text.match(/(?:fiado|a deber|me debe|apunta)\s+\$?(\d+(?:\.\d+)?)/);
  const creditCents = creditMatch ? Math.round(Number(creditMatch[1]) * 100) : 0;

  if (items.length === 0) {
    return {
      intent: "unknown",
      items: [],
      cashCents,
      customerName: null,
      creditCents,
      creditMethod: null,
      query: null,
      confidence: 0.2,
      reply: "No entendí la venta. ¿Me la repites?",
    };
  }

  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  return {
    intent: "sale",
    items,
    cashCents,
    customerName: null,
    creditCents,
    creditMethod: null,
    query: null,
    confidence: 0.75,
    reply: `Escuché ${(total / 100).toFixed(2)} pesos. ¿Confirmas?`,
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
