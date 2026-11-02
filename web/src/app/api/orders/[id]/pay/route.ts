import crypto from "node:crypto";
import QRCode from "qrcode";
import { appUrl, isDemoMode } from "@/lib/config";
import { getOrder, getOrderByNumRef } from "@/lib/db";
import {
  bodyErrorResponse,
  enforceRateLimit,
  internalErrorResponse,
  MAX_SMALL_JSON_BYTES,
  readOptionalJsonLimited,
} from "@/lib/http-security";
import { attachPaymentLink, attachQr } from "@/lib/orders";
import { createCodiQr, createPaymentLink } from "@/lib/pey";

function shortRef(orderId: string): string {
  const hash = crypto.createHash("sha256").update(orderId).digest("hex");
  return String((parseInt(hash.slice(0, 8), 16) % 900000) + 100000);
}

export async function POST(request: Request, ctx: RouteContext<"/api/orders/[id]/pay">) {
  const limited = enforceRateLimit(request, "order-pay", 30, 60_000);
  if (limited) return limited;

  let body: { mode?: "link" | "qr" };
  try {
    body = await readOptionalJsonLimited<{ mode?: "link" | "qr" }>(
      request,
      MAX_SMALL_JSON_BYTES,
      {},
    );
  } catch (error) {
    return bodyErrorResponse(error);
  }

  try {
    const { id } = await ctx.params;
    const order = getOrder(id);

    if (!order) {
      return Response.json({ error: "Pedido no encontrado." }, { status: 404 });
    }

    if (order.status === "paid" || order.status === "fulfilled") {
      return Response.json({ order });
    }

    const amountCents = Math.max(0, order.totalCents - order.paidCents - order.creditCents);
    if (amountCents <= 0) {
      return Response.json({ order });
    }

    const concept = `Pedido ${order.id.slice(-4).toUpperCase()} · ${order.items
      .map((item) => `${item.quantity} ${item.description}`)
      .join(", ")}`.slice(0, 120);

    if (body.mode === "qr") {
      if (order.qrString) return Response.json({ order });

      let numRef = shortRef(order.id);
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const existing = getOrderByNumRef(numRef);
        if (!existing || existing.id === order.id) break;
        numRef = String((Number(numRef) + 1) % 900000 + 100000);
      }

      const qr = await createCodiQr({ orderId: order.id, amountCents, concept, numRef });
      const qrValue = isDemoMode()
        ? `${appUrl()}/pay/${order.id}?demo=1`
        : qr.qrString;
      const qrImage =
        qr.qrImage ??
        (await QRCode.toDataURL(qrValue, {
          width: 640,
          margin: 1,
          color: { dark: "#143D2F", light: "#FFFFFF" },
        }));

      const updated = attachQr(order.id, { ...qr, qrImage }, numRef);
      return Response.json({ order: updated });
    }

    if (order.paymentUrl) return Response.json({ order });

    const link = await createPaymentLink({ orderId: order.id, amountCents, concept });
    const updated = attachPaymentLink(order.id, link);
    return Response.json({ order: updated });
  } catch (error) {
    return internalErrorResponse("order pay", error);
  }
}
