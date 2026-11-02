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

interface ReconciledRow {
  item: ReconciliationItem;
  confirmedCents: number;
}

async function reconcileRow(
  row: PaymentRow,
  signal: AbortSignal,
): Promise<ReconciledRow> {
  const localCents = Number(row.amount_cents);
  const base = {
    orderId: row.order_id,
    transactionId: row.transaction_id,
    method: row.method,
    localCents,
    peyCents: null,
  } as const;

  if (row.provider !== "pey") {
    return {
      item: {
        ...base,
        status: "not_pey",
        reason: `El pago local es de ${row.provider}, no de pey.`,
      },
      confirmedCents: 0,
    };
  }

  if (!row.transaction_id) {
    return {
      item: {
        ...base,
        status: "missing_transaction_id",
        reason: "El pago no tiene transactionId.",
      },
      confirmedCents: 0,
    };
  }

  try {
    const transaction = await getPeyTransaction(row.transaction_id, signal);
    if (!transaction) {
      return {
        item: {
          ...base,
          status: "not_found",
          reason: "pey no reconoce esa transacción para esta cuenta.",
        },
        confirmedCents: 0,
      };
    }

    const peyCents = baseCents(transaction);
    const paid = transaction.status === "PAID";
    const reason = mismatchReason(row, transaction);
    if (reason) {
      return {
        item: {
          ...base,
          peyCents,
          status: paid ? "mismatch" : "not_paid",
          reason,
        },
        confirmedCents: paid ? peyCents : 0,
      };
    }
    return {
      item: { ...base, peyCents, status: "ok" },
      confirmedCents: paid ? peyCents : 0,
    };
  } catch (error) {
    return {
      item: {
        ...base,
        status: "error",
        reason: signal.aborted
          ? "Se agotó el tiempo al consultar pey."
          : error instanceof Error
            ? error.message
            : "No se pudo consultar pey.",
      },
      confirmedCents: 0,
    };
  }
}

function clampConcurrency(value: number | undefined): number {
  if (!Number.isFinite(value)) return 6;
  return Math.min(10, Math.max(5, Math.trunc(value as number)));
}

export interface ReconciliationOptions {
  signal?: AbortSignal;
  /** 5–10 consultas simultáneas a pey; el default es 6. */
  concurrency?: number;
  /** Corte global de la conciliación. */
  timeoutMs?: number;
}

/**
 * Compara los pagos digitales del día contra pey. Es solo lectura:
 * no corrige ni inventa pagos; reporta diferencias para que una persona decida.
 *
 * La conciliación no se ejecuta desde el dashboard: solo corre cuando la
 * comerciante abre esa tarjeta. Aun así, limita la concurrencia y aborta las
 * consultas colgadas para que una lentitud de pey no consuma el proceso.
 */
export async function getReconciliationReport(
  options: ReconciliationOptions = {},
): Promise<ReconciliationReport> {
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

  const concurrency = clampConcurrency(
    options.concurrency ??
      Number(process.env.RECONCILE_CONCURRENCY ?? 6),
  );
  const configuredTimeout = Number(
    process.env.RECONCILE_TIMEOUT_MS ?? 20_000,
  );
  const timeoutMs = Math.max(
    1_000,
    options.timeoutMs ??
      (Number.isFinite(configuredTimeout) ? configuredTimeout : 20_000),
  );
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error("reconcile timeout")),
    timeoutMs,
  );
  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;

  const results = new Array<ReconciledRow | undefined>(rows.length);
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= rows.length) return;
      results[index] = await reconcileRow(rows[index], signal);
    }
  };

  try {
    await Promise.all(
      Array.from(
        { length: Math.min(concurrency, Math.max(1, rows.length)) },
        worker,
      ),
    );
  } finally {
    clearTimeout(timeout);
  }

  const resolved = results.filter(
    (row): row is ReconciledRow => row !== undefined,
  );
  const items = resolved.map((row) => row.item);
  const peyConfirmedCents = resolved.reduce(
    (sum, row) => sum + row.confirmedCents,
    0,
  );
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
