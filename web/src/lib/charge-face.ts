/**
 * Cara visible de un cobro CoDi que ya existe.
 *
 * No crea cobros, no llama a pey y no cambia `paid` ni `demo_paid`.
 * Tardío, vencido y rechazado son lecturas: el pedido sigue sin pagar
 * hasta que llegue el webhook firmado.
 */

export const CHARGE_LATE_WITHIN_MS = 2 * 60 * 1000;

export type ChargeFaceName = "waiting" | "late" | "expired" | "rejected";

export interface ChargeFace {
  face: ChargeFaceName;
  label: string;
  detail: string;
}

const OPEN_STATUSES = new Set([
  "draft",
  "confirmed",
  "payment_pending",
  "partially_paid",
]);

export function chargeFace(input: {
  status: string;
  qrExpiresAt?: string | null;
  simulation?: boolean;
  rejected?: boolean;
  /** Reloj del cliente. Sin reloj no se afirma tardío ni vencido. */
  now?: number | null;
}): ChargeFace {
  const simulation = input.simulation === true;
  if (!OPEN_STATUSES.has(input.status)) {
    return waiting(simulation);
  }
  if (input.rejected) {
    return {
      face: "rejected",
      label: simulation ? "Demo · rechazado" : "Rechazado",
      detail: simulation
        ? "La simulación no generó el cobro. No es un pago ni se entrega."
        : "pey no creó este cobro. El pedido sigue sin pagar.",
    };
  }

  const remaining = remainingMs(input.qrExpiresAt, input.now);
  if (remaining !== null && remaining <= 0) {
    return {
      face: "expired",
      label: simulation ? "Demo · vencido" : "Vencido",
      detail: simulation
        ? "El QR de demostración venció. No es dinero real ni se entrega."
        : "El QR venció y no hay pago. Si pey confirma después, el webhook lo registra.",
    };
  }
  if (remaining !== null && remaining <= CHARGE_LATE_WITHIN_MS) {
    return {
      face: "late",
      label: simulation ? "Demo · tardío" : "Tardío",
      detail: simulation
        ? "Queda poco tiempo en el QR de demostración. No es dinero real."
        : "Quedan dos minutos o menos. pey todavía no confirma el pago.",
    };
  }
  return waiting(simulation);
}

function waiting(simulation: boolean): ChargeFace {
  return {
    face: "waiting",
    label: simulation ? "Demo · por cobrar" : "Por cobrar",
    detail: simulation
      ? "Simulación. Un QR no es un depósito."
      : "El cobro sigue abierto. Un QR no es un depósito.",
  };
}

function remainingMs(
  expiresAt: string | null | undefined,
  now: number | null | undefined,
): number | null {
  if (now === null || now === undefined || !expiresAt) return null;
  const target = Date.parse(expiresAt);
  if (!Number.isFinite(target)) return null;
  return target - now;
}
