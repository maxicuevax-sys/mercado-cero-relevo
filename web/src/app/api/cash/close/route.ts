import { withPilotRoute } from "../../../../lib/auth/pilot-route";
import { captureUnexpectedError } from "../../../../lib/observability/capture-unexpected";
import { z } from "zod";
import { CashCloseError, closeCash, getCashStatus } from "@/lib/cash";
import {
  bodyErrorResponse,
  enforceRateLimit,
  readJsonLimited,
} from "@/lib/http-security";

const MAX_CASH_BODY_BYTES = 16 * 1024;

const moneyCents = z
  .number({ error: "Escribe un monto válido en centavos." })
  .int("El monto debe estar en centavos enteros.")
  .min(0, "El monto no puede ser negativo.")
  .max(100_000_000, "El monto es demasiado grande.");

const closeSchema = z.object({
  openingCents: moneyCents,
  expensesCents: moneyCents,
  withdrawalsCents: moneyCents,
  // El 0 se valida en closeCash para responder `counted_required`, no
  // `invalid_close`, y mantener el mismo contrato que el preview.
  countedCents: moneyCents,
  baseNextCents: moneyCents,
  previewFingerprint: z
    .string({ error: "Falta la huella del preview del corte." })
    .trim()
    .min(1, "Vuelve a calcular la diferencia antes de guardar.")
    .max(64, "La huella del preview no es válida."),
  reason: z
    .string({ error: "El motivo debe ser texto." })
    .trim()
    .max(280, "El motivo es demasiado largo; usa 280 caracteres o menos.")
    .optional(),
  requestId: z
    .string({ error: "La llave del corte debe ser texto." })
    .trim()
    .min(1, "La llave del corte no puede estar vacía.")
    .max(100, "La llave del corte es demasiado larga.")
    .optional(),
  expectedVersion: z
    .number({ error: "Falta la versión esperada del corte." })
    .int("La versión esperada debe ser un entero.")
    .min(0, "La versión esperada no puede ser negativa."),
});

async function readJson(
  request: Request,
): Promise<{ body: unknown } | { response: Response }> {
  try {
    return { body: await readJsonLimited(request, MAX_CASH_BODY_BYTES) };
  } catch (error) {
    return { response: bodyErrorResponse(error) };
  }
}

async function POSTImpl(request: Request) {
  const limited = enforceRateLimit(request, "cash-close", 30, 60_000);
  if (limited) return limited;

  const parsed = await readJson(request);
  if ("response" in parsed) return parsed.response;

  try {
    const body = closeSchema.parse(parsed.body);
    const close = closeCash(body);
    return Response.json({ close, status: getCashStatus() });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: error.issues[0]?.message ?? "Datos de corte inválidos.",
          code: "invalid_close",
          issues: error.issues,
        },
        { status: 400 },
      );
    }
    if (error instanceof CashCloseError) {
      return Response.json(
        {
          error: error.message,
          code: error.code,
          currentVersion: error.currentVersion,
          currentFingerprint: error.currentFingerprint,
        },
        { status: error.status },
      );
    }
    console.error("[cash close] error inesperado", error);
    captureUnexpectedError(error);
    return Response.json(
      { error: "No se pudo guardar el corte.", code: "cash_close_failed" },
      { status: 500 },
    );
  }
}

export const POST = withPilotRoute(POSTImpl);
