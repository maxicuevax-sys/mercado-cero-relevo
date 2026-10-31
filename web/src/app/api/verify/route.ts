import { isDemoMode } from "@/lib/config";
import { getDb } from "@/lib/db";
import { getPeyTransaction } from "@/lib/pey";

export async function GET(request: Request) {
  const transactionId = new URL(request.url).searchParams.get("transactionId")?.trim();
  if (!transactionId) {
    return Response.json({ error: "Falta transactionId." }, { status: 400 });
  }

  const database = getDb();
  const local = database
    .prepare(
      `SELECT p.id, p.order_id, p.method, p.amount_cents, p.transaction_id, p.created_at
       FROM payments p
       WHERE p.transaction_id = ? AND p.status = 'paid'
       LIMIT 1`,
    )
    .get(transactionId) as
    | {
        id: string;
        order_id: string;
        method: string;
        amount_cents: number;
        transaction_id: string;
        created_at: string;
      }
    | undefined;

  if (local) {
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
    return Response.json({
      verified: false,
      reason: "not_found",
      message: "Ese comprobante no corresponde a un pago confirmado por Mercado Cero.",
    });
  }

  try {
    const transaction = await getPeyTransaction(transactionId);
    if (!transaction) {
      return Response.json({
        verified: false,
        reason: "not_found",
        message: "pey no reconoce esa transacción para esta cuenta.",
      });
    }

    if (transaction.status !== "PAID") {
      return Response.json({
        verified: false,
        reason: "not_paid",
        message: "La transacción existe, pero no está pagada.",
        transaction,
      });
    }

    return Response.json({
      verified: true,
      source: "pey",
      transactionId: transaction.id,
      amountCents: Math.round(Number(transaction.amount) * 100),
      method: transaction.paymentMethod ?? null,
      transaction,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo verificar el comprobante.";
    return Response.json({ verified: false, reason: "error", message }, { status: 502 });
  }
}
