import { MERCHANT, isDemoMode } from "@/lib/config";
import { getDailySummary, listCredits, listOrders, listPendingOrders } from "@/lib/db";

export async function GET() {
  return Response.json({
    merchant: MERCHANT,
    demoMode: isDemoMode(),
    summary: getDailySummary(),
    orders: listOrders(30),
    pendingOrders: listPendingOrders(50),
    credits: listCredits(),
  });
}
