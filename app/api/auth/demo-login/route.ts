import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api";
import { startSession } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/current";
import { audit, findUserByUsername, toSafeUser, touchLastLogin } from "@/lib/db/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { DEMO_ACCOUNTS, demoLoginEnabled } from "@/lib/auth/demo";

/**
 * One-click sign-in for the demo panel (D-16).
 *
 * Takes an account name, not a password: the demo password never reaches the
 * browser, so it cannot be lifted from the JavaScript bundle and tried against
 * a real deployment where someone reused it.
 *
 * Refuses unless DEMO_LOGIN=1. A one-click super admin on a public site is a
 * complete takeover of every school and student record — P6-09 checks this is
 * off before launch.
 */
const schema = z.object({ account: z.enum(DEMO_ACCOUNTS) });

export async function POST(req: Request) {
  if (!demoLoginEnabled()) {
    return NextResponse.json({ error: "Demo sign-in is disabled." }, { status: 403 });
  }
  const parsed = await parseBody(req, schema);
  if ("error" in parsed) return parsed.error;

  const user = await findUserByUsername(parsed.data.account);
  if (!user || user.status !== "active") {
    return NextResponse.json(
      { error: "Demo accounts are not set up. POST /api/auth/seed-demo first." },
      { status: 404 }
    );
  }

  await startSession(user);
  await Promise.all([
    touchLastLogin(user.id),
    audit({ actorUserId: user.id, action: "auth.login_demo", targetType: "user", targetId: user.id }),
  ]);

  return NextResponse.json({ user: toSafeUser(user), redirect: homeFor(user.role) });
}
