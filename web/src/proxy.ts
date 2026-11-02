import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  hasValidDemoResetToken,
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
 * 2. Rechaza cuerpos declarados demasiado grandes antes de leerlos.
 * 3. Exige DEMO_RESET_TOKEN en /api/demo/reset cuando está configurado.
 *
 * /api/webhooks/pey queda fuera del CSRF porque pey no envía Origin; su
 * autenticidad la da la firma Standard Webhooks dentro de la ruta.
 */

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function bodyLimitFor(pathname: string): number | null {
  if (pathname === "/api/webhooks/pey") return MAX_WEBHOOK_BYTES;
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

  if (mutating && pathname !== "/api/webhooks/pey") {
    if (!isSameOriginMutation(request)) {
      return jsonError(
        "El origen de la petición no está permitido.",
        "cross_origin",
        403,
      );
    }

    if (pathname === "/api/demo/reset" && !hasValidDemoResetToken(request)) {
      return jsonError(
        "Se requiere el token de demo para reiniciar.",
        "demo_token_invalid",
        401,
      );
    }
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
  matcher: "/api/:path*",
};
