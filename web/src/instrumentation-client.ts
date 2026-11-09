import * as Sentry from "@sentry/nextjs";
import { createSentryOptions } from "./lib/observability/sentry-options";

if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    ...createSentryOptions({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      release: process.env.NEXT_PUBLIC_BUILD_SHA,
      environment: process.env.NODE_ENV === "production"
        && ["127.0.0.1", "localhost", "[::1]"].includes(window.location.hostname)
        ? "canary" : process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
      production: process.env.NODE_ENV === "production",
    }),
    tunnel: "/sentry-tunnel",
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
