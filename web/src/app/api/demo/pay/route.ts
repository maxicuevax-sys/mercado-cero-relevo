import { z } from "zod";
import { isDemoMode } from "@/lib/config";
import { recordDemoPayment } from "@/lib/demo-payments";
import { appErrorResponse, ValidationError } from "@/lib/errors";
import {
  bodyErrorResponse,
  enforceRateLimit,
  internalErrorResponse,
  isJsonObject,
  MAX_SMALL_JSON_BYTES,
  readJsonLimited,
} from "@/lib/http-security";
import { MAX_REQUEST_ID_CHARS } from "@/lib/orders";

const bodySchema = z.object({
  orderId: z.string().trim().min(1),
  // El efectivo no se simula: el efectivo demo no es dinero real. Solo los
  // métodos digitales pueden pasar por pey/demo.
  method: z.enum(["codi", "card", "wallet"]).default("card"),
  // Opcional para no romper a los clientes actuales. Sin él se usa la llave
  // automática por pedido + importe.
  requestId: z.string().trim().max(MAX_REQUEST_ID_CHARS).nullish(),
});

export async function POST(request: Request) {
  if (!isDemoMode()) {
    return Response.json(
      { error: "El modo demo está desactivado.", code: "demo_disabled" },
      { status: 403 },
    );
  }

  const limited = enforceRateLimit(request, "demo-pay", 30, 60_000);
  if (limited) return limited;

  let rawBody: unknown;
  try {
    rawBody = await readJsonLimited(request, MAX_SMALL_JSON_BYTES);
  } catch (error) {
    return bodyErrorResponse(error);
  }

  if (!isJsonObject(rawBody)) {
    return Response.json(
      { error: "El cuerpo debe ser un objeto JSON.", code: "invalid_json" },
      { status: 400 },
    );
  }

  try {
    const body = bodySchema.parse(rawBody);
    const result = recordDemoPayment({
      orderId: body.orderId,
      method: body.method,
      requestId: body.requestId ?? null,
    });

    return Response.json({
      order: result.order,
      transactionId: result.transactionId,
      duplicate: result.duplicate,
      alreadySettled: result.alreadySettled,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const field = error.issues[0]?.path?.[0];
      const validation =
        field === "requestId"
          ? new ValidationError(
              `El requestId no puede pasar de ${MAX_REQUEST_ID_CHARS} caracteres.`,
              "request_id_invalid",
            )
          : field === "orderId"
            ? new ValidationError(
                "Falta el pedido a cobrar.",
                "invalid_order_id",
              )
            : new ValidationError(
                "Método demo inválido. Usa codi, card o wallet; el efectivo no se simula.",
                "invalid_method",
              );
      const response = appErrorResponse(validation);
      if (response) return response;
    }

    const known = appErrorResponse(error);
    if (known) return known;
    return internalErrorResponse("demo pay", error);
  }
}
