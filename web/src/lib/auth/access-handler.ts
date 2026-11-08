import { judgeAccountsEnabled } from "./pilot-mode";
import { getJudgeRuntime } from "./pilot-runtime";
import { validateRegistration } from "./register-validation";
import { bodyErrorResponse, isSameOriginMutation, readJsonLimited } from "../http-security";

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
      if (typeof payload.email !== "string" || payload.email.length > 254 || typeof payload.password !== "string" || payload.password.length < 12 || payload.password.length > 128) return failure("Revisa tu correo y contraseña.", "invalid_form", 400);
      payload = { email: payload.email.trim(), password: payload.password };
    }
  }
  try {
    const { identity } = await getJudgeRuntime();
    const full = () => Number((identity.database.prepare("SELECT count(*) AS n FROM user").get() as { n: number }).n) >= 100;
    if (action === "sign-up" && full()) return failure("El piloto ya alcanzó su cupo de cuentas de prueba.", "pilot_full", 503);
    const endpoint = action === "sign-out" ? "sign-out" : `${action}/email`;
    const origin = new URL(process.env.APP_URL!).origin;
    const headers = new Headers(request.headers);
    headers.set("Content-Type", "application/json");
    headers.delete("Content-Length");
    const result = await identity.auth.handler(new Request(`${origin}/api/auth/${endpoint}`, { method: "POST", headers, body: JSON.stringify(payload) }));
    if (!result.ok) {
      if (action === "sign-up" && full()) return failure("El piloto ya alcanzó su cupo de cuentas de prueba.", "pilot_full", 503);
      return failure(action === "sign-in" ? "Correo o contraseña incorrectos." : "No pudimos completar la solicitud. Inténtalo más tarde.", "access_rejected", result.status === 429 ? 429 : 400);
    }
    // Do not expose Better Auth's bearer token or raw provider response to JS.
    const response = Response.json({ ok: true }, { headers: privateHeaders });
    for (const cookie of result.headers.getSetCookie()) response.headers.append("Set-Cookie", cookie);
    return response;
  } catch { return failure("El acceso de prueba no está disponible. Inténtalo más tarde.", "account_service_unavailable", 503); }
}
