import { withPilotRoute } from "../../../../../lib/auth/pilot-route";
import { isDemoMode } from "@/lib/config";
import { getDb } from "@/lib/db";
import { appErrorResponse, unexpectedResponse } from "@/lib/errors";
import {
  enforceRateLimit,
  MAX_SMALL_JSON_BYTES,
  readOptionalJsonLimited,
} from "@/lib/http-security";
import { getOrderDetail } from "@/lib/orders";
import {
  extractCandidateTransactionIds,
  getPeyTransaction,
  validatePeyTransactionForOrder,
  type PeySyncFailureReason,
} from "@/lib/pey";
import type { Order } from "@/lib/types";

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

function resolveCandidateTransactionIds(order: Order, explicitTxId: string): string[] {
  const candidates = new Set<string>();
  const add = (value: string | null | undefined) => {
    const id = typeof value === "string" ? value.trim() : "";
    if (id && !id.startsWith("demo_")) {
      candidates.add(id);
    }
  };

  add(explicitTxId);

  const database = getDb();
  const paymentRows = database
    .prepare(
      `SELECT transaction_id
       FROM payments
       WHERE order_id = ? AND transaction_id IS NOT NULL AND provider != 'demo' AND demo = 0
       ORDER BY created_at DESC`,
    )
    .all(order.id) as Array<{ transaction_id: string | null }>;

  for (const row of paymentRows) {
    add(row.transaction_id);
  }

  const needles = [
    order.id,
    order.numRef,
    order.paymentLinkId,
    order.qrId,
    order.codiPushId,
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);

  if (needles.length > 0) {
    const clauses = needles.map(() => "INSTR(payload, ?) > 0").join(" OR ");
    const eventRows = database
      .prepare(
        `SELECT payload
         FROM payment_events
         WHERE provider = 'pey' AND (${clauses})
         ORDER BY processed_at DESC, rowid DESC
         LIMIT 50`,
      )
      .all(...needles) as Array<{ payload: string }>;

    for (const candidateId of extractCandidateTransactionIds(
      eventRows.map((row) => row.payload),
    )) {
      add(candidateId);
    }
  }

  return [...candidates];
}

async function POSTImpl(
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
    const candidateIds = resolveCandidateTransactionIds(order, txId);
    if (candidateIds.length === 0) {
      return Response.json({
        order,
        credit: detail.credit,
        payments: detail.payments,
        synced: false,
        reason: "no_transaction_id",
      });
    }

    const expected = expectedDigitalCents(order);
    let failureReason: PeySyncFailureReason | "transaction_not_found" =
      "transaction_not_found";

    for (const candidateId of candidateIds) {
      const transaction = await getPeyTransaction(candidateId);
      if (!transaction) {
        continue;
      }

      const validation = validatePeyTransactionForOrder(order, transaction, expected);
      if (validation.ok) {
        // A provider query is an observation. Only the signed webhook may
        // update the ledger and transition this order to paid (AGENTS.md).
        const updatedDetail = getOrderDetail(order.id);
        return Response.json({
          order: updatedDetail?.order ?? order,
          credit: updatedDetail?.credit,
          payments: updatedDetail?.payments,
          synced: false,
          providerStatus: "PAID",
          reason: "awaiting_signed_webhook",
        });
      }

      if (
        failureReason === "transaction_not_found" ||
        (failureReason === "reference_mismatch" &&
          validation.reason !== "reference_mismatch")
      ) {
        failureReason = validation.reason;
      }
    }

    return Response.json({
      order,
      credit: detail.credit,
      payments: detail.payments,
      synced: false,
      reason: failureReason,
    });
  } catch (error) {
    const known = appErrorResponse(error);
    if (known) return known;
    return unexpectedResponse(error, "No se pudo sincronizar con Pey.");
  }
}

export const POST = withPilotRoute(POSTImpl);
