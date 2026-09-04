import { NextResponse } from "next/server";
import { parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { canManageUser } from "@/lib/auth/scope";
import { renameUser, setUserStatus } from "@/lib/db/admin";
import { audit, findUserById, toSafeUser } from "@/lib/db/users";
import { userUpdate } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if ("response" in g) return g.response;
  const allow = await canManageUser(g.user, params.id);
  if (!allow.ok) return NextResponse.json({ error: allow.error }, { status: allow.status });

  const parsed = await parseBody(req, userUpdate);
  if ("error" in parsed) return parsed.error;
  const { fullName, status } = parsed.data;

  if (fullName !== undefined) {
    await renameUser(params.id, fullName);
    await audit({ actorUserId: g.user.id, action: "user.rename", targetType: "user", targetId: params.id });
  }
  if (status !== undefined) {
    // Disabling also ends every live session for that person, so access stops
    // now rather than whenever their cookie happens to expire.
    await setUserStatus(params.id, status);
    await audit({
      actorUserId: g.user.id,
      action: status === "disabled" ? "user.disable" : "user.enable",
      targetType: "user",
      targetId: params.id,
    });
  }

  const updated = await findUserById(params.id);
  return updated
    ? NextResponse.json(toSafeUser(updated))
    : NextResponse.json({ error: "User not found" }, { status: 404 });
}
