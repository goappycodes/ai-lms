import { NextResponse } from "next/server";
import { parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { ConflictError, createSchoolWithLogin, listSchools } from "@/lib/db/admin";
import { audit } from "@/lib/db/users";
import { schoolCreate } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireRole("super_admin");
  if ("response" in g) return g.response;
  return NextResponse.json(await listSchools());
}

// P2-11: one request creates the school and the login that IS that school.
// Two forms would leave a school with no way in, or a login pointing nowhere.
export async function POST(req: Request) {
  const g = await requireRole("super_admin");
  if ("response" in g) return g.response;

  const parsed = await parseBody(req, schoolCreate);
  if ("error" in parsed) return parsed.error;

  try {
    const { schoolId, login } = await createSchoolWithLogin(parsed.data);
    await audit({
      actorUserId: g.user.id,
      action: "school.create",
      targetType: "school",
      targetId: schoolId,
      detail: { name: parsed.data.name, username: login.username },
    });
    // The password is returned once and never stored in plain form.
    return NextResponse.json({ schoolId, login }, { status: 201 });
  } catch (e) {
    if (e instanceof ConflictError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }
}
