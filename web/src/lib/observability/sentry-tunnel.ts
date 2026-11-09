import { createSentryTunnelRoute } from "@sentry/nextjs/tunnel";
import { bodyErrorResponse, enforceRateLimit, isSameOriginMutation, readTextLimited } from "../http-security";

const headers = { "Cache-Control": "private, no-store" };

export async function handleSentryTunnel(request: Request, dsn?: string): Promise<Response> {
  if (!dsn) return Response.json({ error: "Monitoring unavailable" }, { status: 503, headers });
  if (!isSameOriginMutation(request)) return Response.json({ error: "Origin not allowed" }, { status: 403, headers });
  // Telemetry can be dropped under load; this never limits login or business APIs.
  const limited = enforceRateLimit(request, "sentry-tunnel", 60, 60_000);
  if (limited) { limited.headers.set("Cache-Control", "private, no-store"); return limited; }
  let body: string;
  try { body = await readTextLimited(request, 64 * 1024); }
  catch (error) {
    const response = bodyErrorResponse(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  // Never copy the incoming Request or its credential headers to the vendor.
  const clean = new Request(request.url, {
    method: "POST", headers: {
      "Content-Type": "application/x-sentry-envelope",
      "Content-Length": String(new TextEncoder().encode(body).byteLength),
    }, body,
  });
  const response = await createSentryTunnelRoute({ allowedDsns: [dsn] }).POST(clean);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
