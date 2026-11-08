import { judgeAccountsEnabled } from "@/lib/auth/pilot-mode";
import { verifiedJudgeAccount } from "@/lib/auth/pilot-runtime";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  if (!judgeAccountsEnabled()) return Response.json({ error: "El acceso de prueba todavía no está abierto." }, { status: 503, headers });
  try {
    const account = await verifiedJudgeAccount(request.headers);
    if (!account) return Response.json({ error: "Inicia sesión para continuar." }, { status: 401, headers });
    return Response.json({ user: { id: account.id, name: account.name, email: account.email } }, { headers });
  } catch { return Response.json({ error: "El acceso de prueba no está disponible." }, { status: 503, headers }); }
}
