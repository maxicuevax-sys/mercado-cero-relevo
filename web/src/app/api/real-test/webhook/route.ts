import { getJudgeRuntime } from "../../../../lib/auth/pilot-runtime";
import { receiveRealTest, realTestConfig } from "../../../../lib/pey-real-test";
import { readTextLimited, MAX_WEBHOOK_BYTES, bodyErrorResponse, enforceRateLimit } from "../../../../lib/http-security";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!realTestConfig()) return Response.json({ ok: false }, { status: 503 });
  const limited = enforceRateLimit(request, "real-test-webhook", 120, 60_000);
  if (limited) return limited;
  let raw: string;
  try { raw = await readTextLimited(request, MAX_WEBHOOK_BYTES); } catch (error) { return bodyErrorResponse(error); }
  try {
    const { identity } = await getJudgeRuntime();
    const status = receiveRealTest(identity.database, raw, request.headers);
    return Response.json({ ok: status === 200 }, { status, headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ ok: false }, { status: 503 }); }
}
