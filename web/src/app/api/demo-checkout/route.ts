import { z } from "zod";
import { runDemoCheckout, readDemoCheckout } from "@/lib/auth/demo-checkout";
import { InvalidDemoCheckout } from "@/lib/auth/demo-checkout-capability";
import { recordDemoPayment } from "@/lib/demo-payments";
import { appErrorResponse } from "@/lib/errors";
import { bodyErrorResponse, enforceRateLimit, isSameOriginMutation, MAX_SMALL_JSON_BYTES, readJsonLimited } from "@/lib/http-security";
import { captureUnexpectedError } from "@/lib/observability/capture-unexpected";

const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };
const bodySchema = z.object({ method: z.enum(["codi", "card", "wallet"]) }).strict();
const unavailable = () => Response.json({ error: "Este cobro demo no está disponible o venció." }, { status: 404, headers });
function privateResponse(response: Response) {
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  return response;
}
function failure(error: unknown) {
  if (error instanceof InvalidDemoCheckout) return unavailable();
  captureUnexpectedError(error);
  // The capability and decrypted account are never sent to observability/logs.
  return Response.json({ error: "No se pudo consultar este cobro. Intenta de nuevo." }, { status: 503, headers });
}
export async function GET(request: Request) {
  const limited = enforceRateLimit(request, "demo-checkout-read", 90, 60_000);
  if (limited) return privateResponse(limited);
  try {
    const data = await runDemoCheckout(request.headers.get("X-Trangui-Demo-Checkout") ?? "", readDemoCheckout);
    return Response.json(data, { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return Response.json({ error: "Origen no permitido." }, { status: 403, headers });
  const limited = enforceRateLimit(request, "demo-checkout-pay", 15, 60_000);
  if (limited) return privateResponse(limited);
  let body: unknown;
  try { body = await readJsonLimited(request, MAX_SMALL_JSON_BYTES); }
  catch (error) { return privateResponse(bodyErrorResponse(error)); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Elige CoDi, tarjeta o wallet para la simulación." }, { status: 400, headers });
  try {
    const data = await runDemoCheckout(request.headers.get("X-Trangui-Demo-Checkout") ?? "", orderId => {
      recordDemoPayment({ orderId, method: parsed.data.method });
      return readDemoCheckout(orderId);
    });
    return Response.json(data, { headers });
  } catch (error) {
    if (error instanceof InvalidDemoCheckout) return unavailable();
    const known = appErrorResponse(error);
    if (known) {
      return privateResponse(known);
    }
    return failure(error);
  }
}
