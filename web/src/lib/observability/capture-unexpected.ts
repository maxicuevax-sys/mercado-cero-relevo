import { sentryDiagnosticsEnabled } from "./sentry-diagnostics";

/** Keep existing Node unit contracts usable without an SDK/DSN initialized. */
export function captureUnexpectedError(error: unknown): void {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  // Native failures can lack app frames; preserve this callsite before importing asynchronously.
  const captured = new Error("Trangui unexpected operation failure", { cause: error });
  // A telemetry failure must never change the operation's response or retry it.
  void import("@sentry/nextjs").then(Sentry => {
    if (Sentry.getClient()) Sentry.captureException(captured,
      sentryDiagnosticsEnabled() ? { tags: { sentry_test: "server" } } : undefined);
  }).catch(() => undefined);
}
