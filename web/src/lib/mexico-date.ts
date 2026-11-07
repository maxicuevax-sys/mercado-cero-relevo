/** Fechas de México sin depender de la zona del navegador. */

export const MEXICO_TZ = "America/Mexico_City";
export const DAY_MS = 24 * 60 * 60 * 1000;

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MEXICO_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** `AAAA-MM-DD` en hora de México para una fecha dada. */
export function mexicoDateKey(date: Date): string {
  const parts = dateKeyFormatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

/** Suma días a una llave `AAAA-MM-DD` sin pasar por la zona local. */
export function addDaysToDateKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function mexicoMidnight(key: string): Date {
  // México ya no usa horario de verano: UTC-6 todo el año.
  return new Date(`${key}T00:00:00-06:00`);
}

/** Un instante de México: dentro de `daysAhead` días, a la hora indicada. */
export function mexicoAt(
  daysAhead: number,
  hour: number,
  now = new Date(),
): Date {
  return new Date(
    mexicoMidnight(mexicoDateKey(now)).getTime() +
      daysAhead * DAY_MS +
      hour * 60 * 60 * 1000,
  );
}
