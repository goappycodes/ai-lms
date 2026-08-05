import { notFound, ok, parseBody, serverError } from "@/lib/api";
import { createLesson, getChapter, listLessons } from "@/lib/db/repo";
import { lessonCreate } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    if (!getChapter(params.id)) return notFound("chapter not found");
    return ok(listLessons(params.id));
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    if (!getChapter(params.id)) return notFound("chapter not found");
    const parsed = await parseBody(req, lessonCreate);
    if ("error" in parsed) return parsed.error;
    return ok(createLesson(params.id, parsed.data), { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
