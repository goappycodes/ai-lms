import { NextResponse } from "next/server";
import { parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { canProvisionInSchool, resolveSchoolId } from "@/lib/auth/scope";
import { ConflictError, createTeacher } from "@/lib/db/admin";
import { getSchoolTeachers } from "@/lib/db/org";
import { audit } from "@/lib/db/users";
import { teacherCreate } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A school never names its own school id, and cannot name another's. A super
// admin has no school of their own, so must say which one.
export async function GET(req: Request) {
  const g = await requireUser();
  if ("response" in g) return g.response;

  const scope = resolveSchoolId(g.user, new URL(req.url).searchParams.get("schoolId"));
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const allow = canProvisionInSchool(g.user, scope.schoolId);
  if (!allow.ok) return NextResponse.json({ error: allow.error }, { status: allow.status });

  return NextResponse.json(await getSchoolTeachers(scope.schoolId));
}

export async function POST(req: Request) {
  const g = await requireUser();
  if ("response" in g) return g.response;

  const parsed = await parseBody(req, teacherCreate);
  if ("error" in parsed) return parsed.error;

  const scope = resolveSchoolId(g.user, parsed.data.schoolId);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const allow = canProvisionInSchool(g.user, scope.schoolId);
  if (!allow.ok) return NextResponse.json({ error: allow.error }, { status: allow.status });

  try {
    const teacher = await createTeacher({
      schoolId: scope.schoolId,
      fullName: parsed.data.fullName,
      username: parsed.data.username,
      email: parsed.data.email,
      classIds: parsed.data.classIds,
    });
    await audit({
      actorUserId: g.user.id,
      action: "teacher.create",
      targetType: "user",
      targetId: teacher.id,
      detail: { schoolId: scope.schoolId, username: teacher.username },
    });
    return NextResponse.json(teacher, { status: 201 });
  } catch (e) {
    if (e instanceof ConflictError) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
