"use client";

import * as Sentry from "@sentry/nextjs";

export function SentryDiagnostics() {
  return <button type="button" onClick={() => {
    Sentry.setTag("sentry_test", "browser");
    window.setTimeout(() => { throw new Error("TRANGUI_SENTRY_CANARY_BROWSER"); }, 0);
  }}>Enviar error sintético de navegador</button>;
}
