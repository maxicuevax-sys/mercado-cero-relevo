import { formatMxn } from "@/lib/format";

/**
 * Formato compartido de la pantalla de cortes. Es puro: lo usan el Server
 * Component de `/corte`, el historial y el detalle sin tocar la base.
 */

/** "2026-11-02" → "2 de noviembre" (sin hora, en horario de México). */
export function longDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (Number.isNaN(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

/** Etiqueta corta de la fila: Hoy · Ayer · 31 oct. */
export function relativeDay(
  dateKey: string,
  todayKey: string,
  yesterdayKey: string,
): string {
  if (dateKey === todayKey) return "Hoy";
  if (dateKey === yesterdayKey) return "Ayer";
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

/** Monto con signo para la pill de diferencia: +$20.00 · -$15.00 · $0.00 */
export function signedMxn(cents: number): string {
  if (!Number.isFinite(cents) || cents === 0) return formatMxn(0);
  return `${cents > 0 ? "+" : "-"}${formatMxn(Math.abs(cents))}`;
}

export function differenceTone(cents: number): "zero" | "extra" | "missing" {
  if (cents === 0) return "zero";
  return cents > 0 ? "extra" : "missing";
}

export function differenceName(cents: number): string {
  if (cents === 0) return "Cuadra";
  return cents > 0 ? "Sobrante" : "Faltante";
}
