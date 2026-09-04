import Link from "next/link";
import NavLinks from "@/components/NavLinks";
import UserMenu from "@/components/UserMenu";
import { getCurrentUser, homeFor } from "@/lib/auth/current";
import { t } from "@/lib/i18n/strings";
import type { Role } from "@/lib/auth/token";

// A server component so the nav shows who is actually signed in, rather than a
// hard-coded name. The two interactive pieces are client components.
//
// The EN/ML toggle that used to sit here is gone for the same reason it went
// from the login page: it switched nothing. It returns in P3-05, once the
// catalogue has real Malayalam.

/** Only the destinations this role can actually reach — the middleware would
 *  bounce the others, and a link that always bounces is worse than no link. */
function linksFor(role: Role): { href: string; label: string }[] {
  const all = [
    { href: "/learning", label: t("nav.learning"), roles: ["super_admin", "school", "teacher", "student"] },
    { href: "/school", label: t("nav.school"), roles: ["super_admin", "school"] },
    { href: "/teacher", label: t("nav.teacher"), roles: ["super_admin", "school", "teacher"] },
    { href: "/admin", label: t("nav.admin"), roles: ["super_admin"] },
  ];
  return all.filter((l) => l.roles.includes(role)).map(({ href, label }) => ({ href, label }));
}

export default async function TopNav() {
  const user = await getCurrentUser();

  return (
    <header className="topnav">
      <div className="topnav-inner">
        <Link href={user ? homeFor(user.role) : "/login"} className="brand">
          <span className="brand-mark">
            <span className="mark-glyph">व</span>
          </span>
          <span className="brand-name">AI Veda</span>
        </Link>

        {user && <NavLinks links={linksFor(user.role)} />}

        <div className="topnav-right">
          {user && (
            <UserMenu
              user={{ full_name: user.full_name, role: user.role, username: user.username }}
            />
          )}
        </div>
      </div>
    </header>
  );
}
