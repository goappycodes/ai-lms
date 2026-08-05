import { notFound, ok, serverError } from "@/lib/api";
import { deletePdf } from "@/lib/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    return deletePdf(params.id) ? ok({ deleted: true }) : notFound("pdf not found");
  } catch (e) {
    return serverError(e);
  }
}
