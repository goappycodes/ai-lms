import { notFound, ok, serverError } from "@/lib/api";
import { getVideo } from "@/lib/db/repo";
import { isRunning } from "@/lib/video/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Poll endpoint for encode/upload progress.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const v = getVideo(params.id);
    if (!v) return notFound("video not found");
    return ok({
      ...v,
      renditions: v.renditions ? JSON.parse(v.renditions) : null,
      running: isRunning(v.id),
    });
  } catch (e) {
    return serverError(e);
  }
}
