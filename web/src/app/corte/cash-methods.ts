import { isDemoMode } from "@/lib/config";
import { getDb } from "@/lib/db";
import { startOfMexicoDay } from "@/lib/time";

export interface DemoMethodTotals {
  methods: Record<string, number>;
  demoCents: number;
}

/**
 * Desglose por método de los cobros simulados del día. `getDailySummary`
 * los excluye de `methods` a propósito (nunca son dinero real), así que la
 * pantalla los lee aparte para poder mostrarlos con una nota honesta de demo.
 * Fuera de demo no toca la base.
 */
export function getDemoMethodTotals(): DemoMethodTotals {
  if (!isDemoMode()) return { methods: {}, demoCents: 0 };

  const database = getDb();
  const startIso = startOfMexicoDay(0).toISOString();
  const endIso = startOfMexicoDay(-1).toISOString();
  const methods: Record<string, number> = {};

  function add(method: string, cents: number) {
    if (!method || !Number.isFinite(cents)) return;
    methods[method] = (methods[method] ?? 0) + cents;
  }

  const payments = database
    .prepare(
      `SELECT method, amount_cents FROM payments
       WHERE status = 'paid'
         AND (provider = 'demo' OR demo = 1)
         AND created_at >= ? AND created_at < ?`,
    )
    .all(startIso, endIso) as unknown as Array<{
    method: string;
    amount_cents: number;
  }>;

  for (const payment of payments) {
    add(payment.method, Number(payment.amount_cents));
  }

  const creditPayments = database
    .prepare(
      `SELECT method, amount_cents FROM credit_payments
       WHERE (provider = 'demo' OR demo = 1)
         AND created_at >= ? AND created_at < ?`,
    )
    .all(startIso, endIso) as unknown as Array<{
    method: string;
    amount_cents: number;
  }>;

  for (const payment of creditPayments) {
    add(payment.method, Number(payment.amount_cents));
  }

  const demoCents = Object.values(methods).reduce(
    (sum, value) => sum + value,
    0,
  );

  return { methods, demoCents };
}
