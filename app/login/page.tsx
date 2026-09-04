import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";
import { demoLoginEnabled } from "@/lib/auth/demo";

export const dynamic = "force-dynamic";

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
