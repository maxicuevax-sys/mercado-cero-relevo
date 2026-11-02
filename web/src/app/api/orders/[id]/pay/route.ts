import crypto from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { appUrl, isDemoMode } from "@/lib/config";
import { getOrder, getOrderByNumRef } from "@/lib/db";
import {
  ConflictError,
  NotFoundError,
  appErrorResponse,
  unexpectedResponse,
} from "@/lib/errors";
import { readJsonLimited } from "@/lib/http";
import { attachPaymentLink, attachQr } from "@/lib/orders";
import { createCodiQr, createPaymentLink } from "@/lib/pey";
import type { Order } from "@/lib/types";

export const MAX_NUM_REF_ATTEMPTS = 10;

const bodySchema = z.object({
  mode: z.enum(["link", "qr"]).optional(),
});

/**
 * Serializa la generación por pedido. Dos POST concurrentes comparten la
 * misma promesa: el segundo espera, relee el pedido y devuelve el link/QR que
 * ya quedó adjunto en vez de crear otro.
 */
const orderLocks = new Map<string, Promise<unknown>>();

async function withOrderLock<T>(orderId: string, task: () => Promise<T>): Promise<T> {
  const previous = orderLocks.get(orderId) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(task);
  orderLocks.set(orderId, run);
  try {
    return await run;
  } finally {
    if (orderLocks.get(orderId) === run) {
      orderLocks.delete(orderId);
    }
  }
}

function shortRef(orderId: string): string {
  const hash = crypto.createHash("sha256").update(orderId).digest("hex");
  return String((parseInt(hash.slice(0, 8), 16) % 900000) + 100000);
}

function nextNumRef(numRef: string): string {
  return String(((Number(numRef) + 1) % 900000) + 100000);
}

/**
 * Busca un numRef libre. Si los N intentos chocan, falla con 409: nunca se
 * adjunta un número que ya pertenece a otro pedido.
 */
function reserveNumRef(orderId: string): string {
  let numRef = shortRef(orderId);
  for (let attempt = 0; attempt < MAX_NUM_REF_ATTEMPTS; attempt += 1) {
    const existing = getOrderByNumRef(numRef);
    if (!existing || existing.id === orderId) return numRef;
    numRef = nextNumRef(numRef);
  }
  throw new ConflictError(
    "No encontré un número de referencia libre. Intenta generar el QR de nuevo.",
    "num_ref_exhausted",
  );
}

async function generatePayment(orderId: string, mode: "link" | "qr"): Promise<Order> {
  const order = getOrder(orderId);
  if (!order) {
    throw new NotFoundError("Pedido no encontrado.", "order_not_found");
  }

  if (
    order.status === "paid" ||
    order.status === "demo_paid" ||
    order.status === "fulfilled"
  ) {
    return order;
  }

  const amountCents = Math.max(0, order.totalCents - order.paidCents - order.creditCents);
  if (amountCents <= 0) return order;

  const concept = `Pedido ${order.id.slice(-4).toUpperCase()} · ${order.items
    .map((item) => `${item.quantity} ${item.description}`)
    .join(", ")}`.slice(0, 120);

  if (mode === "qr") {
    if (order.qrString) return order;

    const numRef = reserveNumRef(order.id);
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

    return attachQr(order.id, { ...qr, qrImage }, numRef);
  }

  if (order.paymentUrl) return order;

  const link = await createPaymentLink({ orderId: order.id, amountCents, concept });
  return attachPaymentLink(order.id, link);
}

export async function POST(request: Request, ctx: RouteContext<"/api/orders/[id]/pay">) {
  try {
    const { id } = await ctx.params;
    const body = bodySchema.parse(await readJsonLimited(request));
    const order = await withOrderLock(id, () => generatePayment(id, body.mode ?? "link"));
    return Response.json({ order });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Modo de cobro inválido.", issues: error.issues },
        { status: 400 },
      );
    }
    const known = appErrorResponse(error);
    if (known) return known;
    return unexpectedResponse(error, "No se pudo generar el cobro.");
  }
}
