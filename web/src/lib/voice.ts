import type { ParsedSale } from "./types";
import { mockParse } from "./voice-local";

export { mockParse };

/**
 * STT 100% local (faster-whisper) — sin OpenAI.
 * El servicio se levanta con scripts/local-stt-server.py (puerto 4097).
 * Kokoro/Piper siguen siendo la salida TTS; esto es solo entrada de voz.
 */

export async function transcribeAudio(file: File): Promise<string> {
  const endpoint =
    process.env.LOCAL_STT_URL ?? "http://127.0.0.1:4097/transcribe";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": file.type || "application/octet-stream" },
    body: bytes,
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    throw new Error(`STT local respondió HTTP ${response.status}.`);
  }
  const data = (await response.json()) as { text?: string };
  const text = (data.text ?? "").trim();
  if (!text) throw new Error("El STT local no devolvió texto.");
  return text;
}

/** Parser local determinista; no hay llamadas a OpenAI. */
export async function parseSale(transcript: string): Promise<ParsedSale> {
  return mockParse(transcript);
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
    declaredDigitalCents?: number;
    demoDigitalCents: number;
    demoCashCents?: number;
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

  const declared = summary.declaredDigitalCents ?? 0;
  const demoTotals = summary.demoDigitalCents + (summary.demoCashCents ?? 0);
  const total =
    summary.verifiedDigitalCents + declared + demoTotals + summary.cashCents;
  const declaredText =
    declared > 0
      ? `, ${(declared / 100).toFixed(2)} declarados sin verificar`
      : "";
  const demo = demoTotals > 0 ? `, ${(demoTotals / 100).toFixed(2)} en demo` : "";
  return `Hoy llevas ${(total / 100).toFixed(2)} pesos en ${summary.paidOrderCount} ventas. ${(summary.verifiedDigitalCents / 100).toFixed(2)} verificados por pey${declaredText}${demo} y ${(summary.cashCents / 100).toFixed(2)} en efectivo.`;
}
