import { judgeAccountsEnabled } from "@/lib/auth/pilot-mode";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isDemoMode } from "@/lib/config";
import {
  enforceRateLimit,
  hasValidDemoResetToken,
  hasValidOperatorAccessToken,
  isPublicPerimeterPath,
  isSameOriginMutation,
  MAX_ORDERS_BYTES,
  MAX_RESET_BYTES,
  MAX_SMALL_JSON_BYTES,
  MAX_TRANSCRIBE_BYTES,
  MAX_VOICE_PARSE_BYTES,
  MAX_WEBHOOK_BYTES,
} from "@/lib/http-security";

/**
 * Proxy (antes Middleware) de Next 16.
 *
 * 1. Corta mutaciones cross-origin (CSRF) antes de que toquen una ruta.
 * 2. Rechaza cuerpos declarados demasiado grandes. Ojo: Next bufferiza el
 *    cuerpo antes de ejecutar el Proxy hasta `proxyClientMaxBodySize`; con
 *    `Content-Length` mayor, el 413 se emite al llenar ese buffer y el cliente
 *    puede seguir subiendo. No es una defensa "antes de leer": evita que la
 *    ruta procese el cuerpo y acota la memoria (64 KB en rutas normales).
 * 3. Exige DEMO_RESET_TOKEN en /api/demo/reset cuando está configurado. El
 *    rate limit va antes de comparar el token para que no se puedan probar
 *    tokens ilimitados.
 *
 * /api/webhooks/pey queda fuera del CSRF porque pey no envía Origin; su
 * autenticidad la da la firma Standard Webhooks dentro de la ruta.
 *
 * /api/voice/transcribe queda fuera del matcher: es la única ruta que supera
 * 64 KB. Su ruta lee el multipart por stream con su propio tope de 12 MB y
 * aplica el mismo CSRF, así Next no clona un cuerpo de 12 MB.
 */

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function bodyLimitFor(pathname: string): number | null {
  if (pathname === "/api/webhooks/pey" || pathname === "/api/real-test/webhook") return MAX_WEBHOOK_BYTES;
  if (pathname === "/api/voice/parse") return MAX_VOICE_PARSE_BYTES;
  // El multipart añade boundary y cabeceras; la ruta valida el archivo real.
  if (pathname === "/api/voice/transcribe") return MAX_TRANSCRIBE_BYTES + 64 * 1024;
  if (pathname === "/api/demo/reset") return MAX_RESET_BYTES;
  if (pathname === "/api/orders") return MAX_ORDERS_BYTES;
  if (/^\/api\/orders\/[^/]+(\/pay)?$/.test(pathname)) return MAX_SMALL_JSON_BYTES;
  if (pathname === "/api/demo/pay") return MAX_SMALL_JSON_BYTES;
  if (/^\/api\/credits\/[^/]+\/pay$/.test(pathname)) return MAX_SMALL_JSON_BYTES;
  if (pathname === "/api/cash/close" || pathname === "/api/cash/preview") return 16 * 1024;
  if (pathname === "/api/goals" || /^\/api\/goals\/[^/]+\/contribute$/.test(pathname)) {
    return MAX_SMALL_JSON_BYTES;
  }
  if (pathname === "/api/tasks" || /^\/api\/tasks\/[^/]+$/.test(pathname)) return 16 * 1024;
  if (pathname === "/api/tts") return 4 * 1024;
  return null;
}

function jsonError(error: string, code: string, status: number): NextResponse {
  return NextResponse.json({ error, code }, { status });
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const method = request.method.toUpperCase();
  const mutating = MUTATING.has(method);
  const demoMode = isDemoMode();

  // Return before rendering: streamed notFound pages can otherwise emit HTTP200.
  if (judgeAccountsEnabled() && (
    pathname === "/pay" || pathname.startsWith("/pay/") ||
    pathname === "/api/checkout" || pathname.startsWith("/api/checkout/") ||
    pathname === "/api/verify" || pathname === "/api/webhooks/pey"
  )) {
    const blocked = jsonError("Esta ruta no está disponible en el piloto de cuentas demo.", "demo_buyer_unavailable", 404);
    blocked.headers.set("Cache-Control", "private, no-store");
    return blocked;
  }

  if (mutating && pathname !== "/api/webhooks/pey" && pathname !== "/api/real-test/webhook") {
    if (!isSameOriginMutation(request)) {
      return jsonError(
        "El origen de la petición no está permitido.",
        "cross_origin",
        403,
      );
    }

    if (pathname === "/api/demo/reset") {
      // Antes de comparar el token: 5 intentos por IP y minuto, incluso si el
      // token es incorrecto. La ruta vuelve a limitar por defensa en
      // profundidad.
      const limited = enforceRateLimit(request, "demo-reset-auth", 5, 60_000);
      if (limited) return limited;

      if (!hasValidDemoResetToken(request)) {
        return jsonError(
          "Se requiere el token de demo para reiniciar.",
          "demo_token_invalid",
          401,
        );
      }
    }
  }

  // En modo producción real (DEMO_MODE=false), ninguna ruta /api/demo/* está
  // habilitada. Se corta en el Proxy antes de tocar controladores o base.
  if (!demoMode && (pathname === "/api/demo" || pathname.startsWith("/api/demo/"))) {
    return jsonError(
      "El modo demo está desactivado.",
      "demo_disabled",
      403,
    );
  }

  // Perímetro privado de operadora: cuando OPERATOR_ACCESS_TOKEN está definido,
  // exige el token en todas las rutas privadas de la caja dejando abierto el
  // checkout del comprador (/api/checkout/*) y el webhook (/api/webhooks/pey).
  if (!isPublicPerimeterPath(pathname, demoMode) && !hasValidOperatorAccessToken(request)) {
    const limited = enforceRateLimit(request, "operator-auth", 20, 60_000);
    if (limited) return limited;

    return jsonError(
      "Se requiere acceso de operadora para usar la caja.",
      "operator_auth_required",
      401,
    );
  }

  if (mutating) {
    const limit = bodyLimitFor(pathname);
    if (limit !== null) {
      const declared = Number(request.headers.get("content-length") ?? "0");
      if (Number.isFinite(declared) && declared > limit) {
        return jsonError("El cuerpo de la petición es demasiado grande.", "body_too_large", 413);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  // Transcribe se excluye para que Next no clone/bufferice 12 MB en el Proxy.
  // Esa ruta aplica same-origin, rate limit y el tope de 12 MB por su cuenta.
  matcher: ["/api/((?!voice/transcribe).*)", "/pay/:path*"],
};
