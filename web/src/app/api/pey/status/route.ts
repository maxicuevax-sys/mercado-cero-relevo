import { withPilotRoute } from "../../../../lib/auth/pilot-route";
import { appUrl, isDemoMode } from "@/lib/config";
import { getDb, verifyAuditChain } from "@/lib/db";
import { enforceRateLimit } from "@/lib/http-security";

async function GETImpl(request: Request) {
  const limited = enforceRateLimit(request, "pey-status", 60, 60_000);
  if (limited) return limited;

  const demoMode = isDemoMode();
  const peyApiKeyConfigured = Boolean(
    process.env.PEY_API_KEY && process.env.PEY_API_KEY.trim().length > 0,
  );
  const peyWebhookSecretConfigured = Boolean(
    process.env.PEY_WEBHOOK_SECRET &&
      process.env.PEY_WEBHOOK_SECRET.trim().length > 0,
  );
  const peyBankAccountConfigured = Boolean(
    process.env.PEY_BANK_ACCOUNT_ID &&
      process.env.PEY_BANK_ACCOUNT_ID.trim().length > 0,
  );
  const httpsAppUrl = appUrl().startsWith("https://");

  let lastVerifiedWebhookAt: string | null = null;
  try {
    const row = getDb()
      .prepare(
        `SELECT processed_at FROM payment_events
         WHERE signature_valid = 1 AND result = 'processed'
         ORDER BY processed_at DESC LIMIT 1`,
      )
      .get() as { processed_at: string } | undefined;
    if (row?.processed_at) {
      lastVerifiedWebhookAt = row.processed_at;
    }
  } catch {
    // Graceful fallback si la tabla no existe aún en test
  }

  let auditChain = { ok: true, checked: 0, brokenAtId: null as string | null };
  try {
    auditChain = verifyAuditChain();
  } catch (error) {
    auditChain = {
      ok: false,
      checked: 0,
      brokenAtId: error instanceof Error ? error.message : "unknown",
    };
  }

  return Response.json({
    demoMode,
    peyApiKeyConfigured,
    peyWebhookSecretConfigured,
    peyBankAccountConfigured,
    httpsAppUrl,
    lastVerifiedWebhookAt,
    auditChain,
  });
}

export const GET = withPilotRoute(GETImpl);
