import { isDemoMode } from "@/lib/config";
import { resetDemoData } from "@/lib/db";

export async function POST() {
  if (!isDemoMode()) {
    return Response.json({ error: "El modo demo está desactivado." }, { status: 403 });
  }
  resetDemoData();
  return Response.json({ ok: true });
}
