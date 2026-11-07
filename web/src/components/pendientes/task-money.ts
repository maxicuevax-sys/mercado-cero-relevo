/** Utilidades de importe y nota para la bandeja de pendientes (solo cliente). */

/** Mismo tope que valida la API (`lib/tasks.ts`) en título y nota. */
export const TASK_TITLE_MAX = 120;
export const TASK_NOTE_MAX = 500;

/**
 * La API de tareas no tiene un campo de importe. Para no cambiar el contrato,
 * el importe relacionado se guarda como primera línea de la nota con una
 * etiqueta legible: "Importe relacionado: $50.00 · nota libre". Así el dato
 * persiste de verdad y cualquier otra pantalla lo puede leer como texto.
 */
const AMOUNT_PREFIX = "Importe relacionado:";
const AMOUNT_SEPARATOR = " · ";

/**
 * Convierte lo que se escribe a centavos sin pasar por `Number()` de punto
 * flotante. Acepta "$1,800", "1800", "1800.5" o "1800.50".
 */
export function parseMoneyInput(value: string): number | null {
  const clean = value.trim().replace(/[$\s]/g, "").replace(/,/g, "");
  if (!clean) return null;
  if (!/^\d{1,9}(?:\.\d{0,2})?$/.test(clean)) return null;
  const [whole, fraction = ""] = clean.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function composeTaskNote(
  note: string | null | undefined,
  amountCents: number | null,
): string | null {
  const clean = (note ?? "").trim();
  if (amountCents === null) return clean || null;
  const amount = `${AMOUNT_PREFIX} $${(amountCents / 100).toFixed(2)}`;
  return clean ? `${amount}${AMOUNT_SEPARATOR}${clean}` : amount;
}

export function splitTaskNote(note: string | null): {
  amountCents: number | null;
  note: string | null;
} {
  const text = (note ?? "").trim();
  if (!text) return { amountCents: null, note: null };

  const match = new RegExp(
    `^${AMOUNT_PREFIX}\\s*\\$?\\s*([\\d.,]+)(?:\\s*·\\s*([\\s\\S]*))?$`,
  ).exec(text);
  if (!match) return { amountCents: null, note: text };

  const amountCents = parseMoneyInput(match[1]);
  if (amountCents === null) return { amountCents: null, note: text };

  const rest = (match[2] ?? "").trim();
  return { amountCents, note: rest || null };
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
  if (response.status === 404) return "Ese pendiente ya no existe.";
  if (response.status === 409) {
    return "Ese pendiente ya cambió. Actualiza e intenta de nuevo.";
  }
  if (response.status === 429) {
    return "Demasiados intentos seguidos. Espera un momento y vuelve a intentar.";
  }
  return "No pude completar la acción. Intenta de nuevo.";
}

export function humanError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    if (
      /failed to fetch|networkerror|load failed|fetch failed/i.test(
        error.message,
      )
    ) {
      return "No pude conectar. Revisa tu conexión e intenta de nuevo.";
    }
    return error.message;
  }
  return fallback;
}
