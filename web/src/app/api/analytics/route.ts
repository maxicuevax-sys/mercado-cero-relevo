import { connection } from "next/server";
import { getAnalytics } from "@/lib/analytics";
import { cachedJson } from "@/lib/http-cache";
import type { AnalyticsPeriod } from "@/lib/types";

export async function GET(request: Request) {
  await connection();
  const requested = new URL(request.url).searchParams.get("period");
  const period: AnalyticsPeriod =
    requested === "week" || requested === "month" ? requested : "today";

  try {
    return await cachedJson(request, getAnalytics(period), "analytics");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo calcular el resumen.";
    return Response.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
