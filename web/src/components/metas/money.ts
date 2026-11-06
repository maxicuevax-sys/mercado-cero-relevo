/** Utilidades de dinero y fechas para la pantalla Metas (solo cliente). */

import { mexicoDateKey } from "@/lib/mexico-date";

/** Mismo tope que valida la API en `app/api/goals/[id]/contribute`. */
export const MAX_GOAL_CONTRIBUTION_CENTS = 100_000_000;

/**
 * Mismo límite que `MAX_GOAL_TITLE_CHARS` del servidor (`lib/goals.ts`).
 * Se repite aquí porque ese módulo abre SQLite y no puede entrar al bundle
 * del cliente; la autoridad final sigue siendo la API.
 */
export const MAX_GOAL_TITLE_CHARS = 120;

/**
 * Convierte lo que escribe la comerciante a centavos sin pasar por `Number()`
 * de punto flotante. Acepta "$1,800", "1800", "1800.5" o "1800.50".
 * Devuelve `null` cuando el texto no es un monto válido.
 */
export function parseMoneyInput(value: string): number | null {
  const clean = value.trim().replace(/[$\s]/g, "").replace(/,/g, "");
  if (!clean) return null;
  if (!/^\d{1,9}(?:\.\d{0,2})?$/.test(clean)) return null;
  const [whole, fraction = ""] = clean.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** Llave de idempotencia para aportaciones; el servidor la exige. */
export function newRequestId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * `AAAA-MM-DD` del `<input type="date">` a ISO 8601 anclado al mediodía de
 * México, para que el día no se mueva en otra zona. Devuelve `null` si la
 * fecha no existe en el calendario.
 */
export function deadlineFromDateInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00-06:00`);
  if (Number.isNaN(date.getTime())) return null;
  if (mexicoDateKey(date) !== value) return null;
  return date.toISOString();
}

/** Mensaje legible de la API (`{ error }`) con respaldo por status. */
export async function responseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error.trim()) {
      return body.error;
    }
  } catch {
    // Respuesta sin JSON: se usa el texto genérico.
  }
  if (response.status === 404) return "Esa meta ya no existe.";
  if (response.status === 409) {
    return "Esa aportación ya se registró con otros datos. Revisa e intenta de nuevo.";
  }
  if (response.status === 429) {
    return "Demasiados intentos seguidos. Espera un momento y vuelve a intentar.";
  }
  return "No pude completar la acción. Intenta de nuevo.";
}

export function humanError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    if (/failed to fetch|networkerror|load failed|fetch failed/i.test(error.message)) {
      return "No pude conectar. Revisa tu conexión e intenta de nuevo.";
    }
    return error.message;
  }
  return fallback;
}
