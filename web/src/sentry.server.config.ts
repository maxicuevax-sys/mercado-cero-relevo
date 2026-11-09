import * as Sentry from "@sentry/nextjs";
import { createSentryOptions } from "./lib/observability/sentry-options";

Sentry.init(createSentryOptions({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: process.env.BUILD_SHA,
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  production: process.env.NODE_ENV === "production",
}));
