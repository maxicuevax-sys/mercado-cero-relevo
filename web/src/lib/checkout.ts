import { MERCHANT, isDemoMode } from "@/lib/config";
import { shortOrder } from "@/lib/format";
import { getOrderDetail } from "@/lib/orders";

/**
 * Payload público del checkout. Es la única traducción de la orden + pagos a
 * la forma que consumen el servidor y el cliente; no expone notas internas ni
 * secretos.
 */
export interface CheckoutData {
  demoMode: boolean;
  merchant: {
    name: string;
    owner: string;
    address: string;
  };
  order: {
    id: string;
    shortRef: string;
    status: string;
    totalCents: number;
    paidCents: number;
    digitalPaidCents: number;
    cashPaidCents?: number;
    demoPaidCents?: number;
    verifiedPaidCents?: number;
    creditCents: number;
    amountDueCents: number;
    paymentMethod: string | null;
    paymentUrl: string | null;
    createdAt: string;
    items: Array<{
      id: string;
      description: string;
      quantity: number;
      unitPriceCents: number;
      totalCents: number;
    }>;
  };
  payment: {
    provider: string;
    method: string;
    transactionId: string | null;
    amountCents: number;
    createdAt: string;
  } | null;
}

/**
 * Lee el checkout en el servidor. Devuelve `null` cuando el pedido no existe,
 * para que la página pueda mostrar el estado vacío sin un fetch HTTP.
 */
export function getCheckoutData(orderId: string): CheckoutData | null {
  const detail = getOrderDetail(orderId);
  if (!detail) return null;

  const { order, payments } = detail;
  const paidPayment = payments
    .filter((payment) => payment.status === "paid" && payment.method !== "cash")
    .at(-1);
  const cashPaidCents = payments
    .filter(
      (payment) =>
        payment.status === "paid" &&
        payment.method === "cash" &&
        payment.provider !== "demo",
    )
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  const demoPaidCents = payments
    .filter((payment) => payment.status === "paid" && payment.provider === "demo")
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  const verifiedPaidCents = payments
    .filter((payment) => payment.status === "paid" && payment.provider === "pey")
    .reduce((sum, payment) => sum + payment.amountCents, 0);

  return {
    demoMode: isDemoMode(),
    merchant: {
      name: MERCHANT.name,
      owner: MERCHANT.owner,
      address: MERCHANT.address,
    },
    order: {
      id: order.id,
      shortRef: shortOrder(order.id),
      status: order.status,
      totalCents: order.totalCents,
      paidCents: order.paidCents,
      digitalPaidCents: order.digitalPaidCents,
      cashPaidCents,
      demoPaidCents,
      verifiedPaidCents,
      creditCents: order.creditCents,
      amountDueCents: Math.max(
        0,
        order.totalCents - order.paidCents - order.creditCents,
      ),
      paymentMethod: order.paymentMethod,
      paymentUrl: order.paymentUrl,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        totalCents: item.totalCents,
      })),
    },
    payment: paidPayment
      ? {
          provider: paidPayment.provider,
          method: paidPayment.method,
          transactionId: paidPayment.transactionId,
          amountCents: paidPayment.amountCents,
          createdAt: paidPayment.createdAt,
        }
      : null,
  };
}
