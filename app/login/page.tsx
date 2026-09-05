import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";
import { demoLoginEnabled } from "@/lib/auth/demo";

/**
 * Prerendered at build time, not rendered per request.
 *
 * This is the page every student hits first and the only one all of them hit,
 * so at a hundred thousand of them it is the most-requested thing we serve.
 * It reads no user data — the sign-in form is a client component and the
 * `?next=` parameter is read in the browser — so there is nothing here worth a
 * server render. Static means the CDN answers it and the origin never sees it.
 *
 * The one input is DEMO_LOGIN, which is baked in at build time. That is
 * correct for a deploy-time flag: changing it already needs a redeploy for the
 * server to notice, and production never sets it.
 */
export const dynamic = "force-static";

// The language toggle that used to sit here was removed rather than left
// decorative: it switched nothing. It returns in P3-05, once the catalogue has
// real Malayalam (P3-03).
export default function LoginPage() {
  const demoEnabled = demoLoginEnabled();

  return (
    <main className="auth">
      <div className={"auth-card" + (demoEnabled ? " has-demo" : "")}>
        <div className="auth-brand">
          <div className="brand big">
            <span className="brand-mark">
              <span className="mark-glyph">व</span>
            </span>
            <span className="brand-name">AI Veda</span>
          </div>
          <p className="muted center auth-cobrand">
            Powered by{" "}
            <span className="nexis">
              N<span className="e">E</span>XIS
            </span>{" "}
            · Government of Kerala
          </p>
        </div>

        {/* useSearchParams needs a Suspense boundary at build time. */}
        <Suspense fallback={null}>
          <LoginForm demoEnabled={demoEnabled} />
        </Suspense>
      </div>
    </main>
  );
}
