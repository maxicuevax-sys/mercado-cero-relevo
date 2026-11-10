import { judgeAccountsEnabled } from "./pilot-mode";
import { captureUnexpectedError } from "../observability/capture-unexpected";
import { getJudgeRuntime } from "./pilot-runtime";
import { validateRegistration } from "./register-validation";
import { bodyErrorResponse, isSameOriginMutation, readJsonLimited } from "../http-security";

const GUEST_EMAIL_SUFFIX = "@demo.trangui.local";

function pilotAccountLimit(): number {
  const raw = Number(process.env.JUDGE_MAX_ACCOUNTS ?? 100);
  return Number.isInteger(raw) && raw > 0 && raw <= 100_000 ? raw : 100;
}

const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };
function failure(error: string, code: string, status: number) { return Response.json({ error, code }, { status, headers: privateHeaders }); }

export async function handleJudgeAccess(request: Request, action: "sign-in" | "sign-up" | "sign-out") {
  if (!judgeAccountsEnabled()) return failure(action === "sign-up" ? "El registro de pruebas todavía no está abierto." : "El acceso de prueba todavía no está abierto.", action === "sign-up" ? "registration_not_open" : "access_not_open", 503);
  if (!isSameOriginMutation(request)) return failure("El origen de la petición no está permitido.", "cross_origin", 403);
  let payload: Record<string, unknown> = {};
  if (action !== "sign-out") {
    try {
      const raw = await readJsonLimited<unknown>(request, 4096);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return failure("Revisa los datos del formulario.", "invalid_form", 400);
      payload = raw as Record<string, unknown>;
    } catch (error) { return bodyErrorResponse(error); }
    if (action === "sign-up") {
      const result = validateRegistration({ name: typeof payload.name === "string" ? payload.name : "", email: typeof payload.email === "string" ? payload.email : "", password: typeof payload.password === "string" ? payload.password : "" });
      if (!result.ok) return failure(result.message, "invalid_form", 400);
      payload = result.values;
    } else {
      if (typeof payload.email !== "string" || payload.email.length > 254 || typeof payload.password !== "string") return failure("Revisa tu correo y contraseña.", "invalid_form", 400);
      payload = { email: payload.email.trim(), password: payload.password };
    }
  }
  try {
    const { identity } = await getJudgeRuntime();
    const full = () =>
      Number(
        (
          identity.database
            .prepare(
              "SELECT count(*) AS n FROM user WHERE lower(email) NOT LIKE ?",
            )
            .get(`%${GUEST_EMAIL_SUFFIX}`) as { n: number }
        ).n,
      ) >= pilotAccountLimit();
    if (action === "sign-up" && full()) return failure("El piloto ya alcanzó su cupo de cuentas de prueba.", "pilot_full", 503);
    const endpoint = action === "sign-out" ? "sign-out" : `${action}/email`;
    const origin = new URL(process.env.APP_URL!).origin;
    const headers = new Headers(request.headers);
    headers.set("Content-Type", "application/json");
    headers.delete("Content-Length");
    const result = await identity.auth.handler(new Request(`${origin}/api/auth/${endpoint}`, { method: "POST", headers, body: JSON.stringify(payload) }));
    if (!result.ok) {
      if (result.status === 429) {
        const limited = failure("Demasiados intentos. Espera unos segundos y vuelve a intentar.", "access_rate_limited", 429);
        limited.headers.set("Retry-After", result.headers.get("Retry-After") ?? "10");
        return limited;
      }
      if (action === "sign-up" && full()) return failure("El piloto ya alcanzó su cupo de cuentas de prueba.", "pilot_full", 503);
      if (action === "sign-up") return failure("Ese correo ya está registrado o los datos no son válidos. Inicia sesión o usa Entrar sin cuenta.", "email_exists_or_invalid", 400);
      return failure("Correo o contraseña incorrectos.", "access_rejected", result.status === 429 ? 429 : 400);
    }
    // Do not expose Better Auth's bearer token or raw provider response to JS.
    const response = Response.json({ ok: true }, { headers: privateHeaders });
    for (const cookie of result.headers.getSetCookie()) response.headers.append("Set-Cookie", cookie);
    return response;
  } catch (error) {
    captureUnexpectedError(error);
    return failure("El acceso de prueba no está disponible. Inténtalo más tarde.", "account_service_unavailable", 503);
  }
}
