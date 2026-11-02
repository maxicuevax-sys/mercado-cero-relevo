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
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const activityTime = new Intl.DateTimeFormat("es-MX", {
  hour: "numeric",
  minute: "2-digit",
});

const activityShortDate = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
});

const activityShortDateWithYear = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function localDayNumber(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
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
  const dayDiff = Math.round(localDayNumber(now) - localDayNumber(date));

  if (dayDiff === 0) return `Hoy ${time}`;
  if (dayDiff === 1) return `Ayer ${time}`;

  const dateLabel =
    date.getFullYear() === now.getFullYear()
      ? activityShortDate.format(date)
      : activityShortDateWithYear.format(date);
  return `${dateLabel} ${time}`;
}

export function formatLongDate(date = new Date()): string {
  return new Intl.DateTimeFormat("es-MX", {
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
