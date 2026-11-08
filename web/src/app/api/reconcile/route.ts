import { withPilotRoute } from "../../../lib/auth/pilot-route";
import { enforceRateLimit, internalErrorResponse } from "@/lib/http-security";
import { getReconciliationReport } from "@/lib/reconcile";

async function GETImpl(request: Request) {
  const limited = enforceRateLimit(request, "reconcile", 30, 60_000);
  if (limited) return limited;

  try {
    return Response.json(await getReconciliationReport(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return internalErrorResponse("reconcile", error);
  }
}

export const GET = withPilotRoute(GETImpl);
