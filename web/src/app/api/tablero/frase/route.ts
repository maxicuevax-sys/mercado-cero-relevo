import { withPilotRoute } from "../../../../lib/auth/pilot-route";
import { getDb } from "@/lib/db";
import {
  bodyErrorResponse,
  enforceRateLimit,
  isJsonObject,
  MAX_SMALL_JSON_BYTES,
  readJsonLimited,
} from "@/lib/http-security";
import { appErrorResponse, unexpectedResponse } from "@/lib/errors";
import { createOrder } from "@/lib/orders";
import { itemsFromPhrase } from "@/lib/phrase-order";
import { listStallProducts } from "@/lib/pulso-apply";

const MAX_PHRASE_CHARS = 200;

async function POSTImpl(request: Request) {
  const limited = enforceRateLimit(request, "tablero-frase", 30, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await readJsonLimited(request, MAX_SMALL_JSON_BYTES);
  } catch (error) {
    return bodyErrorResponse(error);
  }
  if (!isJsonObject(body)) {
    return Response.json(
      { error: "El cuerpo debe ser un objeto JSON.", code: "invalid_json" },
      { status: 400 },
    );
  }

  const phrase = typeof body.phrase === "string" ? body.phrase.trim() : "";
  if (!phrase) {
    return Response.json({ error: "Escribe el pedido." }, { status: 400 });
  }
  if (phrase.length > MAX_PHRASE_CHARS) {
    return Response.json({ error: "La frase es demasiado larga." }, { status: 413 });
  }

  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const products = listStallProducts(getDb());
  const interpreted = itemsFromPhrase(phrase, products);
  if (!interpreted.ok) {
    return Response.json({ error: interpreted.reply }, { status: 422 });
  }

  try {
    const order = createOrder({
      items: interpreted.items,
      cashCents: 0,
      creditCents: 0,
      requestId: requestId || null,
    });
    return Response.json(
      { order },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const known = appErrorResponse(error);
    if (known) return known;
    return unexpectedResponse(error, "No se pudo anotar el pedido.");
  }
}

export const POST = withPilotRoute(POSTImpl);
