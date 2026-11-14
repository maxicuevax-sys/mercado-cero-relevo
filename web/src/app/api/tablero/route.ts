import { withPilotRoute } from "../../../lib/auth/pilot-route";
import { isDemoMode } from "@/lib/config";
import { getDb, listOrdersBetween } from "@/lib/db";
import { listProducingOrders, listStallProducts, listTimelineEvents } from "@/lib/pulso-apply";
import { mexicoCityDayBounds } from "@/lib/stall-board";

async function GETImpl() {
  const day = mexicoCityDayBounds();
  const orders = listOrdersBetween(day.startIso, day.endIso);
  const ids = orders.map((order) => order.id);
  const database = getDb();
  return Response.json(
    {
      day: day.label,
      demo: isDemoMode(),
      orders,
      products: listStallProducts(database),
      events: listTimelineEvents(database, ids),
      producing: listProducingOrders(database, ids),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const GET = withPilotRoute(GETImpl);
