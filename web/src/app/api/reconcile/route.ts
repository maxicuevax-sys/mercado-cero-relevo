import { enforceRateLimit, internalErrorResponse } from "@/lib/http-security";
import { getReconciliationReport } from "@/lib/reconcile";

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, "reconcile", 30, 60_000);
  if (limited) return limited;

  try {
    return Response.json(await getReconciliationReport());
  } catch (error) {
    return internalErrorResponse("reconcile", error);
  }
}
