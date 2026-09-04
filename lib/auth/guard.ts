import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "./current";
import type { Role } from "./token";
import type { SafeUser } from "@/lib/db/users";

/**
 * Authorisation for API routes. Deny by default: a route that forgets to call
 * this is the bug class we are trying to make impossible, so every handler
 * starts with one of these.
 *
 * Returns either the user or a Response to return immediately:
 *
 *   const g = await requireRole("super_admin");
 *   if ("response" in g) return g.response;
 *   // g.user is available and authorised
 */
export type Guard = { user: SafeUser } | { response: NextResponse };

export async function requireUser(): Promise<Guard> {
  const user = await getCurrentUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  }
  return { user };
}

export async function requireRole(...roles: Role[]): Promise<Guard> {
  const g = await requireUser();
  if ("response" in g) return g;
  if (!roles.includes(g.user.role)) {
    // 403, not 404: the caller is authenticated, so hiding the route's
    // existence buys nothing and a clear error saves a support call.
    return { response: NextResponse.json({ error: "Not allowed" }, { status: 403 }) };
  }
  return g;
}

/** Anyone who can administer content. */
export const requireContentAdmin = () => requireRole("super_admin");

/** Anyone who can see a class's progress. */
export const requireStaff = () => requireRole("super_admin", "school", "teacher");

/**
 * The page-level counterpart to the API guards, and the other half of what the
 * middleware can do.
 *
 * The middleware verifies the cookie signature on the Edge, where there is no
 * database — so it cannot know a session was revoked. A signed-out cookie that
 * someone copied still carries a valid signature until it expires, and would
 * otherwise render a page shell.
 *
 * Every page behind a login calls this. It is the only place that asks the
 * database whether the session is still live.
 */
export async function requirePage(...roles: Role[]): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles.length && !roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}
