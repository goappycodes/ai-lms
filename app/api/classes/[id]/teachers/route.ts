import { NextResponse } from "next/server";
import { parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { canManageClass, canManageUser } from "@/lib/auth/scope";
import { assignTeacher, unassignTeacher } from "@/lib/db/admin";
import { audit, type SafeUser } from "@/lib/db/users";
import { teacherAssign } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Assigning needs authority over BOTH the class and the teacher. Checking only
// the class would let a school attach someone from another school; checking
// only the teacher would let them attach to a class they do not run.
// Takes the caller rather than resolving it, so both handlers can authenticate
// before they parse. Returns the refusal, or null to proceed.
async function authorise(actor: SafeUser, classId: string, teacherUserId: string) {
  for (const check of [
    await canManageClass(actor, classId),
    await canManageUser(actor, teacherUserId),
  ]) {
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  }
  return null;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  // Authenticate first: a stranger should get 401, not a 400 that describes
  // the body this route expects.
  const g = await requireUser();
  if ("response" in g) return g.response;

  const parsed = await parseBody(req, teacherAssign);
  if ("error" in parsed) return parsed.error;

  const denied = await authorise(g.user, params.id, parsed.data.teacherUserId);
  if (denied) return denied;

  // The insert itself re-checks that both sit in the same school, so a race
  // between this check and the write cannot produce a cross-school link.
  const done = await assignTeacher(params.id, parsed.data.teacherUserId);
  if (!done) {
    return NextResponse.json(
      { error: "That teacher could not be assigned — check they belong to this school." },
      { status: 409 }
    );
  }
  await audit({
    actorUserId: g.user.id,
    action: "class.assign_teacher",
    targetType: "class",
    targetId: params.id,
    detail: { teacherUserId: parsed.data.teacherUserId },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if ("response" in g) return g.response;

  const teacherUserId = new URL(req.url).searchParams.get("teacherUserId") ?? "";
  if (!teacherUserId) {
    return NextResponse.json({ error: "teacherUserId is required" }, { status: 400 });
  }
  const denied = await authorise(g.user, params.id, teacherUserId);
  if (denied) return denied;

  const done = await unassignTeacher(params.id, teacherUserId);
  if (done) {
    await audit({
      actorUserId: g.user.id,
      action: "class.unassign_teacher",
      targetType: "class",
      targetId: params.id,
      detail: { teacherUserId },
    });
  }
  return NextResponse.json({ ok: done });
}
