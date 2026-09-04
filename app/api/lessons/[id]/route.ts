import { notFound, ok, parseBody, serverError } from "@/lib/api";
import {
  LOCALES,
  deleteLesson,
  getLatestVideo,
  getLesson,
  listDocuments,
  listLessonTranslations,
  coursesUsingLesson,
  updateLesson,
} from "@/lib/db/repo";
import { lessonUpdate } from "@/lib/validation";
import { localeFrom } from "@/lib/locale";
import { requireContentAdmin } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const g = await requireContentAdmin();
  if ("response" in g) return g.response;

  try {
    const locale = localeFrom(req);
    const lesson = await getLesson(params.id, undefined, locale);
    if (!lesson) return notFound("lesson not found");

    // Every language's video, so the Studio can render the slot grid rather
    // than only the language it happens to be viewing in.
    const videos = Object.fromEntries(
      await Promise.all(LOCALES.map(async (l) => [l, (await getLatestVideo(params.id, l)) ?? null]))
    );
    return ok({
      ...lesson,
      videos,
      documents: await listDocuments(params.id),
      translations: await listLessonTranslations(params.id),
      courses: await coursesUsingLesson(params.id),
    });
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await requireContentAdmin();
  if ("response" in g) return g.response;

  try {
    const parsed = await parseBody(req, lessonUpdate);
    if ("error" in parsed) return parsed.error;
    const { durationMin, ...rest } = parsed.data;
    const updated = await updateLesson(params.id, {
      ...rest,
      ...(durationMin !== undefined ? { duration_min: durationMin } : {}),
      locale: localeFrom(req),
    });
    return updated ? ok(updated) : notFound("lesson not found");
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await requireContentAdmin();
  if ("response" in g) return g.response;

  try {
    return (await deleteLesson(params.id)) ? ok({ deleted: true }) : notFound("lesson not found");
  } catch (e) {
    // The schema refuses to delete a lesson a course still uses — it may be
    // shared, and the person deleting is probably looking at only one course.
    if (e instanceof Error && /foreign key|violates/i.test(e.message)) {
      return Response.json(
        { error: "This lesson is still used by a course. Remove it from the course first." },
        { status: 409 }
      );
    }
    return serverError(e);
  }
}
