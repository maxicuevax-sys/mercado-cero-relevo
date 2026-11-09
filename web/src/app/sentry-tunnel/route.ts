import { handleSentryTunnel } from "../../lib/observability/sentry-tunnel";

// Public telemetry-only ingress: fixed server DSN, no tenant/database access.
// This is outside /api and therefore outside the business/auth proxy matcher.
export async function POST(request: Request) {
  return handleSentryTunnel(request, process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
}
