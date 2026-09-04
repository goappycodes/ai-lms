import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api";
import { verifyPassword, needsRehash, hashPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/current";
import {
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_MINUTES,
  audit,
  findUserByUsername,
  recentLoginFailures,
  setPasswordHash,
  toSafeUser,
  touchLastLogin,
} from "@/lib/db/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  username: z.string().min(1).max(120),
  password: z.string().min(1).max(200),
});

// One message for every failure, on purpose. "No such user" and "wrong
// password" told apart is a way to enumerate who has an account — and student
// usernames follow a predictable pattern.
const GENERIC = "Username or password is incorrect.";

export async function POST(req: Request) {
  const parsed = await parseBody(req, loginSchema);
  if ("error" in parsed) return parsed.error;
  const { username, password } = parsed.data;

  try {
    const failures = await recentLoginFailures(username);
    if (failures >= LOGIN_MAX_FAILURES) {
      await audit({
        action: "auth.login_blocked",
        targetType: "username",
        targetId: username.toLowerCase(),
      });
      return NextResponse.json(
        {
          error: `Too many attempts. Try again in ${LOGIN_WINDOW_MINUTES} minutes, or ask your teacher to reset your password.`,
        },
        { status: 429 }
      );
    }

    const user = await findUserByUsername(username);

    // Verify against a dummy hash when the user does not exist, so a missing
    // account and a wrong password take the same ~120 ms. Otherwise the
    // response time alone answers "does this username exist?".
    const storedHash = user?.password_hash ?? DUMMY_HASH;
    const ok = await verifyPassword(password, storedHash);

    if (!user || !ok || user.status !== "active") {
      await audit({
        action: "auth.login_failed",
        targetType: "username",
        targetId: username.toLowerCase(),
        detail: { reason: !user ? "no_such_user" : !ok ? "bad_password" : "disabled" },
      });
      return NextResponse.json({ error: GENERIC }, { status: 401 });
    }

    // Raise the hashing cost over time without asking anyone to reset: we have
    // the plaintext exactly once, right here.
    if (needsRehash(user.password_hash)) {
      await setPasswordHash(user.id, await hashPassword(password), user.must_change_password);
    }

    await startSession(user);
    // touchLastLogin is what clears the lockout: recentLoginFailures only
    // counts attempts made after the last successful sign-in.
    await Promise.all([
      touchLastLogin(user.id),
      audit({ actorUserId: user.id, action: "auth.login", targetType: "user", targetId: user.id }),
    ]);

    return NextResponse.json({
      user: toSafeUser(user),
      redirect: homeFor(user.role),
      mustChangePassword: user.must_change_password,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // SESSION_SECRET missing is the one failure worth naming: it is a
    // deployment mistake, and a generic 500 sends people hunting in the wrong
    // place for an hour.
    if (message.includes("SESSION_SECRET")) {
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return NextResponse.json({ error: "Sign-in failed. Please try again." }, { status: 500 });
  }
}

// A real hash of a random string nobody knows, so the "no such user" path does
// the same 32 MB of work as a genuine verification (~120 ms measured). A
// hand-written placeholder would fail the length check inside verifyPassword
// and return in microseconds, which is exactly the timing signal this exists
// to remove.
const DUMMY_HASH =
  "scrypt$32768$8$1$FNx1orFrEJn3oYBlnj-RHg$" +
  "_vZLx0kD_n057SEbSxDi1JVbD9emmtlxYbFRhLRv0AQhRuuCUhMQB8Ltn05WEVji9Qwu3G3pHddC-vIGgsXrFg";
