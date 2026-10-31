import { isDemoMode } from "@/lib/config";
import { getDb, getOrder, newId, nowIso } from "@/lib/db";
import { recordPayment } from "@/lib/orders";

export async function POST(request: Request) {
  if (!isDemoMode()) {
    return Response.json({ error: "El modo demo está desactivado." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { orderId?: string; method?: "codi" | "card" | "wallet" };
    if (!body.orderId) {
      return Response.json({ error: "Falta orderId." }, { status: 400 });
    }

    const order = getOrder(body.orderId);
    if (!order) {
      return Response.json({ error: "Pedido no encontrado." }, { status: 404 });
    }

    const amountCents = Math.max(0, order.totalCents - order.paidCents - order.creditCents);
    if (amountCents <= 0) {
      return Response.json({ order });
    }

    const method = body.method ?? "card";
    const transactionId = `demo_txn_${newId("tx")}`;
    const database = getDb();
    database
      .prepare(
        `INSERT INTO payment_events
         (id, provider, event_type, idempotency_key, payload, signature_valid, processed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId("evt"),
        "demo",
        "demo.payment",
        transactionId,
        JSON.stringify({ orderId: order.id, method, amountCents }),
        0,
        nowIso(),
      );

    const updated = recordPayment(order.id, {
      provider: "demo",
      method,
      amountCents,
      transactionId,
      paymentLinkId: order.paymentLinkId,
      rawEvent: JSON.stringify({ demo: true, method }),
    });

    return Response.json({ order: updated, transactionId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo simular el pago.";
    return Response.json({ error: message }, { status: 500 });
  }
}
