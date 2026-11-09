export function formatMxn(cents: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format((Number.isFinite(cents) ? cents : 0) / 100);
}

export function formatCompactMxn(cents: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format((Number.isFinite(cents) ? cents : 0) / 100);
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const activityTime = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  hour: "numeric",
  minute: "2-digit",
});

const activityShortDate = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  day: "numeric",
  month: "short",
});

const activityShortDateWithYear = new Intl.DateTimeFormat("es-MX", {
  timeZone: "America/Mexico_City",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dayMonth = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/**
 * "2026-02-11" → "11 feb". Evita el ambiguo "11-02" en los reportes.
 */
export function formatDayMonth(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (Number.isNaN(date.getTime())) return isoDate;
  return dayMonth.format(date);
}

const activityCalendar = new Intl.DateTimeFormat("en", {
  timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit",
});

function operationalDay(date: Date) {
  const parts = activityCalendar.formatToParts(date);
  const year = Number(parts.find(part => part.type === "year")!.value);
  const month = Number(parts.find(part => part.type === "month")!.value);
  const day = Number(parts.find(part => part.type === "day")!.value);
  return { year, number: Date.UTC(year, month - 1, day) / 86_400_000 };
}

/**
 * Fecha legible para movimientos que pueden ser de otro día.
 * Hoy 2:00 p.m. · Ayer 2:00 p.m. · 31 oct 2:00 p.m. · 31 oct 2025 2:00 p.m.
 */
export function formatActivityDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  const now = new Date();
  const time = activityTime.format(date);
  const currentDay = operationalDay(now);
  const eventDay = operationalDay(date);
  const dayDiff = currentDay.number - eventDay.number;

  if (dayDiff === 0) return `Hoy ${time}`;
  if (dayDiff === 1) return `Ayer ${time}`;

  const dateLabel =
    eventDay.year === currentDay.year
      ? activityShortDate.format(date)
      : activityShortDateWithYear.format(date);
  return `${dateLabel} ${time}`;
}

export function formatLongDate(date = new Date()): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function shortOrder(id: string): string {
  return id.slice(-4).toUpperCase();
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
