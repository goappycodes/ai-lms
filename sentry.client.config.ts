// Sentry — browser. Loaded on every page a student opens, so it is kept
// deliberately small: errors only.
//
// No Session Replay, for two reasons. It would record the screens of
// children — names, school, class — which is not something we should be
// shipping to a third party. And it is the heaviest part of the SDK, on a
// product whose users are on prepaid mobile data (D-11).
//
// The SDK warns that this file should become `instrumentation-client.ts`.
// That file is only loaded by Next 15.3+; we are on 14.2, where renaming it
// would silently stop client-side Sentry from initialising at all. Move it
// when we upgrade Next, not before.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// With no DSN the SDK initialises into a no-op, so this is safe before the
// Sentry project exists and in local development.
Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_SENTRY_ENV || process.env.NODE_ENV,
  // Errors, not performance. Raise deliberately if we ever need traces.
  tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_RATE || 0),
  // Never send cookies, headers or user IP by default.
  sendDefaultPii: false,
  // Browser extensions and offline blips are not our bugs.
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "Non-Error promise rejection captured",
    "NetworkError when attempting to fetch resource",
    "Failed to fetch",
    "AbortError",
  ],
});
