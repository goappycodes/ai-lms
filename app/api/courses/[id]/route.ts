import { NextRequest } from "next/server";
import { bad, notFound, ok, parseBody, serverError } from "@/lib/api";
import { deleteCourse, getCourse, getCourseTree, updateCourse } from "@/lib/db/repo";
import { courseUpdate } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tree = req.nextUrl.searchParams.get("tree");
    if (tree) {
      const t = await getCourseTree(params.id);
      return t ? ok(t) : notFound("course not found");
    }
    const c = await getCourse(params.id);
    return c ? ok(c) : notFound("course not found");
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const parsed = await parseBody(req, courseUpdate);
    if ("error" in parsed) return parsed.error;
    const updated = await updateCourse(params.id, parsed.data as never);
    return updated ? ok(updated) : notFound("course not found");
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    return (await deleteCourse(params.id)) ? ok({ deleted: true }) : notFound("course not found");
  } catch (e) {
    return serverError(e);
  }
}
