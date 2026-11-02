import { getAnalytics } from "@/lib/analytics";
import { enforceRateLimit, internalErrorResponse } from "@/lib/http-security";
import type { AnalyticsPeriod } from "@/lib/types";

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, "analytics", 120, 60_000);
  if (limited) return limited;

  const requested = new URL(request.url).searchParams.get("period");
  const period: AnalyticsPeriod =
    requested === "week" || requested === "month" ? requested : "today";

  try {
    return Response.json(getAnalytics(period));
  } catch (error) {
    return internalErrorResponse("analytics", error);
  }
}
