import { NextResponse } from "next/server";
import { parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { canManageClass, schoolIsOpen } from "@/lib/auth/scope";
import { ConflictError, createStudent, listClassStudents } from "@/lib/db/admin";
import { getPool } from "@/lib/db/pg";
import { audit } from "@/lib/db/users";
import { studentCreate } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if ("response" in g) return g.response;
  // Not a role check: a teacher reaches only the classes they are assigned to,
  // not every class in their school.
  const allow = await canManageClass(g.user, params.id);
  if (!allow.ok) return NextResponse.json({ error: allow.error }, { status: allow.status });

  return NextResponse.json(await listClassStudents(params.id));
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if ("response" in g) return g.response;
  const allow = await canManageClass(g.user, params.id);
  if (!allow.ok) return NextResponse.json({ error: allow.error }, { status: allow.status });

  const parsed = await parseBody(req, studentCreate);
  if ("error" in parsed) return parsed.error;

  // The school comes from the class, never from the request — a student cannot
  // be filed under a school the class does not belong to.
  const { rows } = await getPool().query<{ school_id: string }>(
    "SELECT school_id FROM classes WHERE id = $1",
    [params.id]
  );
  if (!rows.length) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  // Authority came from the class above; this is only about whether the
  // school is still taking people. A teacher has no school-level authority,
  // so canProvisionInSchool would wrongly refuse them here.
  const open = await schoolIsOpen(rows[0].school_id);
  if (!open.ok) return NextResponse.json({ error: open.error }, { status: open.status });

  try {
    const student = await createStudent({
      schoolId: rows[0].school_id,
      classId: params.id,
      fullName: parsed.data.fullName,
      username: parsed.data.username,
    });
    await audit({
      actorUserId: g.user.id,
      action: "student.create",
      targetType: "user",
      targetId: student.id,
      detail: { classId: params.id, username: student.username },
    });
    return NextResponse.json(student, { status: 201 });
  } catch (e) {
    if (e instanceof ConflictError) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
