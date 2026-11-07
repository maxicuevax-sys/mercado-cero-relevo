import { isDemoMode } from "@/lib/config";
import { getDb } from "@/lib/db";
import { appErrorResponse, unexpectedResponse } from "@/lib/errors";
import {
  enforceRateLimit,
  MAX_SMALL_JSON_BYTES,
  readOptionalJsonLimited,
} from "@/lib/http-security";
import { getOrderDetail, recordPayment } from "@/lib/orders";
import {
  getPeyTransaction,
  mapPeyMethod,
  transactionBaseCents,
  type PeyTransaction,
} from "@/lib/pey";
import type { Order } from "@/lib/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function identifier(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function expectedDigitalCents(order: Order): number {
  const cash = getDb()
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total
       FROM payments
       WHERE order_id = ? AND status = 'paid' AND method = 'cash' AND provider != 'demo' AND demo = 0`,
    )
    .get(order.id) as { total: number };
  return Math.max(0, order.totalCents - order.creditCents - Number(cash.total));
}

function hasReferenceMismatch(order: Order, transaction: PeyTransaction): boolean {
  const metadata = isRecord(transaction.metadata) ? transaction.metadata : {};
  const externalMetadata = isRecord(metadata.externalMetadata) ? metadata.externalMetadata : {};
  const metadataOrderId = identifier(metadata.orderId) || identifier(externalMetadata.orderId);
  if (metadataOrderId && metadataOrderId !== order.id) return true;

  const clientReferenceId = identifier((transaction as Record<string, unknown>).clientReferenceId);
  if (clientReferenceId && clientReferenceId !== order.id) return true;

  const payableId = identifier(transaction.payableId);
  if (!metadataOrderId && !clientReferenceId && !payableId) return true;

  if (transaction.payableType === "PAYMENT_LINK") {
    if (!order.paymentLinkId) return true;
    if (payableId && payableId !== order.paymentLinkId) return true;
  } else if (transaction.payableType === "API_CODI_QR") {
    if (!order.qrId) return true;
    if (payableId && payableId !== order.qrId) return true;
  } else if (transaction.payableType === "API_CODI_PN") {
    if (!order.codiPushId) return true;
    if (payableId && payableId !== order.codiPushId) return true;
  } else if (
    payableId &&
    payableId !== order.paymentLinkId &&
    payableId !== order.qrId &&
    payableId !== order.codiPushId
  ) {
    return true;
  }

  return false;
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/orders/[id]/sync-pey">,
) {
  const limited = enforceRateLimit(request, "order-sync-pey", 30, 60_000);
  if (limited) return limited;

  try {
    const { id } = await ctx.params;
    const detail = getOrderDetail(id);
    if (!detail) {
      return Response.json(
        { error: "Pedido no encontrado.", code: "order_not_found" },
        { status: 404 },
      );
    }
    const order = detail.order;

    if (
      order.status === "paid" ||
      order.status === "demo_paid" ||
      order.status === "fulfilled"
    ) {
      return Response.json({
        order,
        credit: detail.credit,
        payments: detail.payments,
        synced: false,
        reason: "already_settled",
      });
    }

    if (isDemoMode()) {
      return Response.json({
        order,
        credit: detail.credit,
        payments: detail.payments,
        synced: false,
        demoMode: true,
      });
    }

    let body: { transactionId?: string } = {};
    try {
      body = await readOptionalJsonLimited<{ transactionId?: string }>(
        request,
        MAX_SMALL_JSON_BYTES,
        {},
      );
    } catch {
      body = {};
    }

    const txId = typeof body.transactionId === "string" ? body.transactionId.trim() : "";
    if (!txId) {
      return Response.json({
        order,
        credit: detail.credit,
        payments: detail.payments,
        synced: false,
        reason: "no_transaction_id",
      });
    }

    const transaction = await getPeyTransaction(txId);
    if (!transaction) {
      return Response.json({
        order,
        credit: detail.credit,
        payments: detail.payments,
        synced: false,
        reason: "transaction_not_found",
      });
    }

    const expected = expectedDigitalCents(order);
    const amountCents = transactionBaseCents(transaction);

    const isPaid = transaction.status === "PAID";
    const isMxn = !transaction.currency || transaction.currency.toUpperCase() === "MXN";
    const amountMatches = amountCents !== null && amountCents === expected;
    const referenceMatches = !hasReferenceMismatch(order, transaction);

    if (isPaid && isMxn && amountMatches && referenceMatches) {
      const updated = recordPayment(order.id, {
        provider: "pey",
        method: mapPeyMethod(transaction.paymentMethod),
        amountCents,
        transactionId: transaction.id,
        paymentLinkId: order.paymentLinkId,
        rawEvent: JSON.stringify(transaction),
      });
      const updatedDetail = getOrderDetail(order.id);
      return Response.json({
        order: updatedDetail?.order ?? updated,
        credit: updatedDetail?.credit,
        payments: updatedDetail?.payments,
        synced: true,
      });
    }

    return Response.json({
      order,
      credit: detail.credit,
      payments: detail.payments,
      synced: false,
      reason: !isPaid
        ? "not_paid"
        : !isMxn
          ? "currency_mismatch"
          : !amountMatches
            ? "amount_mismatch"
            : "reference_mismatch",
    });
  } catch (error) {
    const known = appErrorResponse(error);
    if (known) return known;
    return unexpectedResponse(error, "No se pudo sincronizar con Pey.");
  }
}
