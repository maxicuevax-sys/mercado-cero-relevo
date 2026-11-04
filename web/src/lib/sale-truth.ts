import type { Order } from "./types";

/**
 * Verdad visible de una venta. No cambia el ledger ni recalcula estados:
 * solo separa lo cobrado (efectivo/digital) de lo que sigue pendiente o fiado.
 *
 * Reglas:
 * - `paidCents` es dinero registrado (efectivo declarado o digital confirmado).
 * - `digitalPaidCents` es la parte no-efectivo de `paidCents`.
 * - `creditCents` es deuda creada, no dinero recibido.
 * - `dueCents` es el saldo que todavía no tiene ni pago ni fiado.
 */
export type SaleMoney = {
  totalCents: number;
  paidCents: number;
  digitalPaidCents: number;
  cashPaidCents: number;
  creditCents: number;
  creditBalanceCents: number;
  dueCents: number;
  hasCash: boolean;
  hasDigital: boolean;
  hasReceived: boolean;
  openCredit: boolean;
  creditSettled: boolean;
  isSettled: boolean;
};

function cents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

export function saleMoney(
  order: Pick<
    Order,
    | "totalCents"
    | "paidCents"
    | "digitalPaidCents"
    | "creditCents"
    | "status"
  >,
  creditBalanceCents?: number | null,
): SaleMoney {
  const totalCents = cents(order.totalCents);
  const paidCents = cents(order.paidCents);
  const digitalPaidCents = Math.min(cents(order.digitalPaidCents), paidCents);
  const cashPaidCents = Math.max(0, paidCents - digitalPaidCents);
  const creditCents = cents(order.creditCents);
  const creditBalance =
    creditCents === 0 ? 0 : cents(creditBalanceCents ?? creditCents);
  const dueCents = Math.max(0, totalCents - paidCents - creditCents);
  const openCredit = creditCents > 0 && creditBalance > 0;
  const creditSettled = creditCents > 0 && creditBalance === 0;

  return {
    totalCents,
    paidCents,
    digitalPaidCents,
    cashPaidCents,
    creditCents,
    creditBalanceCents: creditBalance,
    dueCents,
    hasCash: cashPaidCents > 0,
    hasDigital: digitalPaidCents > 0,
    hasReceived: paidCents > 0,
    openCredit,
    creditSettled,
    isSettled: dueCents === 0 && !openCredit,
  };
}

/**
 * Un pedido demo no debe presentarse como dinero real. El estado
 * `demo_paid` o el flag del último pago digital bastan; el efectivo demo se
 * sigue mostrando como recibido, pero con etiqueta de simulación.
 */
export function isDemoSale(
  order: Pick<Order, "status" | "lastPaymentDemo">,
  demoMode: boolean,
): boolean {
  return demoMode || order.status === "demo_paid" || order.lastPaymentDemo;
}
