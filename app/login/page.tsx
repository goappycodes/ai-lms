"use client";

import Link from "next/link";
import { useState } from "react";

type Role = "student" | "teacher" | "admin";

export default function Login() {
  const [role, setRole] = useState<Role>("student");
  const dest = role === "student" ? "/learning" : role === "teacher" ? "/teacher" : "/admin";

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
          Powered by <span className="nexis">N<span className="e">E</span>XIS</span> · Government of Kerala
        </p>

        <div className="role-tabs">
          {(["student", "teacher", "admin"] as Role[]).map((r) => (
            <button key={r} className={role === r ? "on" : ""} onClick={() => setRole(r)}>
              {r[0].toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>

        <label className="field">
          <span>{role === "student" ? "Student ID / Google account" : "Email"}</span>
          <input placeholder={role === "student" ? "KL-6B-023" : "you@school.kerala.gov.in"} />
        </label>
        <label className="field">
          <span>Password / OTP</span>
          <input type="password" placeholder="••••••" />
        </label>

        <Link className="btn btn-primary block" href={dest}>
          Continue
        </Link>

        <div className="lang-row">
          <span className="muted">Language</span>
          <div className="lang-toggle">
            <button className="on">English</button>
            <button>മലയാളം</button>
          </div>
        </div>

        <p className="tiny muted center">
          Under-13 (Explorer) sign-in is teacher-provisioned — see brief §9.
        </p>
      </div>
    </main>
  );
}
