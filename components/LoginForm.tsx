"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { t } from "@/lib/i18n/strings";
import type { DemoAccount } from "@/lib/auth/demo";
import { safeRedirect } from "@/lib/auth/safe-redirect";

// Two lines per button: the role, then what it lands on. One line of
// "Student 1 · Explorer" does not fit two columns at 375px without wrapping
// mid-phrase.
const DEMO_BUTTONS: { account: DemoAccount; label: string; sub: string }[] = [
  { account: "demo.superadmin", label: t("login.demo.superadmin"), sub: t("login.demo.sub.superadmin") },
  { account: "demo.school", label: t("login.demo.school"), sub: t("login.demo.sub.school") },
  { account: "demo.teacher", label: t("login.demo.teacher"), sub: t("login.demo.sub.teacher") },
  { account: "demo.student1", label: t("login.demo.student1"), sub: t("login.demo.sub.student1") },
  { account: "demo.student2", label: t("login.demo.student2"), sub: t("login.demo.sub.student2") },
  { account: "demo.student3", label: t("login.demo.student3"), sub: t("login.demo.sub.student3") },
];

export default function LoginForm({ demoEnabled }: { demoEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  // Where the middleware was sending them before it asked for a sign-in.
  const next = params.get("next");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function go(destination: string) {
    // `next` is attacker-controlled — it comes straight off the query string.
    // safeRedirect resolves it and drops anything that leaves this origin.
    const safe = safeRedirect(next, window.location.origin, destination);
    // refresh() so server components re-render with the new session, rather
    // than showing a cached signed-out view.
    router.replace(safe);
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError(t("login.error.empty"));
      return;
    }
    setBusy("form");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || t("login.error.generic"));
        setBusy(null);
        return;
      }
      go(data.redirect);
    } catch {
      setError(t("login.error.generic"));
      setBusy(null);
    }
  }

  async function demoSignIn(account: DemoAccount) {
    setError(null);
    setBusy(account);
    try {
      const res = await fetch("/api/auth/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || t("login.error.generic"));
        setBusy(null);
        return;
      }
      go(data.redirect);
    } catch {
      setError(t("login.error.generic"));
      setBusy(null);
    }
  }

  return (
    <>
      <div className="auth-main">
        <div className="auth-head">
          <h1>{t("login.title")}</h1>
          <p className="muted">{t("login.subtitle")}</p>
        </div>

        <form className="auth-form" onSubmit={submit} noValidate>
        <label className="field">
          <span>{t("login.username")}</span>
          <input
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("login.username.placeholder")}
            autoComplete="username"
            // Phones capitalise and autocorrect by default, which quietly
            // mangles a username a child is copying off a slip of paper.
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            required
            disabled={busy !== null}
          />
        </label>

        <label className="field">
          <span>{t("login.password")}</span>
          <input
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            enterKeyHint="go"
            required
            disabled={busy !== null}
          />
        </label>

        {error && (
          <p className="form-err" role="alert" aria-live="polite">
            {error}
          </p>
        )}

          <button className="btn btn-primary block" type="submit" disabled={busy !== null}>
            {busy === "form" ? t("login.submitting") : t("login.submit")}
          </button>
        </form>

        {/* No self-serve reset by design: students have no email, so recovery
            runs up the chain instead (D-04). Saying so here is what stops the
            support call. */}
        <div className="auth-help">
          <strong>{t("login.forgot.heading")}</strong>
          <span>{t("login.forgot.student")}</span>
          <span className="muted">{t("login.forgot.staff")}</span>
        </div>
      </div>

      {demoEnabled && (
        <div className="auth-side">
          <div className="demo-head">
            <strong>{t("login.demo.heading")}</strong>
            <span className="muted tiny">{t("login.demo.note")}</span>
          </div>
          <div className="demo-grid">
            {DEMO_BUTTONS.map((b) => (
              <button
                key={b.account}
                type="button"
                className="demo-btn"
                onClick={() => demoSignIn(b.account)}
                disabled={busy !== null}
              >
                <span className="demo-btn-label">
                  {busy === b.account ? "…" : b.label}
                </span>
                <span className="demo-btn-sub">{b.sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
