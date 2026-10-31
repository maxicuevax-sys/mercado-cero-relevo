import { MERCHANT, isDemoMode } from "@/lib/config";
import { getDailySummary, listCredits, listOrders } from "@/lib/db";

export async function GET() {
  return Response.json({
    merchant: MERCHANT,
    demoMode: isDemoMode(),
    summary: getDailySummary(),
    orders: listOrders(30),
    credits: listCredits(),
  });
}
