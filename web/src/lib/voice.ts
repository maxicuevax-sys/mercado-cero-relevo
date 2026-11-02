import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { ParsedSale } from "./types";
import { CATALOG, mockParse } from "./voice-local";

export { mockParse };

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
  creditMethod: z.enum(["cash", "codi", "card"]).nullable().default(null),
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
- Si dice "me pagó / abonó / liquidó / transfirió / depositó" y menciona un cliente, intent="credit_payment", customerName y creditCents.
- Para credit_payment, llena creditMethod solo si el método es explícito: "efectivo/billetes" => "cash"; "transferencia/transfirió/CoDi/depósito/digital" => "codi"; "tarjeta/débito/crédito" => "card"; si no se dice, null. No inventes el método.
- Para ventas, consultas y unknown, creditMethod siempre null.
- Si es una pregunta ("cuánto vendí", "cuánto me debe", "quién me debe", "corte"), intent="query" y query con la pregunta.
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

export { answerDebtQuery } from "./voice-debts";
export type {
  DebtCredit,
  DebtCustomerSummary,
  DebtQueryAnswer,
} from "./voice-debts";

export function answerQuery(
  transcript: string,
  summary: {
    verifiedDigitalCents: number;
    demoDigitalCents: number;
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

  const total =
    summary.verifiedDigitalCents + summary.demoDigitalCents + summary.cashCents;
  const demo =
    summary.demoDigitalCents > 0
      ? `, ${(summary.demoDigitalCents / 100).toFixed(2)} en demo`
      : "";
  return `Hoy llevas ${(total / 100).toFixed(2)} pesos en ${summary.paidOrderCount} ventas. ${(summary.verifiedDigitalCents / 100).toFixed(2)} verificados por pey${demo} y ${(summary.cashCents / 100).toFixed(2)} en efectivo.`;
}
