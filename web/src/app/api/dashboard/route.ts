import { connection } from "next/server";
import { MERCHANT, isDemoMode } from "@/lib/config";
import {
  countCredits,
  countOrders,
  countPendingOrders,
  getDailySummary,
  listCredits,
  listOrders,
  listPendingOrders,
} from "@/lib/db";
import { cachedJson } from "@/lib/http-cache";
import {
  DEFAULT_DASHBOARD_CREDITS_LIMIT,
  DEFAULT_DASHBOARD_ORDERS_LIMIT,
  DEFAULT_DASHBOARD_PENDING_LIMIT,
  MAX_DASHBOARD_CREDITS_LIMIT,
  MAX_DASHBOARD_ORDERS_LIMIT,
  MAX_DASHBOARD_PENDING_LIMIT,
  pageMeta,
  parseNamedLimit,
  parseNamedOffset,
} from "@/lib/pagination";

export async function GET(request: Request) {
  // La caja es dato vivo: nunca un snapshot de build.
  await connection();
  const params = new URL(request.url).searchParams;
  const ordersLimit = parseNamedLimit(
    params,
    "ordersLimit",
    DEFAULT_DASHBOARD_ORDERS_LIMIT,
    MAX_DASHBOARD_ORDERS_LIMIT,
  );
  const pendingLimit = parseNamedLimit(
    params,
    "pendingLimit",
    DEFAULT_DASHBOARD_PENDING_LIMIT,
    MAX_DASHBOARD_PENDING_LIMIT,
  );
  const creditsLimit = parseNamedLimit(
    params,
    "creditsLimit",
    DEFAULT_DASHBOARD_CREDITS_LIMIT,
    MAX_DASHBOARD_CREDITS_LIMIT,
  );
  const ordersOffset = parseNamedOffset(params, "ordersOffset");
  const pendingOffset = parseNamedOffset(params, "pendingOffset");
  const creditsOffset = parseNamedOffset(params, "creditsOffset");

  const orders = listOrders(ordersLimit, ordersOffset);
  const pendingOrders = listPendingOrders(pendingLimit, pendingOffset);
  const credits = listCredits(creditsLimit, creditsOffset);
  const ordersTotal = countOrders();
  const pendingTotal = countPendingOrders();
  const creditsTotal = countCredits();

  return await cachedJson(
    request,
    {
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
    },
    "dashboard",
  );
}
