import { judgeAccountsEnabled } from "./pilot-mode";

export function withPilotRoute<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Response | Promise<Response>,
  options: { buyer?: boolean } = {},
) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    if (!judgeAccountsEnabled()) return handler(request, ...args);
    const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };
    if (options.buyer) return Response.json({ error: "Esta ruta no está disponible en el piloto de cuentas demo.", code: "demo_buyer_unavailable" }, { status: 404, headers: privateHeaders });
    let stage = "session";
    try {
      const { verifiedJudgeAccount, runJudgeRequest } = await import("./pilot-runtime");
      const account = await verifiedJudgeAccount(request.headers);
      if (!account) return Response.json({ error: "Inicia sesión para continuar.", code: "session_required" }, { status: 401, headers: privateHeaders });
      // Keep Next's original Request: copying its proxied instance with the
      // native constructor fails its private-field brand check in production.
      stage = "tenant-handler";
      const response = await runJudgeRequest(account, () => handler(request, ...args));
      // Never reuse one account's browser cache after another account signs in.
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "private, no-store");
      headers.append("Vary", "Cookie");
      headers.delete("ETag");
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    } catch (error) {
      // Server-side diagnostics only: never include request bodies, cookies or credentials.
      console.error("[judge-account]", stage, error instanceof Error ? error.message : "unknown failure");
      return Response.json({ error: "El acceso de prueba no está disponible. Inténtalo más tarde.", code: "account_service_unavailable" }, { status: 503, headers: privateHeaders });
    }
  };
}
