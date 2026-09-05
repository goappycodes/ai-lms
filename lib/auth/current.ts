import { cache } from "react";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession, type Role } from "./token";
import {
  accountUsable,
  findUserByLiveSession,
  toSafeUser,
  type SafeUser,
} from "@/lib/db/users";

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
 *
 * Wrapped in React's `cache()`, which deduplicates **within a single render**
 * and nothing wider. A page calls this through requirePage() and TopNav calls
 * it again for the same request; without this that is two lookups for one
 * answer. It is not a cache across requests — the database is still asked once
 * per request, which is what keeps revocation immediate. See
 * docs/PERFORMANCE.md for why caching it any wider was rejected.
 */
export const getCurrentUser = cache(async (): Promise<SafeUser | null> => {
  const claims = await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!claims) return null;

  // One round trip, not two: the session row and the user it names arrive
  // together. The session must still be live for this to return anything.
  const user = await findUserByLiveSession(claims.sid);

  // The cookie names a user as well as a session; if they disagree, the cookie
  // is not describing this session and is refused.
  if (!user || user.id !== claims.uid) return null;

  // Disabled, or belonging to a school that has been archived.
  if (!accountUsable(user)) return null;

  return toSafeUser(user);
});

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
      return "/school";
    case "teacher":
      return "/teacher";
    case "student":
      return "/learning";
  }
}
