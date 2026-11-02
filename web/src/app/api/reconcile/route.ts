import { getReconciliationReport } from "@/lib/reconcile";

export async function GET() {
  try {
    return Response.json(await getReconciliationReport(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo conciliar la caja.";
    return Response.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
