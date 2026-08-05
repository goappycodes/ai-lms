import { notFound, ok, parseBody, serverError } from "@/lib/api";
import { deleteChapter, updateChapter } from "@/lib/db/repo";
import { chapterUpdate } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const parsed = await parseBody(req, chapterUpdate);
    if ("error" in parsed) return parsed.error;
    const updated = updateChapter(params.id, parsed.data);
    return updated ? ok(updated) : notFound("chapter not found");
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    return deleteChapter(params.id) ? ok({ deleted: true }) : notFound("chapter not found");
  } catch (e) {
    return serverError(e);
  }
}
