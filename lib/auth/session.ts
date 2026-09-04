import { cookies } from "next/headers";
import { SESSION_COOKIE, signSession, type Role } from "./token";
import { createSession, destroySession } from "@/lib/db/users";

// Node runtime only. The Edge middleware reads the cookie but never writes it.

export async function startSession(user: { id: string; role: Role }): Promise<void> {
  const { sessionId, expiresAt } = await createSession(user.id);
  const token = await signSession({
    sid: sessionId,
    uid: user.id,
    role: user.role,
    exp: Math.floor(expiresAt.getTime() / 1000),
  });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Not secure in development, or the cookie is dropped over plain http and
    // nothing works locally for reasons that take an hour to find.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(sessionId?: string): Promise<void> {
  if (sessionId) await destroySession(sessionId);
  cookies().set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}
