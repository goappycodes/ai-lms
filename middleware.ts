import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession, type Role } from "@/lib/auth/token";

/**
 * Route protection, deny by default.
 *
 * Runs on the Edge runtime, so there is no database here. It verifies the
 * cookie's signature and expiry — enough to route someone correctly with zero
 * I/O — and everything that does real work re-checks the session against the
 * `sessions` table in the Node layer (lib/auth/current.ts).
 *
 * So this stops the wrong role reaching a screen. It is not what stops a
 * revoked session reading data; that is `getCurrentUser`.
 */

/** Reachable without signing in. Everything else requires a session. */
const PUBLIC = [/^\/login$/, /^\/api\/auth\//, /^\/monitoring/];

/** First match wins, so put the most specific prefixes first. */
const RULES: { prefix: RegExp; roles: Role[] }[] = [
  { prefix: /^\/admin/, roles: ["super_admin"] },
  { prefix: /^\/school/, roles: ["super_admin", "school"] },
  { prefix: /^\/teacher/, roles: ["super_admin", "school", "teacher"] },
  { prefix: /^\/learning/, roles: ["super_admin", "school", "teacher", "student"] },
  { prefix: /^\/learn/, roles: ["super_admin", "school", "teacher", "student"] },
  { prefix: /^\/certificate/, roles: ["super_admin", "school", "teacher", "student"] },
];

function homeFor(role: Role): string {
  if (role === "super_admin") return "/admin";
  if (role === "student") return "/learning";
  if (role === "school") return "/school";
  return "/teacher";
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const claims = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (PUBLIC.some((p) => p.test(pathname))) {
    // Someone already signed in has no reason to see the login page.
    if (pathname === "/login" && claims) {
      return NextResponse.redirect(new URL(homeFor(claims.role), req.url));
    }
    return NextResponse.next();
  }

  if (!claims) {
    const url = new URL("/login", req.url);
    // Come back to where they were headed once they sign in.
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    const res = NextResponse.redirect(url);
    // A stale or forged cookie is cleared on the way out, so the browser stops
    // sending it and the redirect loop cannot happen.
    if (req.cookies.has(SESSION_COOKIE)) res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  const rule = RULES.find((r) => r.prefix.test(pathname));
  if (rule && !rule.roles.includes(claims.role)) {
    // Send them to their own home rather than a dead end.
    return NextResponse.redirect(new URL(homeFor(claims.role), req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except static assets and the files Next serves itself. API
  // routes are matched too: an unauthenticated fetch should not reach a
  // handler at all, and each handler still guards itself on top of this.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|hls/|files/|.*\\.(?:png|jpg|svg|ico)$).*)"],
};
