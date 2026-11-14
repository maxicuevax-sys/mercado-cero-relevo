import { withPilotRoute } from "../../../lib/auth/pilot-route";
import { isDemoMode } from "@/lib/config";
import { listOrdersBetween } from "@/lib/db";
import { mexicoCityDayBounds } from "@/lib/stall-board";

async function GETImpl() {
  const day = mexicoCityDayBounds();
  const orders = listOrdersBetween(day.startIso, day.endIso);
  return Response.json(
    { day: day.label, demo: isDemoMode(), orders },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const GET = withPilotRoute(GETImpl);
