import { getCashStatus } from "@/lib/cash";

export async function GET() {
  try {
    return Response.json(getCashStatus());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo leer la caja.";
    return Response.json({ error: message }, { status: 500 });
  }
}
