import { isDemoMode } from "@/lib/config";
import { DemoResetBlockedError, resetDemoData } from "@/lib/db";
import {
  enforceRateLimit,
  hasValidDemoResetToken,
  internalErrorResponse,
  isSameOriginMutation,
} from "@/lib/http-security";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return Response.json(
      { error: "El origen de la petición no está permitido.", code: "cross_origin" },
      { status: 403 },
    );
  }

  // El rate limit va antes de comparar el token: así un atacante no puede
  // probar tokens ilimitados contra este endpoint público.
  const limited = enforceRateLimit(request, "demo-reset", 5, 60_000);
  if (limited) return limited;

  if (!hasValidDemoResetToken(request)) {
    return Response.json(
      { error: "Se requiere el token de demo para reiniciar.", code: "demo_token_invalid" },
      { status: 401 },
    );
  }

  if (!isDemoMode()) {
    return Response.json(
      { error: "El modo demo está desactivado.", code: "demo_disabled" },
      { status: 403 },
    );
  }

  try {
    const result = resetDemoData({
      force: process.env.FORCE_DEMO_RESET === "1",
    });
    return Response.json({
      ok: true,
      backup: result.backup,
      preservedRealPayments: result.preservedRealPayments,
    });
  } catch (error) {
    if (error instanceof DemoResetBlockedError) {
      return Response.json(
        {
          error:
            "Hay pagos reales confirmados por pey. El reinicio de demo está bloqueado.",
          code: "real_payments_present",
          realPayments: error.realPaymentCount,
        },
        { status: 409 },
      );
    }
    return internalErrorResponse("demo reset", error);
  }
}
