import { withPilotRoute } from "../../../../lib/auth/pilot-route";
import { z } from "zod";
import { CashCloseError, previewCashClose } from "@/lib/cash";
import {
  bodyErrorResponse,
  enforceRateLimit,
  internalErrorResponse,
  readJsonLimited,
} from "@/lib/http-security";

const MAX_CASH_BODY_BYTES = 16 * 1024;

const moneyCents = z
  .number({ error: "Escribe un monto válido en centavos." })
  .int("El monto debe estar en centavos enteros.")
  .min(0, "El monto no puede ser negativo.")
  .max(100_000_000, "El monto es demasiado grande.");

const previewSchema = z.object({
  openingCents: moneyCents,
  expensesCents: moneyCents,
  withdrawalsCents: moneyCents,
  countedCents: moneyCents,
  baseNextCents: moneyCents,
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

/**
 * Devuelve la diferencia calculada con los totales vivos del servidor.
 * No escribe nada: la confirmación del corte usa este resultado.
 */
async function POSTImpl(request: Request) {
  const limited = enforceRateLimit(request, "cash-preview", 60, 60_000);
  if (limited) return limited;

  const parsed = await readJson(request);
  if ("response" in parsed) return parsed.response;

  try {
    const body = previewSchema.parse(parsed.body);
    return Response.json(previewCashClose(body));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: error.issues[0]?.message ?? "Datos de corte inválidos.",
          code: "invalid_preview",
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
    return internalErrorResponse("cash preview", error);
  }
}

export const POST = withPilotRoute(POSTImpl);
