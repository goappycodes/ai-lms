import { notFound, ok, parseBody, serverError } from "@/lib/api";
import { createChapter, getCourse, listChapters } from "@/lib/db/repo";
import { chapterCreate } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await getCourse(params.id))) return notFound("course not found");
    return ok(await listChapters(params.id));
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await getCourse(params.id))) return notFound("course not found");
    const parsed = await parseBody(req, chapterCreate);
    if ("error" in parsed) return parsed.error;
    return ok(await createChapter(params.id, parsed.data.title), { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
