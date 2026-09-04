"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t, type StringKey } from "@/lib/i18n/strings";

export type MenuUser = {
  full_name: string;
  role: "super_admin" | "school" | "teacher" | "student";
  username: string;
};

/** First letters of the first and last words — "Aparna Nair" becomes AN. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export default function UserMenu({
  user,
  links = [],
}: {
  user: MenuUser;
  /** The same destinations as the top nav. Below 560px the nav bar is hidden,
   *  so without these there is no way to move around the app on a phone at
   *  all — the menu becomes the navigation. Hidden by CSS on wider screens,
   *  where the bar already shows them. */
  links?: { href: string; label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // Close on a click anywhere else, or on Escape. Without both, the menu
  // strands itself open on a phone where there is nothing else to click.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Even if the request failed, send them to the login page: the cookie is
      // cleared server-side on success, and staying put looks like nothing
      // happened. A still-live session is caught on the next guarded request.
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="user-menu" ref={wrap}>
      <button
        type="button"
        className="avatar avatar-button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("nav.account")}
        title={user.full_name}
      >
        {initials(user.full_name)}
      </button>

      {open && (
        <div className="user-menu-panel" role="menu">
          <div className="user-menu-head">
            <strong>{user.full_name}</strong>
            <span className="muted tiny">{t(`role.${user.role}` as StringKey)}</span>
            <span className="muted tiny">{user.username}</span>
          </div>
          {links.length > 0 && (
            <div className="user-menu-nav">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  role="menuitem"
                  className="user-menu-item"
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          )}

          <button
            type="button"
            role="menuitem"
            className="user-menu-item danger"
            onClick={signOut}
            disabled={busy}
          >
            {busy ? t("nav.signingout") : t("nav.signout")}
          </button>
        </div>
      )}
    </div>
  );
}
