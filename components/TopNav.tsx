"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { student } from "@/lib/progress";

const links = [
  { href: "/learning", label: "My Learning" },
  { href: "/teacher", label: "Teacher" },
  { href: "/admin", label: "Admin" },
];

export default function TopNav() {
  const path = usePathname() || "";
  const [lang, setLang] = useState<"EN" | "ML">("EN");

  return (
    <header className="topnav">
      <div className="topnav-inner">
        <Link href="/learning" className="brand">
          <span className="brand-mark">
            <span className="mark-glyph">व</span>
          </span>
          <span className="brand-name">AI Veda</span>
        </Link>

        <nav className="nav-links">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={path.startsWith(l.href) ? "nav-link active" : "nav-link"}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="topnav-right">
          <div className="lang-toggle" role="group" aria-label="Language">
            <button className={lang === "EN" ? "on" : ""} onClick={() => setLang("EN")}>
              EN
            </button>
            <button className={lang === "ML" ? "on" : ""} onClick={() => setLang("ML")}>
              ML
            </button>
          </div>
          <div className="avatar" title={student.name}>
            {student.initials}
          </div>
        </div>
      </div>
    </header>
  );
}
