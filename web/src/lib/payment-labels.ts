/**
 * Una sola verdad visible para el dinero.
 *
 * Reglas:
 * - “Verificado” solo describe un evento firmado de pey.
 * - Un pago demo es una simulación: nunca se llama “Pagado” ni “entregable”.
 * - Un abono digital declarado por la comerciante no es verificado.
 * - Fiado es deuda, no dinero recibido.
 *
 * Este módulo es puro (sin imports) para poder probarlo sin base de datos.
 */

export type PaymentState =
  | "cash_received"
  | "digital_verified"
  | "digital_declared"
  | "pending"
  | "credit"
  | "demo"
  | "partial";

export interface PaymentCopy {
  label: string;
  detail: string;
}

export const PAYMENT_STATES: Record<PaymentState, PaymentCopy> = {
  cash_received: {
    label: "Efectivo recibido",
    detail: "Dinero físico registrado en la caja. No pasó por pey.",
  },
  digital_verified: {
    label: "Pago verificado por pey",
    detail: "Confirmado por un evento firmado de pey.",
  },
  digital_declared: {
    label: "Digital declarado, sin verificar",
    detail: "La comerciante lo registró; pey no lo confirmó.",
  },
  pending: {
    label: "Por cobrar",
    detail: "Todavía no entra a la caja.",
  },
  credit: {
    label: "Fiado",
    detail: "Deuda de un cliente; no es dinero recibido.",
  },
  demo: {
    label: "Pago demo (simulado)",
    detail: "No es dinero real. No se entrega.",
  },
  partial: {
    label: "Pago parcial",
    detail: "Se recibió una parte; el saldo sigue por cobrar.",
  },
};

export function paymentCopy(state: PaymentState): PaymentCopy {
  return PAYMENT_STATES[state];
}

/** Texto del botón de una hoja de resultado demo: cerrar, nunca entregar. */
export const DEMO_CLOSE_LABEL = "Cerrar demo";
/** Recordatorio corto para cualquier superficie que muestre un demo. */
export const DEMO_NOT_DELIVERABLE = "Pago demo (simulado): no se entrega.";

export type VerifySource = "local" | "pey" | "demo";

export interface VerifySourceCopy extends PaymentCopy {
  /** Texto para voz; nunca afirma un débito bancario. */
  speech: string;
}

/**
 * `/api/verify` distingue un pago ya registrado por webhook (`local`) de una
 * consulta en vivo a pey (`pey`). La UI no debe llamar “verificado” a un demo.
 */
export function verifySourceCopy(
  source: string | null | undefined,
): VerifySourceCopy {
  if (source === "local") {
    return {
      label: "Registrado por webhook firmado",
      detail: "El pago ya está en la caja con un evento firmado de pey.",
      speech: "Comprobante registrado por webhook firmado.",
    };
  }
  if (source === "pey") {
    return {
      label: "Confirmado ahora por pey",
      detail: "pey respondió a la consulta en este momento.",
      speech: "Comprobante confirmado ahora por pey.",
    };
  }
  if (source === "demo") {
    return {
      ...PAYMENT_STATES.demo,
      speech: "Pago demo simulado. No es dinero real.",
    };
  }
  return {
    label: PAYMENT_STATES.digital_verified.label,
    detail: PAYMENT_STATES.digital_verified.detail,
    speech: "Comprobante verificado por pey.",
  };
}

export type OrderStatusLike =
  | "draft"
  | "confirmed"
  | "payment_pending"
  | "partially_paid"
  | "paid"
  | "demo_paid"
  | "fulfilled"
  | "cancelled";

export function orderStatusCopy(status: OrderStatusLike): PaymentCopy {
  switch (status) {
    case "draft":
      return { label: "Borrador", detail: "Todavía no es una venta cobrada." };
    case "confirmed":
      return PAYMENT_STATES.pending;
    case "payment_pending":
      return {
        label: "Esperando confirmación",
        detail: "La confirmación firmada de pey todavía no llega.",
      };
    case "partially_paid":
      return PAYMENT_STATES.partial;
    case "paid":
      return {
        label: "Pagado",
        detail: "El pedido quedó cubierto. Revisa la fuente del dinero.",
      };
    case "demo_paid":
      return PAYMENT_STATES.demo;
    case "fulfilled":
      return { label: "Entregado", detail: "La entrega ya se registró." };
    case "cancelled":
      return { label: "Cancelado", detail: "Esta venta no cuenta." };
  }
}

/**
 * Copy de la pantalla pública de éxito. Un pedido pendiente no afirma que el
 * banco debitó ni obliga a quedarse: el link conserva el comprobante.
 */
export const SUCCESS_COPY = {
  pending: {
    stamp: "Esperando confirmación",
    method: "Pago pendiente",
    title: "Esperando la confirmación de pey",
    body: "Si ya pagaste, estamos esperando la confirmación firmada de pey. Puedes cerrar; este link conserva el comprobante.",
    note: "Cuando pey confirme, esta pantalla se actualiza sola. Si tarda, muestra este link a la comerciante.",
  },
  verified: {
    stamp: "Pago verificado por pey",
    method: "Confirmación firmada",
    title: "Pago verificado por pey",
    body: "pey confirmó este pago con una confirmación firmada. Ya puedes mostrar esta pantalla.",
    note: "La comerciante ya puede entregar el pedido.",
  },
  demo: {
    stamp: "Pago demo",
    method: "Simulación",
    title: PAYMENT_STATES.demo.label,
    body: PAYMENT_STATES.demo.detail,
    note: "La caja solo registra la simulación; no hay dinero real.",
  },
  cash: {
    stamp: "Efectivo recibido",
    method: "Cobrado en caja",
    title: PAYMENT_STATES.cash_received.label,
    body: "Recibiste el efectivo en la caja. No pasó por pey ni es un pago verificado por el banco.",
    note: "La comerciante ya puede entregar el pedido. El efectivo queda registrado en el corte de caja.",
  },
} as const;
