import crypto from "node:crypto";
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
  snapshot_known: number;
  reason: string | null;
  request_id: string | null;
  created_at: string;
}

export interface CashCloseAmounts {
  openingCents: number;
  expensesCents: number;
  withdrawalsCents: number;
  countedCents: number;
  baseNextCents: number;
}

export interface CashCloseInput extends CashCloseAmounts {
  reason?: string | null;
  requestId?: string | null;
  /** Versión que el cliente cree vigente; 0 si es el primer corte. */
  expectedVersion: number;
  /** Huella del preview que la persona revisó. */
  previewFingerprint?: string | null;
}

export class CashCloseError extends Error {
  code: string;
  status: number;
  currentVersion?: number;
  currentFingerprint?: string;

  constructor(
    code: string,
    message: string,
    status = 400,
    currentVersion?: number,
    currentFingerprint?: string,
  ) {
    super(message);
    this.name = "CashCloseError";
    this.code = code;
    this.status = status;
    this.currentVersion = currentVersion;
    this.currentFingerprint = currentFingerprint;
  }
}

/**
 * Huella de los totales vivos que sostienen el preview. Si entra una venta o
 * un abono entre preview y guardado, cambia y el cierre se rechaza.
 */
function totalsFingerprint(
  cashSalesCents: number,
  cashCreditCents: number,
  expectedCents: number,
): string {
  return crypto
    .createHash("sha256")
    .update(`${cashSalesCents}:${cashCreditCents}:${expectedCents}`)
    .digest("hex")
    .slice(0, 16);
}

function assertExpectedNotNegative(
  openingCents: number,
  cashSalesCents: number,
  cashCreditCents: number,
  expensesCents: number,
  withdrawalsCents: number,
): void {
  const available = openingCents + cashSalesCents + cashCreditCents;
  const outgoing = expensesCents + withdrawalsCents;
  if (available < outgoing) {
    throw new CashCloseError(
      "expected_negative",
      `Gastos y retiros (${(outgoing / 100).toFixed(
        2,
      )}) superan la base inicial, las ventas y los abonos en efectivo (${(
        available / 100
      ).toFixed(2)}). Ajusta los montos: el corte no puede guardar un esperado negativo.`,
      400,
    );
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
    snapshotKnown: Boolean(row.snapshot_known),
    reason: row.reason ?? null,
    requestId: row.request_id ?? null,
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

/** Lectura por id: nunca devuelve “la última” después de un COMMIT ajeno. */
export function getCashCloseById(id: string): CashClose | null {
  const row = getDb()
    .prepare("SELECT * FROM cash_closes WHERE id = ?")
    .get(id) as unknown as CashCloseRow | undefined;
  return row ? mapClose(row) : null;
}

export function getCashCloseByRequestId(requestId: string): CashClose | null {
  const row = getDb()
    .prepare("SELECT * FROM cash_closes WHERE request_id = ?")
    .get(requestId) as unknown as CashCloseRow | undefined;
  return row ? mapClose(row) : null;
}

/**
 * Historial breve: las últimas 5 versiones más la versión 1. La primera no
 * desaparece aunque haya muchas correcciones.
 */
function listCashClosesForHistory(date: string): CashClose[] {
  const latest = listCashCloses(date, 5);
  const firstRow = getDb()
    .prepare(
      "SELECT * FROM cash_closes WHERE date = ? ORDER BY version ASC LIMIT 1",
    )
    .get(date) as unknown as CashCloseRow | undefined;
  if (!firstRow) return latest;
  const first = mapClose(firstRow);
  if (latest.some((item) => item.id === first.id)) return latest;
  return [...latest, first].sort((a, b) => b.version - a.version);
}

export function getCashStatus(): CashStatus {
  const database = getDb();
  const date = mexicoDateKey();
  const saved = getCashClose(date);
  const history = listCashClosesForHistory(date);

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

  // El efectivo demo nunca es efectivo real. Los abonos digitales tampoco
  // entran aquí, aunque su provider sea “declared”.
  const cashSales = database
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total
       FROM payments
       WHERE status IN ('paid', 'demo_paid') AND method = 'cash'
         AND provider != 'demo'
         AND date(created_at, '-6 hours') = ?`,
    )
    .get(date) as unknown as { total: number };

  const cashCredit = database
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total
       FROM credit_payments
       WHERE method = 'cash' AND provider != 'demo'
         AND date(created_at, '-6 hours') = ?`,
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
  input: CashCloseAmounts,
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
    fingerprint: totalsFingerprint(
      status.cashSalesCents,
      status.cashCreditCents,
      expectedCents,
    ),
  };
}

/**
 * Calcula la diferencia con los totales vivos del servidor sin escribir nada.
 * La UI muestra este número en la confirmación para no depender de una copia
 * local que pudo quedar vieja.
 */
export function previewCashClose(
  input: CashCloseAmounts,
): { status: CashStatus; preview: CashClosePreview; issues: Array<{ code: string; message: string }> } {
  const status = getCashStatus();
  const preview = computePreview(status, input);
  assertExpectedNotNegative(
    preview.openingCents,
    preview.cashSalesCents,
    preview.cashCreditCents,
    preview.expensesCents,
    preview.withdrawalsCents,
  );
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
  const requestId = (input.requestId ?? "").trim() || null;

  // Reintento con la misma llave: devuelve la fila ya creada.
  if (requestId) {
    const existingRequest = getCashCloseByRequestId(requestId);
    if (existingRequest) return existingRequest;
  }

  database.exec("BEGIN IMMEDIATE");
  let date = mexicoDateKey();
  let closeId = "";
  try {
    // Otra pestaña pudo insertar la misma llave entre la lectura y el lock.
    if (requestId) {
      const racedRequest = getCashCloseByRequestId(requestId);
      if (racedRequest) {
        database.exec("COMMIT");
        return racedRequest;
      }
    }

    // Dentro de la transacción se relee la última versión y los totales vivos.
    const status = getCashStatus();
    date = status.date;
    const existing = status.saved;
    const currentVersion = existing?.version ?? 0;
    const preview = computePreview(status, input);

    assertExpectedNotNegative(
      preview.openingCents,
      preview.cashSalesCents,
      preview.cashCreditCents,
      preview.expensesCents,
      preview.withdrawalsCents,
    );
    if (
      input.previewFingerprint &&
      input.previewFingerprint !== preview.fingerprint
    ) {
      throw new CashCloseError(
        "totals_changed",
        "Entraron ventas o abonos después del preview. Vuelve a revisar la diferencia antes de guardar; no se guardó nada.",
        409,
        currentVersion,
        preview.fingerprint,
      );
    }

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

    if (input.expectedVersion !== currentVersion) {
      throw new CashCloseError(
        "version_conflict",
        "Otro corte se guardó antes. Actualiza los totales y vuelve a intentar.",
        409,
        currentVersion,
      );
    }

    const version = currentVersion + 1;
    const summary = getDailySummary();
    closeId = newId("cash");

    database
      .prepare(
        `INSERT INTO cash_closes
         (id, date, version, opening_cents, cash_sales_cents, cash_credit_cents,
          expenses_cents, withdrawals_cents, expected_cents, counted_cents,
          difference_cents, base_next_cents, withdrawal_next_cents,
          snapshot_cash_cents, snapshot_credit_cents, snapshot_pending_digital_cents,
          snapshot_known, reason, request_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
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
        requestId,
        nowIso(),
      );

    audit("cash.close", "cash_close", closeId, {
      date,
      version,
      reason: existing ? cleanReason : null,
      requestId,
      expectedVersion: input.expectedVersion,
      countedCents: preview.countedCents,
      expectedCents: preview.expectedCents,
      differenceCents: preview.differenceCents,
      baseNextCents: preview.baseNextCents,
    });

    database.exec("COMMIT");
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // Si SQLite ya cerró la transacción, conservamos el error original.
    }
    throw error;
  }

  // Se lee por id, no “la última”: otra pestaña pudo crear una versión después.
  const saved = getCashCloseById(closeId);
  if (!saved) {
    throw new CashCloseError(
      "close_not_saved",
      "El corte se guardó pero no se pudo leer. Actualiza la caja.",
      500,
    );
  }
  return saved;
}
