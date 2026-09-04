import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession, type Role } from "./token";
import { findUserById, getLiveSession, toSafeUser, type SafeUser } from "@/lib/db/users";

/**
 * The signed-in user, or null.
 *
 * Two checks, and both are needed:
 *
 *   1. The cookie signature and expiry — cheap, no I/O. Already done by the
 *      middleware for page routes, repeated here because API routes are not
 *      all covered by it and defence in depth is the point.
 *   2. The `sessions` row — this is what makes signing out, a password change
 *      or a disabled account take effect immediately. A signed cookie stays
 *      cryptographically valid until it expires; only the database knows the
 *      session was revoked ten seconds ago.
 */
export async function getCurrentUser(): Promise<SafeUser | null> {
  const claims = await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!claims) return null;

  const session = await getLiveSession(claims.sid);
  if (!session || session.user_id !== claims.uid) return null;

  const user = await findUserById(claims.uid);
  if (!user || user.status !== "active") return null;

  return toSafeUser(user);
}

/** The session id from the cookie, without touching the database. */
export async function getCurrentSessionId(): Promise<string | null> {
  const claims = await verifySession(cookies().get(SESSION_COOKIE)?.value);
  return claims?.sid ?? null;
}

/** Where each role lands after signing in. */
export function homeFor(role: Role): string {
  switch (role) {
    case "super_admin":
      return "/admin";
    case "school":
      // School-level screens land in P5-04/P5-05. Until then a school sees the
      // teacher view, which is the closest honest thing.
      return "/teacher";
    case "teacher":
      return "/teacher";
    case "student":
      return "/learning";
  }
}
