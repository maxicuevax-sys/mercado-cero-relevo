import { getAnalytics } from "@/lib/analytics";
import type { AnalyticsPeriod } from "@/lib/types";

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("period");
  const period: AnalyticsPeriod =
    requested === "week" || requested === "month" ? requested : "today";

  try {
    return Response.json(getAnalytics(period));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo calcular el resumen.";
    return Response.json({ error: message }, { status: 500 });
  }
}
