import { notFound, ok, serverError } from "@/lib/api";
import { getVideo } from "@/lib/db/repo";
import { isRunning } from "@/lib/video/jobs";
import { requireContentAdmin } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Poll endpoint for encode/upload progress.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await requireContentAdmin();
  if ("response" in g) return g.response;

  try {
    const v = await getVideo(params.id);
    if (!v) return notFound("video not found");
    return ok({
      ...v,
      running: isRunning(v.id),
    });
  } catch (e) {
    return serverError(e);
  }
}
