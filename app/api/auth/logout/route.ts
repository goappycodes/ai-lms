import { NextResponse } from "next/server";
import { getCurrentSessionId, getCurrentUser } from "@/lib/auth/current";
import { endSession } from "@/lib/auth/session";
import { audit } from "@/lib/db/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  // Deleting the session row is what actually signs someone out — the cookie
  // stays cryptographically valid until it expires, so clearing it alone would
  // leave a copied cookie working.
  const [sessionId, user] = await Promise.all([getCurrentSessionId(), getCurrentUser()]);
  await endSession(sessionId ?? undefined);
  if (user) {
    await audit({ actorUserId: user.id, action: "auth.logout", targetType: "user", targetId: user.id });
  }
  return NextResponse.json({ ok: true });
}
