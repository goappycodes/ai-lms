import { notFound, ok, parseBody, serverError } from "@/lib/api";
import { getCertificateTemplate, getCourse, upsertCertificateTemplate } from "@/lib/db/repo";
import { certificateUpsert } from "@/lib/validation";
import { requireContentAdmin } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await requireContentAdmin();
  if ("response" in g) return g.response;

  try {
    if (!(await getCourse(params.id))) return notFound("course not found");
    return ok((await getCertificateTemplate(params.id)) ?? null);
  } catch (e) {
    return serverError(e);
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const g = await requireContentAdmin();
  if ("response" in g) return g.response;

  try {
    if (!(await getCourse(params.id))) return notFound("course not found");
    const parsed = await parseBody(req, certificateUpsert);
    if ("error" in parsed) return parsed.error;
    return ok(await upsertCertificateTemplate(params.id, parsed.data as never));
  } catch (e) {
    return serverError(e);
  }
}
