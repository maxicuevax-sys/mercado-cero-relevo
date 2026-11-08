import { getJudgeRuntime, verifiedJudgeAccount } from "../../../../lib/auth/pilot-runtime";
import { realTestConfig, realTestRow, publicRealTest, createRealTest } from "../../../../lib/pey-real-test";
import { isSameOriginMutation, readTextLimited, enforceRateLimit, bodyErrorResponse } from "../../../../lib/http-security";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
async function handle(request: Request, create: boolean) {
  const config = realTestConfig();
  if (!config) return Response.json({ error: "Prueba real no configurada", code: "real_test_unconfigured" }, { status: 503, headers });
  try {
    const account = await verifiedJudgeAccount(request.headers);
    if (!account) return Response.json({ error: "Inicia sesion" }, { status: 401, headers });
    if (account.id !== config.allowedAccountId) return Response.json({ error: "Prueba reservada a la cuenta autorizada" }, { status: 403, headers });
    if (create) {
      const limited = enforceRateLimit(request, "real-test-create", 5, 60_000);
      if (limited) return limited;
      if (!isSameOriginMutation(request)) return Response.json({ error: "Origen no permitido" }, { status: 403, headers });
      let body: string;
      try { body = await readTextLimited(request, 256); } catch (error) { return bodyErrorResponse(error); }
      if (body.trim() !== "{}") return Response.json({ error: "El cuerpo debe ser {}. El monto y receptor son fijos." }, { status: 400, headers });
    }
    const { identity } = await getJudgeRuntime();
    const payment = create ? await createRealTest(identity.database, account.id) : publicRealTest(realTestRow(identity.database), account.id);
    if (create && !payment) return Response.json({ error: "La unica prueba ya fue reservada", code: "real_test_reserved" }, { status: 409, headers });
    return Response.json({ payment }, { headers });
  } catch { return Response.json({ error: "Prueba real no disponible. No repitas la generacion.", code: "real_test_unavailable" }, { status: 503, headers }); }
}
export const GET = (request: Request) => handle(request, false);
export const POST = (request: Request) => handle(request, true);
