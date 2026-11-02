import { audit, getDailySummary, getDb, newId, nowIso } from "./db";
import { mexicoDateKey } from "./time";
import type { CashClose, CashClosePreview, CashStatus } from "./types";

interface CashCloseRow {
  id: string;
  date: string;
  version: number;
  opening_cents: number;
  cash_sales_cents: number;
  cash_credit_cents: number;
  expenses_cents: number;
  withdrawals_cents: number;
  expected_cents: number;
  counted_cents: number;
  difference_cents: number;
  base_next_cents: number;
  withdrawal_next_cents: number;
  snapshot_cash_cents: number;
  snapshot_credit_cents: number;
  snapshot_pending_digital_cents: number;
  reason: string | null;
  created_at: string;
}

export interface CashCloseInput {
  openingCents: number;
  expensesCents: number;
  withdrawalsCents: number;
  countedCents: number;
  baseNextCents: number;
  reason?: string | null;
}

export class CashCloseError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "CashCloseError";
    this.code = code;
    this.status = status;
  }
}

function normalizeCents(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function mapClose(row: CashCloseRow): CashClose {
  return {
    id: row.id,
    date: row.date,
    version: Number(row.version),
    openingCents: Number(row.opening_cents),
    cashSalesCents: Number(row.cash_sales_cents),
    cashCreditCents: Number(row.cash_credit_cents),
    expensesCents: Number(row.expenses_cents),
    withdrawalsCents: Number(row.withdrawals_cents),
    expectedCents: Number(row.expected_cents),
    countedCents: Number(row.counted_cents),
    differenceCents: Number(row.difference_cents),
    baseNextCents: Number(row.base_next_cents),
    withdrawalNextCents: Number(row.withdrawal_next_cents),
    snapshotCashCents: Number(row.snapshot_cash_cents),
    snapshotCreditCents: Number(row.snapshot_credit_cents),
    snapshotPendingDigitalCents: Number(row.snapshot_pending_digital_cents),
    reason: row.reason ?? null,
    createdAt: row.created_at,
  };
}

export function listCashCloses(date: string, limit = 5): CashClose[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM cash_closes WHERE date = ? ORDER BY version DESC LIMIT ?",
    )
    .all(date, limit) as unknown as CashCloseRow[];
  return rows.map(mapClose);
}

/** Última versión del corte de una fecha. La versión 1 nunca se borra. */
export function getCashClose(date: string): CashClose | null {
  const row = getDb()
    .prepare(
      "SELECT * FROM cash_closes WHERE date = ? ORDER BY version DESC LIMIT 1",
    )
    .get(date) as unknown as CashCloseRow | undefined;
  return row ? mapClose(row) : null;
}

export function getCashStatus(): CashStatus {
  const database = getDb();
  const date = mexicoDateKey();
  const saved = getCashClose(date);
  const history = listCashCloses(date, 5);

  const openingCents = saved
    ? saved.openingCents
    : (() => {
        const previous = database
          .prepare(
            `SELECT base_next_cents FROM cash_closes
             WHERE date < ?
             ORDER BY date DESC, version DESC LIMIT 1`,
          )
          .get(date) as unknown as { base_next_cents: number } | undefined;
        return Number(previous?.base_next_cents ?? 0);
      })();

  const cashSales = database
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total
       FROM payments
       WHERE status IN ('paid', 'demo_paid') AND method = 'cash'
         AND date(created_at, '-6 hours') = ?`,
    )
    .get(date) as unknown as { total: number };

  const cashCredit = database
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total
       FROM credit_payments
       WHERE method = 'cash' AND date(created_at, '-6 hours') = ?`,
    )
    .get(date) as unknown as { total: number };

  const expensesCents = saved?.expensesCents ?? 0;
  const withdrawalsCents = saved?.withdrawalsCents ?? 0;
  const cashSalesCents = Number(cashSales.total);
  const cashCreditCents = Number(cashCredit.total);

  return {
    date,
    openingCents,
    cashSalesCents,
    cashCreditCents,
    expensesCents,
    withdrawalsCents,
    expectedCents:
      openingCents + cashSalesCents + cashCreditCents - expensesCents - withdrawalsCents,
    saved,
    history,
  };
}

function computePreview(
  status: CashStatus,
  input: Omit<CashCloseInput, "reason">,
): CashClosePreview {
  const openingCents = normalizeCents(input.openingCents);
  const expensesCents = normalizeCents(input.expensesCents);
  const withdrawalsCents = normalizeCents(input.withdrawalsCents);
  const countedCents = normalizeCents(input.countedCents);
  const baseNextCents = normalizeCents(input.baseNextCents);
  const expectedCents =
    openingCents +
    status.cashSalesCents +
    status.cashCreditCents -
    expensesCents -
    withdrawalsCents;

  return {
    openingCents,
    expensesCents,
    withdrawalsCents,
    countedCents,
    baseNextCents,
    cashSalesCents: status.cashSalesCents,
    cashCreditCents: status.cashCreditCents,
    expectedCents,
    differenceCents: countedCents - expectedCents,
    withdrawalNextCents: Math.max(0, countedCents - baseNextCents),
  };
}

/**
 * Calcula la diferencia con los totales vivos del servidor sin escribir nada.
 * La UI muestra este número en la confirmación para no depender de una copia
 * local que pudo quedar vieja.
 */
export function previewCashClose(
  input: Omit<CashCloseInput, "reason">,
): { status: CashStatus; preview: CashClosePreview; issues: Array<{ code: string; message: string }> } {
  const status = getCashStatus();
  const preview = computePreview(status, input);
  const issues: Array<{ code: string; message: string }> = [];

  if (preview.countedCents <= 0) {
    issues.push({
      code: "counted_required",
      message: "Escribe cuánto contaste. El total contado debe ser mayor que cero.",
    });
  }
  if (preview.baseNextCents > preview.countedCents) {
    issues.push({
      code: "base_exceeds_counted",
      message:
        "La base para mañana no puede ser mayor que el total contado. Baja la base o corrige el conteo.",
    });
  }

  return { status, preview, issues };
}

export function closeCash(input: CashCloseInput): CashClose {
  const database = getDb();
  const cleanReason = (input.reason ?? "").trim();

  database.exec("BEGIN IMMEDIATE");
  let date = mexicoDateKey();
  let closeId = "";
  try {
    // Dentro de la transacción se relee la última versión y los totales vivos.
    const status = getCashStatus();
    date = status.date;
    const existing = status.saved;
    const preview = computePreview(status, input);

    if (preview.countedCents <= 0) {
      throw new CashCloseError(
        "counted_required",
        "Escribe cuánto contaste. El total contado debe ser mayor que cero.",
      );
    }
    if (preview.baseNextCents > preview.countedCents) {
      throw new CashCloseError(
        "base_exceeds_counted",
        "La base para mañana no puede ser mayor que el total contado. Baja la base o corrige el conteo.",
      );
    }
    if (existing && !cleanReason) {
      throw new CashCloseError(
        "reason_required",
        "Escribe el motivo de la corrección antes de guardar otra versión del corte.",
      );
    }

    const version = (existing?.version ?? 0) + 1;
    const summary = getDailySummary();
    closeId = newId("cash");

    database
      .prepare(
        `INSERT INTO cash_closes
         (id, date, version, opening_cents, cash_sales_cents, cash_credit_cents,
          expenses_cents, withdrawals_cents, expected_cents, counted_cents,
          difference_cents, base_next_cents, withdrawal_next_cents,
          snapshot_cash_cents, snapshot_credit_cents, snapshot_pending_digital_cents,
          reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        closeId,
        date,
        version,
        preview.openingCents,
        status.cashSalesCents,
        status.cashCreditCents,
        preview.expensesCents,
        preview.withdrawalsCents,
        preview.expectedCents,
        preview.countedCents,
        preview.differenceCents,
        preview.baseNextCents,
        preview.withdrawalNextCents,
        status.cashSalesCents + status.cashCreditCents,
        summary.creditCents,
        summary.pendingCents,
        existing ? cleanReason : null,
        nowIso(),
      );

    audit("cash.close", "cash_close", closeId, {
      date,
      version,
      reason: existing ? cleanReason : null,
      countedCents: preview.countedCents,
      expectedCents: preview.expectedCents,
      differenceCents: preview.differenceCents,
      baseNextCents: preview.baseNextCents,
    });

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  const saved = getCashClose(date);
  if (!saved || saved.id !== closeId) {
    throw new CashCloseError(
      "close_not_saved",
      "El corte no se pudo leer después de guardarlo.",
      500,
    );
  }
  return saved;
}
