import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { ParsedSale } from "./types";

const CATALOG = [
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

const saleSchema = z.object({
  intent: z.enum(["sale", "query", "credit_payment", "unknown"]),
  items: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number().positive(),
        unitPriceCents: z.number().int().nonnegative(),
      }),
    )
    .default([]),
  cashCents: z.number().int().nonnegative().default(0),
  customerName: z.string().nullable().default(null),
  creditCents: z.number().int().nonnegative().default(0),
  query: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1).default(0.5),
  reply: z.string().default(""),
});

function client(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function transcribeAudio(file: File): Promise<string> {
  const openai = client();
  if (!openai) {
    throw new Error("Falta OPENAI_API_KEY para transcribir audio.");
  }

  const model = process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe";
  const result = await openai.audio.transcriptions.create({
    file,
    model,
    language: "es",
    prompt: "Venta de comida mexicana: quesadillas, aguas, refrescos, atole, tacos, tortillas, fiado.",
  });

  return result.text.trim();
}

export async function parseSale(transcript: string): Promise<ParsedSale> {
  const openai = client();
  if (!openai) return mockParse(transcript);

  const catalogText = CATALOG.map(
    (item) => `${item.name}: ${(item.priceCents / 100).toFixed(2)} pesos`,
  ).join("\n");

  const completion = await openai.chat.completions.parse({
    model: process.env.OPENAI_PARSE_MODEL ?? "gpt-4.1-mini",
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: `Eres el parser de "Mercado Cero", una caja hablada para una comerciante mexicana.
Convierte la frase en una operación estructurada. No inventes precios.

CATÁLOGO DE APOYO (precios en pesos):
${catalogText}

REGLAS:
- Los precios que devuelves están en CENTAVOS. $35.00 = 3500.
- Si la frase menciona un precio, úsalo. Si no, usa el precio del catálogo. Si no está en el catálogo, usa 0 y baja la confianza.
- "dos quesadillas de 35 y un agua de 20" => 2 × 3500 + 1 × 2000.
- Si dice "le di / pagó con / efectivo", llena cashCents.
- Si dice "fiado / me debe / a deber / apunta", llena creditCents y customerName.
- Si dice "me pagó / abonó / liquidó" y menciona un cliente, intent="credit_payment", customerName y creditCents.
- Si es una pregunta ("cuánto vendí", "cuánto me debe", "corte"), intent="query" y query con la pregunta.
- Si no entiendes, intent="unknown", confidence baja y reply pidiendo repetir.
- reply debe ser una frase corta para confirmar en voz alta, en español mexicano, sin sonar robótica.
- No agregues texto fuera del JSON.`,
      },
      { role: "user", content: transcript },
    ],
    response_format: zodResponseFormat(saleSchema, "sale"),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) return mockParse(transcript);
  return parsed;
}

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

/**
 * Parser local para que la demo funcione sin OPENAI_API_KEY.
 * No pretende ser perfecto: cubre las frases del guion y vocabulario de tienda.
 */
export function mockParse(transcript: string): ParsedSale {
  const text = transcript.toLowerCase();

  if (/(cu[aá]nto vend[ií]|corte|cuenta del d[ií]a|resumen)/.test(text)) {
    return {
      intent: "query",
      items: [],
      cashCents: 0,
      customerName: null,
      creditCents: 0,
      query: transcript,
      confidence: 0.9,
      reply: "Te doy el corte del día.",
    };
  }

  if (/(me pag[oó]|abon[oó]|liquid[oó])/.test(text) && /(fiado|debe|deuda)/.test(text)) {
    const nameMatch = text.match(/(?:que|a|de)\s+([a-záéíóúñ]+)/);
    const amountMatch = text.match(/(\d+(?:\.\d+)?)/);
    const amount = amountMatch ? Math.round(Number(amountMatch[1]) * 100) : 0;
    return {
      intent: "credit_payment",
      items: [],
      cashCents: 0,
      customerName: nameMatch ? capitalize(nameMatch[1]) : null,
      creditCents: amount,
      query: null,
      confidence: 0.8,
      reply: amount > 0 ? `Abono de ${amount / 100} pesos registrado.` : "¿De cuánto fue el abono?",
    };
  }

  const items: ParsedSale["items"] = [];
  const itemRegex =
    /(\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce|quince|veinte)\s+([a-záéíóúñ]+)(?:\s+(?:de|a)\s+\$?(\d+(?:\.\d+)?))?/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(text)) !== null) {
    const quantity = parseNumber(match[1]);
    const description = capitalize(match[2]);
    const explicitPrice = match[3] ? Math.round(Number(match[3]) * 100) : 0;
    const unitPriceCents = explicitPrice || catalogPrice(description);
    if (unitPriceCents > 0) {
      items.push({ description, quantity, unitPriceCents });
    }
  }

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
    query: null,
    confidence: 0.75,
    reply: `Son ${(total / 100).toFixed(2)} pesos. ¿Genero el cobro?`,
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function answerQuery(
  transcript: string,
  summary: {
    verifiedDigitalCents: number;
    cashCents: number;
    pendingCents: number;
    creditCents: number;
    paidOrderCount: number;
  },
  credits: Array<{ customerName?: string; balanceCents: number }>,
): string {
  const text = transcript.toLowerCase();
  const creditMatch = credits.find((credit) =>
    credit.customerName ? text.includes(credit.customerName.toLowerCase()) : false,
  );

  if (creditMatch) {
    return `${creditMatch.customerName} te debe ${(creditMatch.balanceCents / 100).toFixed(2)} pesos.`;
  }

  if (/(fiado|deben|deuda)/.test(text)) {
    return `En fiado tienes ${(summary.creditCents / 100).toFixed(2)} pesos pendientes.`;
  }

  if (/(pendiente|por cobrar|esperando)/.test(text)) {
    return `Tienes ${(summary.pendingCents / 100).toFixed(2)} pesos esperando confirmación.`;
  }

  const total = summary.verifiedDigitalCents + summary.cashCents;
  return `Hoy llevas ${(total / 100).toFixed(2)} pesos en ${summary.paidOrderCount} ventas cobradas. ${(summary.verifiedDigitalCents / 100).toFixed(2)} digitales verificados y ${(summary.cashCents / 100).toFixed(2)} en efectivo.`;
}
