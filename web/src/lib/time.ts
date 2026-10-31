/**
 * México dejó el horario de verano en 2022: America/Mexico_City es UTC-6
 * todo el año. Estos helpers calculan el día operativo sin depender de la
 * zona horaria del servidor (Vercel corre en UTC).
 */
const MEXICO_OFFSET_MINUTES = -6 * 60;

function shifted(now: Date): Date {
  return new Date(now.getTime() + MEXICO_OFFSET_MINUTES * 60 * 1000);
}

export function startOfMexicoDay(offsetDays = 0, now = new Date()): Date {
  const date = shifted(now);
  date.setUTCDate(date.getUTCDate() - offsetDays);
  date.setUTCHours(0, 0, 0, 0);
  return new Date(date.getTime() - MEXICO_OFFSET_MINUTES * 60 * 1000);
}

export function mexicoDateKey(now = new Date()): string {
  const date = shifted(now);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}
