import { withPilotRoute } from "../../../lib/auth/pilot-route";
import { connection } from "next/server";
import { getAnalytics } from "@/lib/analytics";
import { cachedJson } from "@/lib/http-cache";
import { enforceRateLimit, internalErrorResponse } from "@/lib/http-security";
import type { AnalyticsPeriod } from "@/lib/types";

async function GETImpl(request: Request) {
  const limited = enforceRateLimit(request, "analytics", 120, 60_000);
  if (limited) return limited;
  await connection();
  const requested = new URL(request.url).searchParams.get("period");
  const period: AnalyticsPeriod =
    requested === "week" || requested === "month" ? requested : "today";

  try {
    return await cachedJson(request, getAnalytics(period), "analytics");
  } catch (error) {
    return internalErrorResponse("analytics", error);
  }
}

export const GET = withPilotRoute(GETImpl);
