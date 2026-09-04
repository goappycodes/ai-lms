"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname() || "";
  return (
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
  );
}
