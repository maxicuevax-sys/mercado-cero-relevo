import { z } from "zod";
import { isDemoMode } from "@/lib/config";
import { getDb, getOrder, newId, nowIso } from "@/lib/db";
import {
  bodyErrorResponse,
  enforceRateLimit,
  internalErrorResponse,
  MAX_SMALL_JSON_BYTES,
  readJsonLimited,
} from "@/lib/http-security";
import { recordPayment } from "@/lib/orders";

const bodySchema = z.object({
  orderId: z.string().trim().min(1),
  // El efectivo no se simula: el efectivo demo no es dinero real. Solo los
  // métodos digitales pueden pasar por pey/demo.
  method: z.enum(["codi", "card", "wallet"]).default("card"),
});

export async function POST(request: Request) {
  if (!isDemoMode()) {
    return Response.json(
      { error: "El modo demo está desactivado.", code: "demo_disabled" },
      { status: 403 },
    );
  }

  const limited = enforceRateLimit(request, "demo-pay", 30, 60_000);
  if (limited) return limited;

  let rawBody: unknown;
  try {
    rawBody = await readJsonLimited(request, MAX_SMALL_JSON_BYTES);
  } catch (error) {
    return bodyErrorResponse(error);
  }

  try {
    const body = bodySchema.parse(rawBody);
    const order = getOrder(body.orderId);
    if (!order) {
      return Response.json({ error: "Pedido no encontrado." }, { status: 404 });
    }

    const amountCents = Math.max(0, order.totalCents - order.paidCents - order.creditCents);
    if (amountCents <= 0) {
      return Response.json({ order });
    }

    const method = body.method;
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
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Método demo inválido. Usa codi, card o wallet; el efectivo no se simula." },
        { status: 400 },
      );
    }
    return internalErrorResponse("demo pay", error);
  }
}
