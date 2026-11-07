/** Utilidades compartidas por las pantallas 18 (abono) y 20 (registrado). */

export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function firstName(value: string): string {
  return value.trim().split(/\s+/)[0] ?? "";
}

/**
 * "Juan" → "juan"; "Doña Elena" → "dona-elena".
 * Se usa para el enlace de regreso a la libreta del cliente.
 */
export function nameSlug(value: string): string {
  const clean = normalizeName(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || "cliente";
}

/** Acepta "50", "50.5", "50,50" y "1,200.50"; devuelve centavos. */
export function parseCents(value: string | undefined | null): number | null {
  if (!value) return null;
  let clean = value.trim().replace(/[$\s]/g, "");
  if (!clean) return null;
  clean =
    clean.includes(",") && clean.includes(".")
      ? clean.replace(/,/g, "")
      : clean.replace(",", ".");
  if (!/^\d{1,9}(?:\.\d{0,2})?$/.test(clean)) return null;
  const [whole, fraction = ""] = clean.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function clampCents(value: number | null, min: number, max: number): number {
  if (value === null || !Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

const shortDay = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
});

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "Hoy, 6 nov." · "Ayer, 5 nov." · "3 nov." */
export function dayLabel(value: string | Date | null | undefined, now = new Date()): string {
  const date = value instanceof Date ? value : value ? new Date(value) : now;
  if (Number.isNaN(date.getTime())) return dayLabel(now, now);
  const day = shortDay.format(date).replace(/\s+/g, " ");
  const diff = Math.round((startOfLocalDay(now) - startOfLocalDay(date)) / 86_400_000);
  const prefix = sameLocalDay(date, now) ? "Hoy, " : diff === 1 ? "Ayer, " : "";
  return `${prefix}${day}.`;
}

export function methodLabel(method: string | undefined): string {
  if (method === "card") return "Tarjeta";
  if (method === "codi") return "QR";
  return "Efectivo";
}
