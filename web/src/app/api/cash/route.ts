import { getCashStatus } from "@/lib/cash";
import { enforceRateLimit, internalErrorResponse } from "@/lib/http-security";

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, "cash-status", 120, 60_000);
  if (limited) return limited;

  try {
    return Response.json(getCashStatus());
  } catch (error) {
    return internalErrorResponse("cash status", error);
  }
}
