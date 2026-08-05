import { notFound, ok, parseBody, serverError } from "@/lib/api";
import { getCertificate, getCourse, upsertCertificate } from "@/lib/db/repo";
import { certificateUpsert } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    if (!getCourse(params.id)) return notFound("course not found");
    return ok(getCertificate(params.id) ?? null);
  } catch (e) {
    return serverError(e);
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    if (!getCourse(params.id)) return notFound("course not found");
    const parsed = await parseBody(req, certificateUpsert);
    if ("error" in parsed) return parsed.error;
    return ok(upsertCertificate(params.id, parsed.data as never));
  } catch (e) {
    return serverError(e);
  }
}
