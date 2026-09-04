import { ok, parseBody, serverError } from "@/lib/api";
import { createCourse, listCourses } from "@/lib/db/repo";
import { courseCreate } from "@/lib/validation";
import { requireContentAdmin } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const g = await requireContentAdmin();
  if ("response" in g) return g.response;

  try {
    return ok(await listCourses());
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const g = await requireContentAdmin();
  if ("response" in g) return g.response;

  try {
    const parsed = await parseBody(req, courseCreate);
    if ("error" in parsed) return parsed.error;
    return ok(await createCourse(parsed.data), { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
