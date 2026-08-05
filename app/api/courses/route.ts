import { ok, parseBody, serverError } from "@/lib/api";
import { createCourse, listCourses } from "@/lib/db/repo";
import { courseCreate } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(listCourses());
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  try {
    const parsed = await parseBody(req, courseCreate);
    if ("error" in parsed) return parsed.error;
    return ok(createCourse(parsed.data), { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
