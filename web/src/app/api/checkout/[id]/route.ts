import { MERCHANT, isDemoMode } from "@/lib/config";
import { getOrderDetail } from "@/lib/orders";
import { shortOrder } from "@/lib/format";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const detail = getOrderDetail(id);
  if (!detail) {
    return Response.json({ error: "Este cobro no existe." }, { status: 404 });
  }

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

  return Response.json({
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
  });
}
