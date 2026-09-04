import { NextResponse } from "next/server";
import { parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { canManageSchool } from "@/lib/auth/scope";
import { ConflictError, setSchoolStatus, updateSchool } from "@/lib/db/admin";
import { audit } from "@/lib/db/users";
import { getSchoolOverview } from "@/lib/db/org";
import { schoolUpdate } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if ("response" in g) return g.response;
  const allow = canManageSchool(g.user, params.id);
  if (!allow.ok) return NextResponse.json({ error: allow.error }, { status: allow.status });

  const school = await getSchoolOverview(params.id);
  return school
    ? NextResponse.json(school)
    : NextResponse.json({ error: "School not found" }, { status: 404 });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if ("response" in g) return g.response;
  const allow = canManageSchool(g.user, params.id);
  if (!allow.ok) return NextResponse.json({ error: allow.error }, { status: allow.status });

  const parsed = await parseBody(req, schoolUpdate);
  if ("error" in parsed) return parsed.error;
  const { status, ...fields } = parsed.data;

  // Archiving is its own act, and only a super admin may do it — a school
  // must not be able to archive itself out of the platform.
  if (status !== undefined && g.user.role !== "super_admin") {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  try {
    if (!(await updateSchool(params.id, fields))) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }
  } catch (e) {
    if (e instanceof ConflictError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }

  if (status !== undefined) {
    if (!(await setSchoolStatus(params.id, status))) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }
  }

  await audit({
    actorUserId: g.user.id,
    action: status === "archived" ? "school.archive" : status ? "school.restore" : "school.update",
    targetType: "school",
    targetId: params.id,
    detail: parsed.data as Record<string, unknown>,
  });
  return NextResponse.json(await getSchoolOverview(params.id));
}
