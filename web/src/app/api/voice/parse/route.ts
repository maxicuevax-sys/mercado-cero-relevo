import { parseSale } from "@/lib/voice";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { transcript?: string };
    const transcript = body.transcript?.trim();

    if (!transcript) {
      return Response.json({ error: "Falta la transcripción." }, { status: 400 });
    }

    const parsed = await parseSale(transcript);
    return Response.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo interpretar la venta.";
    return Response.json({ error: message }, { status: 500 });
  }
}
