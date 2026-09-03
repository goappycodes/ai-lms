import { notFound, ok, parseBody, serverError } from "@/lib/api";
import { deleteLesson, getLatestVideo, getLesson, listPdfs, updateLesson } from "@/lib/db/repo";
import { lessonUpdate } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const lesson = await getLesson(params.id);
    if (!lesson) return notFound("lesson not found");
    return ok({
      ...lesson,
      video: (await getLatestVideo(params.id)) ?? null,
      pdfs: await listPdfs(params.id),
    });
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const parsed = await parseBody(req, lessonUpdate);
    if ("error" in parsed) return parsed.error;
    const { durationMin, ...rest } = parsed.data;
    const patch = { ...rest, ...(durationMin !== undefined ? { duration_min: durationMin } : {}) };
    const updated = await updateLesson(params.id, patch as never);
    return updated ? ok(updated) : notFound("lesson not found");
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    return (await deleteLesson(params.id)) ? ok({ deleted: true }) : notFound("lesson not found");
  } catch (e) {
    return serverError(e);
  }
}
