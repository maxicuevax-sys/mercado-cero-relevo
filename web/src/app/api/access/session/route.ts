import { judgeAccountsEnabled } from "@/lib/auth/pilot-mode";
import { verifiedJudgeAccount, getJudgeRuntime } from "@/lib/auth/pilot-runtime";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  if (!judgeAccountsEnabled()) return Response.json({ error: "El acceso de prueba todavía no está abierto." }, { status: 503, headers });
  try {
    const account = await verifiedJudgeAccount(request.headers);
    if (!account) return Response.json({ error: "Inicia sesión para continuar." }, { status: 401, headers });
    let peySubAccountId = `demo_sub_${account.id}`;
    let bankAccountId: string | null = null;
    try {
      const { identity } = await getJudgeRuntime();
      const peySub = identity.database
        .prepare("SELECT pey_sub_account_id, bank_account_id FROM pey_sub_accounts WHERE user_id = ?")
        .get(account.id) as { pey_sub_account_id: string; bank_account_id: string | null } | undefined;
      if (peySub) {
        peySubAccountId = peySub.pey_sub_account_id;
        bankAccountId = peySub.bank_account_id;
      }
    } catch {
      // Fallback a demo_sub_<id>
    }
    return Response.json({
      user: {
        id: account.id,
        name: account.name,
        email: account.email,
        peySubAccountId,
        bankAccountId,
      },
    }, { headers });
  } catch { return Response.json({ error: "El acceso de prueba no está disponible." }, { status: 503, headers }); }
}
