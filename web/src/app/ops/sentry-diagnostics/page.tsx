import { connection } from "next/server";
import { notFound } from "next/navigation";
import { withPilotPage } from "../../../lib/auth/pilot-page";
import { sentryDiagnosticsEnabled } from "../../../lib/observability/sentry-diagnostics";
import { SentryDiagnostics } from "./diagnostics-client";

export const instant = false;

async function SentryDiagnosticsPage() {
  await connection();
  if (!sentryDiagnosticsEnabled()) notFound();
  return <main><h1>Diagnóstico temporal de Sentry</h1><p>Solo canary. La prueba envía un error sintético sin datos del negocio.</p><SentryDiagnostics /></main>;
}

export default withPilotPage(SentryDiagnosticsPage);
