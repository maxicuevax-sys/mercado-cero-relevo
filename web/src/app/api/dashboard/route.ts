import { connection } from "next/server";
import { getDashboardData } from "@/lib/dashboard";
import { cachedJson } from "@/lib/http-cache";
import {
  DEFAULT_DASHBOARD_CREDITS_LIMIT,
  DEFAULT_DASHBOARD_ORDERS_LIMIT,
  DEFAULT_DASHBOARD_PENDING_LIMIT,
  MAX_DASHBOARD_CREDITS_LIMIT,
  MAX_DASHBOARD_ORDERS_LIMIT,
  MAX_DASHBOARD_PENDING_LIMIT,
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

  const dashboard = getDashboardData({
    ordersLimit,
    pendingLimit,
    creditsLimit,
    ordersOffset,
    pendingOffset,
    creditsOffset,
  });

  return await cachedJson(request, dashboard, "dashboard");
}
