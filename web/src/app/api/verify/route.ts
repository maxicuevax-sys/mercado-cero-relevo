import { isDemoMode } from "@/lib/config";
import { getDb, getOrder, getOrderByNumRef } from "@/lib/db";
import { enforceRateLimit } from "@/lib/http-security";
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

/**
 * Monto digital que la orden debería haber cobrado: total menos fiado menos
 * efectivo real. No usa `paid_cents` porque un pago demo no es efectivo.
 */
function expectedDigitalCents(order: Order): number {
  const cash = getDb()
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total
       FROM payments
       WHERE order_id = ? AND status = 'paid' AND method = 'cash' AND provider != 'demo' AND demo = 0`,
    )
    .get(order.id) as { total: number };
  return Math.max(
    0,
    order.totalCents - order.creditCents - Number(cash.total),
  );
}

function rejected(reason: string, message: string) {
  return Response.json({ verified: false, reason, message });
}

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, "verify", 60, 60_000);
  if (limited) return limited;

  const url = new URL(request.url);
  const transactionId = url.searchParams.get("transactionId")?.trim();
  const orderId = url.searchParams.get("orderId")?.trim();

  if (!transactionId) {
    const numRef = url.searchParams.get("numRef")?.trim();
    if (!numRef) {
      return Response.json({ error: "Falta transactionId o numRef." }, { status: 400 });
    }
    if (!/^\d{6}$/.test(numRef)) {
      return Response.json({ error: "numRef inválido. Debe tener 6 dígitos numéricos." }, { status: 400 });
    }
    const order = getOrderByNumRef(numRef);
    if (!order) {
      return rejected("order_not_found", "No hay ningún pedido con esa referencia CoDi.");
    }
    if (order.status === "demo_paid") {
      return Response.json({
        verified: false,
        source: "demo",
        reason: "demo_payment",
        message: "El pedido es una simulación demo. No es dinero real.",
        orderId: order.id,
        numRef,
      });
    }

    const database = getDb();
    const local = database
      .prepare(
        `SELECT p.id, p.order_id, p.method, p.amount_cents, p.transaction_id, p.demo, p.created_at
         FROM payments p
         WHERE p.order_id = ? AND p.status = 'paid' AND p.provider = 'pey' AND p.demo = 0
         LIMIT 1`,
      )
      .get(order.id) as
      | {
          id: string;
          order_id: string;
          method: string;
          amount_cents: number;
          transaction_id: string;
          demo: number;
          created_at: string;
        }
      | undefined;

    if (!local) {
      return rejected("not_paid", "El pedido aún no tiene un pago confirmado por Pey.");
    }

    const expected = expectedDigitalCents(order);
    if (Number(local.amount_cents) !== expected) {
      return rejected(
        "amount_mismatch",
        `El monto pagado (${local.amount_cents}) no coincide con el saldo esperado (${expected}).`,
      );
    }

    return Response.json({
      verified: true,
      source: "local",
      numRef,
      transactionId: local.transaction_id,
      orderId: order.id,
      method: local.method,
      amountCents: Number(local.amount_cents),
      createdAt: local.created_at,
    });
  }

  if (transactionId.length > 200) {
    return Response.json({ error: "transactionId inválido." }, { status: 400 });
  }
  if (!orderId) {
    return Response.json(
      { error: "Falta orderId. El comprobante se compara contra una orden." },
      { status: 400 },
    );
  }

  const order = getOrder(orderId);
  if (!order) {
    return rejected(
      "order_not_found",
      "Ese pedido no existe. No se puede verificar el comprobante.",
    );
  }

  const database = getDb();
  const local = database
    .prepare(
      `SELECT p.id, p.order_id, p.method, p.amount_cents, p.transaction_id,
              p.payment_link_id, p.demo, p.created_at
       FROM payments p
       WHERE p.transaction_id = ? AND p.status = 'paid' AND p.provider = 'pey'
       LIMIT 1`,
    )
    .get(transactionId) as
    | {
        id: string;
        order_id: string;
        method: string;
        amount_cents: number;
        transaction_id: string;
        payment_link_id: string | null;
        demo: number;
        created_at: string;
      }
    | undefined;

  if (local && local.order_id !== order.id) {
    return rejected(
      "order_mismatch",
      "Esa transacción pertenece a otro pedido. No entregues este pedido.",
    );
  }

  if (local && Number(local.demo ?? 0) === 1) {
    // Un webhook firmado en DEMO_MODE=true es evidencia de una simulación,
    // no de dinero real. No se presenta como verificado ni se entrega.
    return Response.json({
      verified: false,
      source: "demo",
      reason: "demo_payment",
      message:
        "Pago demo (simulado): no es dinero real. No lo presentes como verificado ni entregues el pedido.",
      transactionId: local.transaction_id,
      orderId: local.order_id,
      method: local.method,
      amountCents: Number(local.amount_cents),
      createdAt: local.created_at,
    });
  }

  if (local) {
    const expected = expectedDigitalCents(order);
    const digital = database
      .prepare(
        `SELECT COALESCE(SUM(amount_cents), 0) AS total
         FROM payments
         WHERE order_id = ? AND status = 'paid' AND method != 'cash'
           AND provider = 'pey' AND demo = 0`,
      )
      .get(order.id) as { total: number };
    if (Number(digital.total) !== expected) {
      return rejected(
        "amount_mismatch",
        `Los pagos de pey no cuadran con el monto digital de la orden (${Number(
          digital.total,
        )} vs ${expected} centavos).`,
      );
    }
    if (
      order.paymentLinkId &&
      local.payment_link_id &&
      local.payment_link_id !== order.paymentLinkId
    ) {
      return rejected(
        "reference_mismatch",
        "La transacción pertenece a otro link de pago.",
      );
    }

    return Response.json({
      verified: true,
      source: "local",
      transactionId: local.transaction_id,
      orderId: local.order_id,
      method: local.method,
      amountCents: Number(local.amount_cents),
      createdAt: local.created_at,
    });
  }

  if (isDemoMode()) {
    return rejected(
      "not_found",
      "Ese comprobante no corresponde a un pago confirmado por Mercado Cero.",
    );
  }

  try {
    const transaction = await getPeyTransaction(transactionId);
    if (!transaction) {
      return rejected(
        "not_found",
        "pey no reconoce esa transacción para esta cuenta.",
      );
    }
    if (transaction.status !== "PAID") {
      return Response.json({
        verified: false,
        reason: "not_paid",
        message: "La transacción existe, pero no está pagada.",
        transaction,
      });
    }
    if (transaction.currency && transaction.currency.toUpperCase() !== "MXN") {
      return rejected(
        "currency_mismatch",
        `La transacción está en ${transaction.currency}, no en MXN.`,
      );
    }

    const amountCents = transactionBaseCents(transaction);
    const expected = expectedDigitalCents(order);
    if (amountCents === null || amountCents !== expected) {
      return Response.json({
        verified: false,
        reason: "amount_mismatch",
        message: `El monto de pey no coincide con la orden (${amountCents ?? 0} vs ${expected} centavos).`,
        transaction,
      });
    }

    if (hasReferenceMismatch(order, transaction)) {
      return Response.json({
        verified: false,
        reason: "reference_mismatch",
        message: "La transacción de pey pertenece a otro pedido, link o QR.",
        transaction,
      });
    }

    return Response.json({
      verified: true,
      source: "pey",
      transactionId: transaction.id,
      orderId: order.id,
      amountCents,
      method: mapPeyMethod(transaction.paymentMethod),
      transaction,
    });
  } catch (error) {
    console.error("[verify] no se pudo consultar pey", error);
    return Response.json(
      {
        verified: false,
        reason: "error",
        message: "No se pudo verificar el comprobante en este momento.",
      },
      { status: 502 },
    );
  }
}

function hasReferenceMismatch(
  order: Order,
  transaction: PeyTransaction,
): boolean {
  const metadata = isRecord(transaction.metadata) ? transaction.metadata : {};
  const externalMetadata = isRecord(metadata.externalMetadata)
    ? metadata.externalMetadata
    : {};
  const metadataOrderId =
    identifier(metadata.orderId) || identifier(externalMetadata.orderId);
  if (metadataOrderId && metadataOrderId !== order.id) return true;

  const clientReferenceId = identifier(
    (transaction as Record<string, unknown>).clientReferenceId,
  );
  if (clientReferenceId && clientReferenceId !== order.id) return true;

  const payableId = identifier(transaction.payableId);
  // Una transacción PAID sin ninguna referencia no está atada a esta orden:
  // que el monto coincida no basta para entregar.
  if (!metadataOrderId && !clientReferenceId && !payableId) return true;

  if (transaction.payableType === "PAYMENT_LINK") {
    if (!order.paymentLinkId) return true;
    if (payableId && payableId !== order.paymentLinkId) return true;
  } else if (transaction.payableType === "API_CODI_QR") {
    if (!order.qrId) return true;
    if (payableId && payableId !== order.qrId) return true;
  } else if (
    payableId &&
    payableId !== order.paymentLinkId &&
    payableId !== order.qrId
  ) {
    return true;
  }

  return false;
}
