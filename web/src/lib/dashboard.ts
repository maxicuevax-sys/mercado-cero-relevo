import { MERCHANT, isDemoMode } from "@/lib/config";
import {
  countCredits,
  countOrders,
  countPendingOrders,
  getDailySummary,
  getOpenCreditTotals,
  listCredits,
  listOrders,
  listPendingOrders,
  sumPendingOrderBalances,
} from "@/lib/db";
import {
  DEFAULT_DASHBOARD_CREDITS_LIMIT,
  DEFAULT_DASHBOARD_ORDERS_LIMIT,
  DEFAULT_DASHBOARD_PENDING_LIMIT,
  MAX_DASHBOARD_CREDITS_LIMIT,
  MAX_DASHBOARD_ORDERS_LIMIT,
  MAX_DASHBOARD_PENDING_LIMIT,
  pageMeta,
  type PageMeta,
} from "@/lib/pagination";
import type { Credit, DailySummary, Order } from "@/lib/types";

/**
 * Límites de la primera pantalla. La API los parsea de la query; el servidor
 * usa los defaults para renderizar el mismo payload que pediría el cliente.
 */
export interface DashboardLimits {
  ordersLimit?: number;
  pendingLimit?: number;
  creditsLimit?: number;
  ordersOffset?: number;
  pendingOffset?: number;
  creditsOffset?: number;
  /**
   * Evita mandar dos veces los pedidos pendientes (una en `orders` y otra en
   * `pendingOrders`). La UI los vuelve a unir por id.
   */
  compactPending?: boolean;
}

export interface DashboardPagination {
  orders: PageMeta;
  pendingOrders: PageMeta;
  credits: PageMeta;
}

export interface DashboardData {
  merchant: typeof MERCHANT;
  demoMode: boolean;
  summary: DailySummary;
  orders: Order[];
  pendingOrders: Order[];
  credits: Credit[];
  pagination: DashboardPagination;
  creditsTotal: number;
  creditsHasMore: boolean;
  /** Saldo de todos los cobros pendientes, no solo de la página. */
  pendingCentsTotal: number;
  /** Fiado abierto en toda la base, no solo en la página visible. */
  creditsOpenTotal: number;
  creditsCustomersTotal: number;
  creditsBalanceCents: number;
}

function clampLimit(value: number | undefined, fallback: number, max: number) {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(1, Math.trunc(value)));
}

function clampOffset(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.min(1_000_000, Math.max(0, Math.trunc(value)));
}

/**
 * Fuente única del dashboard para `/api/dashboard` y para el render del
 * servidor de `/`. No cachea: la caja es dato vivo y `connection()` decide
 * cuándo se ejecuta.
 */
export function getDashboardData(
  limits: DashboardLimits = {},
): DashboardData {
  const ordersLimit = clampLimit(
    limits.ordersLimit,
    DEFAULT_DASHBOARD_ORDERS_LIMIT,
    MAX_DASHBOARD_ORDERS_LIMIT,
  );
  const pendingLimit = clampLimit(
    limits.pendingLimit,
    DEFAULT_DASHBOARD_PENDING_LIMIT,
    MAX_DASHBOARD_PENDING_LIMIT,
  );
  const creditsLimit = clampLimit(
    limits.creditsLimit,
    DEFAULT_DASHBOARD_CREDITS_LIMIT,
    MAX_DASHBOARD_CREDITS_LIMIT,
  );
  const ordersOffset = clampOffset(limits.ordersOffset);
  const pendingOffset = clampOffset(limits.pendingOffset);
  const creditsOffset = clampOffset(limits.creditsOffset);

  const recentOrders = listOrders(ordersLimit, ordersOffset);
  const pendingOrders = listPendingOrders(pendingLimit, pendingOffset);
  const pendingIds = new Set(pendingOrders.map((order) => order.id));
  const orders = limits.compactPending
    ? recentOrders.filter((order) => !pendingIds.has(order.id))
    : recentOrders;
  const credits = listCredits(creditsLimit, creditsOffset);
  const ordersTotal = countOrders();
  const pendingTotal = countPendingOrders();
  const pendingCentsTotal = sumPendingOrderBalances();
  const creditsTotal = countCredits();
  const openCredits = getOpenCreditTotals();

  return {
    merchant: MERCHANT,
    demoMode: isDemoMode(),
    summary: getDailySummary(),
    orders,
    pendingOrders,
    credits,
    pagination: {
      orders: pageMeta(ordersLimit, ordersOffset, orders.length, ordersTotal),
      pendingOrders: pageMeta(
        pendingLimit,
        pendingOffset,
        pendingOrders.length,
        pendingTotal,
      ),
      credits: pageMeta(
        creditsLimit,
        creditsOffset,
        credits.length,
        creditsTotal,
      ),
    },
    creditsTotal,
    creditsHasMore: creditsOffset + credits.length < creditsTotal,
    pendingCentsTotal,
    creditsOpenTotal: openCredits.count,
    creditsCustomersTotal: openCredits.customers,
    creditsBalanceCents: openCredits.balanceCents,
  };
}
