"use client";

// Catches render errors in the root layout, which no other error boundary
// sees. Without this file those failures never reach Sentry.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="container narrow">
          <div className="panel center">
            <h1>Something went wrong</h1>
            <p className="muted">
              This page could not be loaded. Try again, and tell your teacher if it keeps
              happening.
            </p>
            <button className="btn btn-primary" onClick={() => reset()}>
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
