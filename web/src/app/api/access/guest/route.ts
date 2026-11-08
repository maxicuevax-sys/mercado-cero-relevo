import { randomBytes, randomUUID } from "node:crypto";
import { getJudgeRuntime } from "@/lib/auth/pilot-runtime";
import { internalErrorResponse, isSameOriginMutation } from "@/lib/http-security";

const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return Response.json({ error: "Origen no permitido." }, { status: 403, headers: privateHeaders });
  }
  try {
    const { identity } = await getJudgeRuntime();
    const origin = new URL(process.env.APP_URL!).origin;
    const email = `invitado-${randomUUID()}@demo.trangui.local`;
    const password = randomBytes(32).toString("base64url");
    const headers = new Headers(request.headers);
    headers.set("Content-Type", "application/json");
    headers.delete("Content-Length");
    const result = await identity.auth.handler(new Request(`${origin}/api/auth/sign-up/email`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Invitado", email, password }),
    }));
    if (!result.ok) {
      return Response.json({ error: "La demo sin cuenta no está disponible. Inténtalo más tarde." }, { status: 503, headers: privateHeaders });
    }
    const response = Response.json({ ok: true }, { headers: privateHeaders });
    for (const cookie of result.headers.getSetCookie()) response.headers.append("Set-Cookie", cookie);
    return response;
  } catch (error) {
    return internalErrorResponse("guest access", error);
  }
}
