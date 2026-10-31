import { getDb } from "./db";
import { mexicoDateKey, startOfMexicoDay } from "./time";
import type {
  AnalyticsPeriod,
  AnalyticsPoint,
  AnalyticsReport,
  OrderStatus,
} from "./types";

interface OrderRow {
  id: string;
  total_cents: number;
  paid_cents: number;
  credit_cents: number;
  status: OrderStatus;
  created_at: string;
}

function periodRange(period: AnalyticsPeriod): {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  label: string;
} {
  const end = new Date();
  if (period === "today") {
    return {
      start: startOfMexicoDay(0),
      end,
      previousStart: startOfMexicoDay(1),
      previousEnd: startOfMexicoDay(0),
      label: "Hoy",
    };
  }
  if (period === "week") {
    return {
      start: startOfMexicoDay(6),
      end,
      previousStart: startOfMexicoDay(13),
      previousEnd: startOfMexicoDay(6),
      label: "Últimos 7 días",
    };
  }
  return {
    start: startOfMexicoDay(29),
    end,
    previousStart: startOfMexicoDay(59),
    previousEnd: startOfMexicoDay(29),
    label: "Últimos 30 días",
  };
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function orderRows(startIso: string, endIso: string): OrderRow[] {
  return getDb()
    .prepare(
      `SELECT id, total_cents, paid_cents, credit_cents, status, created_at
       FROM orders
       WHERE created_at >= ? AND created_at < ? AND status != 'cancelled'`,
    )
    .all(startIso, endIso) as unknown as OrderRow[];
}

function salesOf(rows: OrderRow[]): number {
  return rows.reduce((sum, row) => sum + Number(row.total_cents), 0);
}

function seriesFor(
  period: AnalyticsPeriod,
  endIso: string,
): AnalyticsPoint[] {
  const days = period === "month" ? 30 : 7;
  const start = startOfMexicoDay(days - 1);
  const rows = getDb()
    .prepare(
      `SELECT date(created_at, '-6 hours') AS day,
              COALESCE(SUM(total_cents), 0) AS sales,
              COUNT(*) AS orders
       FROM orders
       WHERE created_at >= ? AND created_at < ? AND status != 'cancelled'
       GROUP BY day
       ORDER BY day ASC`,
    )
    .all(start.toISOString(), endIso) as unknown as Array<{
    day: string;
    sales: number;
    orders: number;
  }>;

  const byDay = new Map(rows.map((row) => [row.day, row]));
  const points: AnalyticsPoint[] = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = startOfMexicoDay(index);
    const key = mexicoDateKey(date);
    const row = byDay.get(key);
    points.push({
      date: key,
      salesCents: Number(row?.sales ?? 0),
      orders: Number(row?.orders ?? 0),
    });
  }
  return points;
}

export function getAnalytics(period: AnalyticsPeriod): AnalyticsReport {
  const range = periodRange(period);
  const startIso = range.start.toISOString();
  const endIso = range.end.toISOString();
  const previousStartIso = range.previousStart.toISOString();
  const previousEndIso = range.previousEnd.toISOString();

  const current = orderRows(startIso, endIso);
  const previous = orderRows(previousStartIso, previousEndIso);

  const salesCents = salesOf(current);
  const previousSalesCents = salesOf(previous);
  const orderCount = current.length;
  const paidOrderCount = current.filter(
    (row) => row.status === "paid" || row.status === "fulfilled",
  ).length;
  const pendingCents = current.reduce(
    (sum, row) =>
      sum +
      Math.max(
        Number(row.total_cents) - Number(row.paid_cents) - Number(row.credit_cents),
        0,
      ),
    0,
  );

  const payments = getDb()
    .prepare(
      `SELECT p.method, p.amount_cents
       FROM payments p JOIN orders o ON o.id = p.order_id
       WHERE p.status = 'paid'
         AND o.created_at >= ? AND o.created_at < ?
         AND o.status != 'cancelled'`,
    )
    .all(startIso, endIso) as unknown as Array<{
    method: string;
    amount_cents: number;
  }>;

  let cashCents = 0;
  let digitalCents = 0;
  const methods: Record<string, number> = {};
  for (const payment of payments) {
    const amount = Number(payment.amount_cents);
    methods[payment.method] = (methods[payment.method] ?? 0) + amount;
    if (payment.method === "cash") cashCents += amount;
    else digitalCents += amount;
  }

  const creditRow = getDb()
    .prepare(
      "SELECT COALESCE(SUM(balance_cents), 0) AS total FROM credits WHERE status != 'settled'",
    )
    .get() as unknown as { total: number };

  const series = seriesFor(period, endIso);
  const todayPoint = series[series.length - 1] ?? null;
  const bestDay =
    period === "today"
      ? todayPoint && todayPoint.salesCents > 0
        ? todayPoint
        : null
      : (series
          .filter((point) => point.salesCents > 0)
          .sort((a, b) => b.salesCents - a.salesCents)[0] ?? null);

  const bestHourRow = getDb()
    .prepare(
      `SELECT CAST(strftime('%H', created_at, '-6 hours') AS INTEGER) AS hour,
              COUNT(*) AS n
       FROM orders
       WHERE created_at >= ? AND created_at < ? AND status != 'cancelled'
       GROUP BY hour
       ORDER BY n DESC, hour ASC
       LIMIT 1`,
    )
    .get(startIso, endIso) as unknown as { hour: number; n: number } | undefined;

  return {
    period,
    label: range.label,
    start: startIso,
    end: endIso,
    salesCents,
    collectedCents: payments.reduce(
      (sum, payment) => sum + Number(payment.amount_cents),
      0,
    ),
    pendingCents,
    creditCents: Number(creditRow.total),
    orderCount,
    paidOrderCount,
    averageTicketCents: orderCount > 0 ? Math.round(salesCents / orderCount) : 0,
    cashCents,
    digitalCents,
    methods,
    comparison: {
      salesCents: previousSalesCents,
      orderCount: previous.length,
      salesChangePct: pctChange(salesCents, previousSalesCents),
      ordersChangePct: pctChange(orderCount, previous.length),
    },
    series,
    bestDay,
    bestHour: bestHourRow ? Number(bestHourRow.hour) : null,
  };
}
