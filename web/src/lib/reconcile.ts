import { isDemoMode } from "./config";
import { getDb } from "./db";
import { getPeyTransaction, type PeyTransaction } from "./pey";
import { mexicoDateKey, startOfMexicoDay } from "./time";
import type { ReconciliationItem, ReconciliationReport } from "./types";

interface PaymentRow {
  order_id: string;
  transaction_id: string | null;
  method: string;
  amount_cents: number;
  provider: string;
  payment_link_id: string | null;
  qr_id: string | null;
}

function startOfTodayIso(): string {
  return startOfMexicoDay(0).toISOString();
}

function baseCents(transaction: PeyTransaction): number {
  const base = transaction.amountBreakdown?.base;
  const amount = base !== undefined && base !== null ? base : transaction.amount;
  return Math.round(Number(amount) * 100);
}

function methodMatches(local: string, peyMethod?: string): boolean {
  const method = (peyMethod ?? "").toUpperCase();
  if (local === "codi") return method.includes("CODI");
  if (local === "card" || local === "wallet") {
    return method.includes("CARD") || method.includes("CREDIT") || method.includes("DEBIT");
  }
  // `unknown` no afirma un método: se compara solo contra monto/estado.
  return true;
}

function mismatchReason(local: PaymentRow, transaction: PeyTransaction): string | null {
  if (transaction.status !== "PAID") {
    return `pey reporta ${transaction.status}, no PAID.`;
  }
  if (transaction.currency && transaction.currency.toUpperCase() !== "MXN") {
    return `Moneda ${transaction.currency}, no MXN.`;
  }

  const peyCents = baseCents(transaction);
  if (peyCents !== Number(local.amount_cents)) {
    return `Monto distinto: local ${local.amount_cents} vs pey ${peyCents} centavos.`;
  }
  if (!methodMatches(local.method, transaction.paymentMethod)) {
    return `Método distinto: local ${local.method} vs pey ${transaction.paymentMethod ?? "desconocido"}.`;
  }
  if (
    transaction.payableType === "PAYMENT_LINK" &&
    local.payment_link_id &&
    transaction.payableId &&
    transaction.payableId !== local.payment_link_id
  ) {
    return "La transacción pertenece a otro link de pago.";
  }
  if (
    transaction.payableType === "API_CODI_QR" &&
    local.qr_id &&
    transaction.payableId &&
    transaction.payableId !== local.qr_id
  ) {
    return "La transacción pertenece a otro QR CoDi.";
  }

  return null;
}

/**
 * Compara los pagos digitales del día contra pey. Es solo lectura:
 * no corrige ni inventa pagos; reporta diferencias para que una persona decida.
 */
export async function getReconciliationReport(): Promise<ReconciliationReport> {
  const startIso = startOfTodayIso();
  const date = mexicoDateKey();
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT p.order_id, p.transaction_id, p.method, p.amount_cents, p.provider,
              o.payment_link_id, o.qr_id
       FROM payments p JOIN orders o ON o.id = p.order_id
       WHERE p.status = 'paid' AND p.method != 'cash'
         AND p.provider != 'demo'
         AND p.created_at >= ?
       ORDER BY p.created_at ASC`,
    )
    .all(startIso) as unknown as PaymentRow[];

  const localDigitalCents = rows.reduce(
    (sum, row) => sum + Number(row.amount_cents),
    0,
  );

  if (isDemoMode()) {
    return {
      date,
      demoMode: true,
      reconciled: null,
      localDigitalCents,
      peyConfirmedCents: 0,
      differenceCents: 0,
      checked: 0,
      ok: 0,
      issues: 0,
      items: [],
    };
  }

  const items: ReconciliationItem[] = [];
  let peyConfirmedCents = 0;

  for (const row of rows) {
    const localCents = Number(row.amount_cents);

    if (row.provider !== "pey") {
      items.push({
        orderId: row.order_id,
        transactionId: row.transaction_id,
        method: row.method,
        localCents,
        peyCents: null,
        status: "not_pey",
        reason: `El pago local es de ${row.provider}, no de pey.`,
      });
      continue;
    }

    if (!row.transaction_id) {
      items.push({
        orderId: row.order_id,
        transactionId: null,
        method: row.method,
        localCents,
        peyCents: null,
        status: "missing_transaction_id",
        reason: "El pago no tiene transactionId.",
      });
      continue;
    }

    try {
      const transaction = await getPeyTransaction(row.transaction_id);
      if (!transaction) {
        items.push({
          orderId: row.order_id,
          transactionId: row.transaction_id,
          method: row.method,
          localCents,
          peyCents: null,
          status: "not_found",
          reason: "pey no reconoce esa transacción para esta cuenta.",
        });
        continue;
      }

      const peyCents = baseCents(transaction);
      const paid = transaction.status === "PAID";
      if (paid) peyConfirmedCents += peyCents;

      const reason = mismatchReason(row, transaction);
      if (reason) {
        items.push({
          orderId: row.order_id,
          transactionId: row.transaction_id,
          method: row.method,
          localCents,
          peyCents,
          status: paid ? "mismatch" : "not_paid",
          reason,
        });
      } else {
        items.push({
          orderId: row.order_id,
          transactionId: row.transaction_id,
          method: row.method,
          localCents,
          peyCents,
          status: "ok",
        });
      }
    } catch (error) {
      items.push({
        orderId: row.order_id,
        transactionId: row.transaction_id,
        method: row.method,
        localCents,
        peyCents: null,
        status: "error",
        reason:
          error instanceof Error ? error.message : "No se pudo consultar pey.",
      });
    }
  }

  const issues = items.filter((item) => item.status !== "ok").length;
  const differenceCents = localDigitalCents - peyConfirmedCents;

  return {
    date,
    demoMode: false,
    reconciled: issues === 0 && differenceCents === 0,
    localDigitalCents,
    peyConfirmedCents,
    differenceCents,
    checked: items.length,
    ok: items.length - issues,
    issues,
    items,
  };
}
