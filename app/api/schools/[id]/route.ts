import { NextResponse } from "next/server";
import { parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { canManageSchool } from "@/lib/auth/scope";
import { getPool } from "@/lib/db/pg";
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
  const p = parsed.data;

  const { rowCount } = await getPool().query(
    `UPDATE schools SET name = COALESCE($1, name), district = COALESCE($2, district),
            code = COALESCE($3, code), updated_at = now() WHERE id = $4`,
    [p.name ?? null, p.district ?? null, p.code ?? null, params.id]
  );
  if (!rowCount) return NextResponse.json({ error: "School not found" }, { status: 404 });

  await audit({
    actorUserId: g.user.id,
    action: "school.update",
    targetType: "school",
    targetId: params.id,
    detail: p as Record<string, unknown>,
  });
  return NextResponse.json(await getSchoolOverview(params.id));
}
