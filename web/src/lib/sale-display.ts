import type { Order } from "./types";

/**
 * Etiquetas de una venta compartidas por el historial (`/ventas`) y su
 * detalle (`/ventas/[id]`). No calculan dinero ni cambian estados: solo
 * traducen los campos reales del pedido a lenguaje de mostrador.
 */
export type SaleStampTone = "demo" | "pendiente" | "fiado" | "ok" | "neutral";

export function saleStampTone(
  order: Order,
  creditBalanceCents: number,
  isDemoOrder: boolean,
): SaleStampTone {
  if (isDemoOrder) return "demo";
  if (order.status === "payment_pending" || order.status === "partially_paid") {
    return "pendiente";
  }
  if (creditBalanceCents > 0) return "fiado";
  if (order.status === "cancelled") return "neutral";
  return "ok";
}

export function saleStatusLabel(
  order: Order,
  creditBalanceCents: number,
  creditKnown: boolean,
  isDemoOrder: boolean,
): string {
  if (isDemoOrder) {
    return order.status === "payment_pending" ? "Demo · pendiente" : "Demo";
  }
  if (order.status === "payment_pending") return "Pendiente";
  if (creditKnown && order.creditCents > 0 && creditBalanceCents === 0) {
    return "Saldado";
  }
  if (creditBalanceCents > 0) {
    return order.paidCents > 0 || order.digitalPaidCents > 0
      ? "Fiado + cobro"
      : "Fiado";
  }
  if (order.status === "paid") return "Pagado";
  if (order.status === "partially_paid") return "Parcial";
  if (order.status === "fulfilled") return "Entregado";
  if (order.status === "cancelled") return "Cancelado";
  return "Registrado";
}

export function saleMethodLabel(order: Order): string {
  if (order.status === "payment_pending") {
    if (order.paidCents <= 0) return "Por cobrar";
    if (order.digitalPaidCents > 0 && order.paidCents > order.digitalPaidCents) {
      return "Efectivo + digital";
    }
    if (order.digitalPaidCents > 0) return "Digital";
    return "Efectivo";
  }
  if (order.creditCents > 0 && order.paymentMethod === "cash") return "Efectivo + fiado";
  if (order.creditCents > 0 && !order.paymentMethod) return "Fiado";
  if (!order.paymentMethod && order.creditCents === 0) return "Digital";
  if (order.paymentMethod === "cash" && order.digitalPaidCents > 0) {
    return "Efectivo + digital";
  }
  switch (order.paymentMethod) {
    case "cash":
      return "Efectivo";
    case "codi":
      return "CoDi";
    case "card":
      return "Tarjeta";
    case "wallet":
      return "Wallet";
    case "mixed":
      return "Mixto";
    default:
      return "Sin método";
  }
}
