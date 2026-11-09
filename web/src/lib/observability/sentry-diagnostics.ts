/** A release test is never a production feature or a URL-controlled switch. */
export function sentryDiagnosticsEnabled(): boolean {
  return process.env.SENTRY_DIAGNOSTICS_ENABLED === "true"
    && process.env.APP_URL === "http://127.0.0.1:4599";
}
