/**
 * Utilidades de dinero, conteo e idempotencia de la pantalla Corte.
 * Módulo compartido por el Server Component de `/corte` y sus componentes
 * cliente: no importa `lib/cash` ni abre SQLite, así que puede entrar al
 * bundle del navegador. La autoridad final de los montos es la API.
 */

import { formatMxn } from "@/lib/format";

export type MoneyField =
  | "opening"
  | "expenses"
  | "withdrawals"
  | "counted"
  | "baseNext";

export const MONEY_FIELD_LABEL: Record<MoneyField, string> = {
  opening: "La base inicial",
  expenses: "Los gastos",
  withdrawals: "Los retiros",
  counted: "El total contado",
  baseNext: "La base para mañana",
};

/** Montos que viajan a `POST /api/cash/preview` y `POST /api/cash/close`. */
export interface ClosePayload {
  openingCents: number;
  expensesCents: number;
  withdrawalsCents: number;
  countedCents: number;
  baseNextCents: number;
}

export type MoneyParseError = "required" | "invalid" | "negative";

/**
 * Convierte lo que se escribe a centavos. Acepta 400, 400.5 y 400,50;
 * rechaza texto, negativos y más de dos decimales. `required` solo marca el
 * vacío cuando el campo lo exige (total contado).
 */
export function readCentsField(
  value: string,
  required = false,
): { cents: number; error: MoneyParseError | null } {
  const trimmed = value.trim().replace(/[$\s]/g, "");
  if (!trimmed) return { cents: 0, error: required ? "required" : null };
  if (!/^-?\d+(?:[.,]\d{1,2})?$/.test(trimmed)) {
    return { cents: 0, error: "invalid" };
  }
  const amount = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(amount)) return { cents: 0, error: "invalid" };
  if (amount < 0) return { cents: 0, error: "negative" };
  return { cents: Math.round(amount * 100), error: null };
}

export function moneyFieldMessage(
  field: MoneyField,
  error: MoneyParseError,
): string {
  if (field === "counted" && error === "required") {
    return "Escribe cuánto contaste. El total contado debe ser mayor que cero.";
  }
  const label = MONEY_FIELD_LABEL[field];
  if (error === "required") return `${label}: escribe un monto.`;
  if (error === "negative") return `${label}: escribe un monto de cero o más.`;
  return `${label} debe ser un número. Ejemplo: 400.00.`;
}

/** Centavos → valor editable por la persona ("500.00"). */
export function moneyInput(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0;
  return (safe / 100).toFixed(2);
}

export function differenceWord(cents: number): "Cuadra" | "Sobrante" | "Faltante" {
  if (cents === 0) return "Cuadra";
  return cents > 0 ? "Sobrante" : "Faltante";
}

/** Texto con signo y monto para resúmenes accesibles (no solo color). */
export function differenceText(cents: number): string {
  if (cents === 0) return "Cuadra";
  return cents > 0
    ? `Sobrante de ${formatMxn(cents)}`
    : `Faltante de ${formatMxn(Math.abs(cents))}`;
}

export function differenceNote(cents: number): string {
  if (cents === 0) return "El efectivo cuadra con lo esperado.";
  return cents > 0 ? "Hay más de lo esperado." : "Hay menos de lo esperado.";
}

/** Denominaciones de billetes y monedas, de mayor a menor. */
export const DENOMINATIONS = [
  100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50,
] as const;

export function denominationLabel(cents: number): string {
  return cents >= 100
    ? `$${(cents / 100).toLocaleString("es-MX")}`
    : `$${(cents / 100).toFixed(2)}`;
}

/** Llave de idempotencia del corte; el servidor la exige al guardar. */
export function newRequestId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function humanError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    if (/failed to fetch|networkerror|load failed|fetch failed/i.test(error.message)) {
      return "No pude conectar con la caja. Revisa tu conexión e intenta de nuevo.";
    }
    return error.message;
  }
  return fallback;
}
