import { NextResponse } from "next/server";
import { parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { canManageSchool, canProvisionInSchool, resolveSchoolId } from "@/lib/auth/scope";
import { ConflictError, createClass } from "@/lib/db/admin";
import { getSchoolClasses } from "@/lib/db/org";
import { audit } from "@/lib/db/users";
import { classCreate } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await requireUser();
  if ("response" in g) return g.response;

  const scope = resolveSchoolId(g.user, new URL(req.url).searchParams.get("schoolId"));
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const allow = canManageSchool(g.user, scope.schoolId);
  if (!allow.ok) return NextResponse.json({ error: allow.error }, { status: allow.status });

  return NextResponse.json(await getSchoolClasses(scope.schoolId));
}

export async function POST(req: Request) {
  const g = await requireUser();
  if ("response" in g) return g.response;

  const parsed = await parseBody(req, classCreate);
  if ("error" in parsed) return parsed.error;

  const scope = resolveSchoolId(g.user, parsed.data.schoolId);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const allow = await canProvisionInSchool(g.user, scope.schoolId);
  if (!allow.ok) return NextResponse.json({ error: allow.error }, { status: allow.status });

  try {
    // The course follows from the level through course_levels (P2-15); nobody
    // picks one, so a class cannot be enrolled in the wrong thing.
    const cls = await createClass({
      schoolId: scope.schoolId,
      name: parsed.data.name,
      level: parsed.data.level,
      academicYear: parsed.data.academicYear,
    });
    await audit({
      actorUserId: g.user.id,
      action: "class.create",
      targetType: "class",
      targetId: cls.id,
      detail: { schoolId: scope.schoolId, name: parsed.data.name, level: parsed.data.level },
    });
    return NextResponse.json(cls, { status: 201 });
  } catch (e) {
    if (e instanceof ConflictError) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
