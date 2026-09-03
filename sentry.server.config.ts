// Sentry — Node server (route handlers, server components).
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.SENTRY_ENV || process.env.NODE_ENV,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_RATE || 0),
  sendDefaultPii: false,
});
