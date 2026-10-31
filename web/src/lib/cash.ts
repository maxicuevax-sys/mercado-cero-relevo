import { getDb, newId, nowIso } from "./db";
import { mexicoDateKey } from "./time";
import type { CashClose, CashStatus } from "./types";

interface CashCloseRow {
  id: string;
  date: string;
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
  created_at: string;
}

function mapClose(row: CashCloseRow): CashClose {
  return {
    id: row.id,
    date: row.date,
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
    createdAt: row.created_at,
  };
}

export function getCashClose(date: string): CashClose | null {
  const row = getDb()
    .prepare("SELECT * FROM cash_closes WHERE date = ?")
    .get(date) as unknown as CashCloseRow | undefined;
  return row ? mapClose(row) : null;
}

export function getCashStatus(): CashStatus {
  const database = getDb();
  const date = mexicoDateKey();
  const saved = getCashClose(date);

  const openingCents = saved
    ? saved.openingCents
    : (() => {
        const previous = database
          .prepare(
            "SELECT base_next_cents FROM cash_closes WHERE date < ? ORDER BY date DESC LIMIT 1",
          )
          .get(date) as unknown as { base_next_cents: number } | undefined;
        return Number(previous?.base_next_cents ?? 0);
      })();

  const cashSales = database
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total
       FROM payments
       WHERE status = 'paid' AND method = 'cash'
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
  };
}

export function closeCash(input: {
  openingCents: number;
  expensesCents: number;
  withdrawalsCents: number;
  countedCents: number;
  baseNextCents: number;
}): CashClose {
  const database = getDb();
  const status = getCashStatus();
  const date = status.date;

  const openingCents = Math.max(0, Math.round(input.openingCents));
  const expensesCents = Math.max(0, Math.round(input.expensesCents));
  const withdrawalsCents = Math.max(0, Math.round(input.withdrawalsCents));
  const countedCents = Math.max(0, Math.round(input.countedCents));
  const baseNextCents = Math.max(0, Math.round(input.baseNextCents));
  const expectedCents =
    openingCents + status.cashSalesCents + status.cashCreditCents - expensesCents - withdrawalsCents;
  const differenceCents = countedCents - expectedCents;
  const withdrawalNextCents = Math.max(0, countedCents - baseNextCents);
  const createdAt = nowIso();

  database
    .prepare(
      `INSERT INTO cash_closes
       (id, date, opening_cents, cash_sales_cents, cash_credit_cents, expenses_cents,
        withdrawals_cents, expected_cents, counted_cents, difference_cents,
        base_next_cents, withdrawal_next_cents, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         opening_cents = excluded.opening_cents,
         cash_sales_cents = excluded.cash_sales_cents,
         cash_credit_cents = excluded.cash_credit_cents,
         expenses_cents = excluded.expenses_cents,
         withdrawals_cents = excluded.withdrawals_cents,
         expected_cents = excluded.expected_cents,
         counted_cents = excluded.counted_cents,
         difference_cents = excluded.difference_cents,
         base_next_cents = excluded.base_next_cents,
         withdrawal_next_cents = excluded.withdrawal_next_cents,
         created_at = excluded.created_at`,
    )
    .run(
      newId("cash"),
      date,
      openingCents,
      status.cashSalesCents,
      status.cashCreditCents,
      expensesCents,
      withdrawalsCents,
      expectedCents,
      countedCents,
      differenceCents,
      baseNextCents,
      withdrawalNextCents,
      createdAt,
    );

  return getCashClose(date)!;
}
