import { withPilotRoute } from "../../../lib/auth/pilot-route";
import { getCashStatus } from "@/lib/cash";
import { enforceRateLimit, internalErrorResponse } from "@/lib/http-security";

async function GETImpl(request: Request) {
  const limited = enforceRateLimit(request, "cash-status", 120, 60_000);
  if (limited) return limited;

  try {
    return Response.json(getCashStatus());
  } catch (error) {
    return internalErrorResponse("cash status", error);
  }
}

export const GET = withPilotRoute(GETImpl);
