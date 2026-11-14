/**
 * Pasos visibles de Pulso. No cobra y no marca un pago.
 * Un paso solo está hecho si hay una fila real con ese nombre.
 */

export const PULSO_STEPS = [
  "order.created",
  "payment.requested",
  "pey.webhook.verified",
  "payment.received",
  "fulfillment.started",
] as const;

export type PulsoStep = (typeof PULSO_STEPS)[number];

export interface PulsoEvent {
  step: string;
  at: string;
  detail: string | null;
}

export interface PulsoMark {
  step: PulsoStep;
  at: string | null;
  detail: string;
  done: boolean;
}

const STEP_WAITING: Record<PulsoStep, string> = {
  "order.created": "El pedido todavía no está en la caja.",
  "payment.requested": "Todavía no hay un cobro pedido a pey.",
  "pey.webhook.verified": "Solo entra con firma válida. Un webhook-id repetido no hace nada.",
  "payment.received": "Aún no hay un depósito confirmado.",
  "fulfillment.started": "La comanda aparece después del webhook.",
};

export function presentTimeline(
  events: PulsoEvent[],
  options: { createdAt?: string | null; codiInactive?: boolean } = {},
): PulsoMark[] {
  const byStep = new Map(events.map((event) => [event.step, event]));
  return PULSO_STEPS.map((step) => {
    const event = byStep.get(step);
    if (event) {
      return {
        step,
        at: event.at,
        detail: event.detail?.trim() || doneDetail(step),
        done: true,
      };
    }
    if (step === "order.created" && options.createdAt) {
      return {
        step,
        at: options.createdAt,
        detail: "Pedido anotado en la caja.",
        done: true,
      };
    }
    if (step === "payment.requested" && options.codiInactive) {
      return {
        step,
        at: null,
        detail: "CoDi no activo. No se creó un cobro.",
        done: false,
      };
    }
    return { step, at: null, detail: STEP_WAITING[step], done: false };
  });
}

function doneDetail(step: PulsoStep): string {
  if (step === "pey.webhook.verified") return "Firma verificada.";
  if (step === "fulfillment.started") return "Inventario descontado una vez.";
  return "Hecho.";
}
