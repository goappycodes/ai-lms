// Next.js loads this once per runtime at startup.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Reports errors thrown inside server components and route handlers, which
// otherwise never reach Sentry.
export { captureRequestError as onRequestError } from "@sentry/nextjs";
