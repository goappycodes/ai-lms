import { bad, notFound, ok, parseBody, serverError } from "@/lib/api";
import { createLesson, getCourse, listLessons } from "@/lib/db/repo";
import { lessonCreate } from "@/lib/validation";
import { localeFrom } from "@/lib/locale";
import { requireContentAdmin } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const g = await requireContentAdmin();
  if ("response" in g) return g.response;

  try {
    const locale = localeFrom(req);
    if (!(await getCourse(params.id, locale))) return notFound("course not found");
    return ok(await listLessons(params.id, locale));
  } catch (e) {
    return serverError(e);
  }
}

// Lessons are created against a course. The lesson row itself is not owned by
// one — attachLesson adds the same lesson to a second course (Builder ↔
// Achiever share eight of them).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await requireContentAdmin();
  if ("response" in g) return g.response;

  try {
    const locale = localeFrom(req);
    if (!(await getCourse(params.id, locale))) return notFound("course not found");
    const parsed = await parseBody(req, lessonCreate);
    if ("error" in parsed) return parsed.error;
    const { durationMin, ...rest } = parsed.data;
    return ok(await createLesson(params.id, { ...rest, durationMin, locale }), { status: 201 });
  } catch (e) {
    return e instanceof Error && /duplicate key/.test(e.message)
      ? bad("a lesson already sits at that position")
      : serverError(e);
  }
}
