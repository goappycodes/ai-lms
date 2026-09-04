import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";
import { t } from "@/lib/i18n/strings";
import { demoLoginEnabled } from "@/lib/auth/demo";

export const dynamic = "force-dynamic";

// The language toggle that used to sit here has been removed rather than left
// decorative: it switched nothing. It returns in P3-05, once the catalogue has
// real Malayalam in it (P3-03). A control that looks like it works and does
// not is worse than no control.
export default function LoginPage() {
  const demoEnabled = demoLoginEnabled();

  return (
    <main className="auth">
      <div className="auth-card">
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

        <div className="auth-head">
          <h1>{t("login.title")}</h1>
          <p className="muted">{t("login.subtitle")}</p>
        </div>

        {/* useSearchParams needs a Suspense boundary at build time. */}
        <Suspense fallback={null}>
          <LoginForm demoEnabled={demoEnabled} />
        </Suspense>
      </div>
    </main>
  );
}
