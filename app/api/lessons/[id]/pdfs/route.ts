import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { bad, notFound, ok, serverError } from "@/lib/api";
import { createPdf, getLesson, listPdfs } from "@/lib/db/repo";
import { id } from "@/lib/ids";
import { r2Configured } from "@/lib/env";
import { putSingle } from "@/lib/video/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await getLesson(params.id))) return notFound("lesson not found");
    return ok(await listPdfs(params.id));
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await getLesson(params.id))) return notFound("lesson not found");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return bad("multipart field 'file' (a PDF) is required");
    const title = (form.get("title") as string) || file.name.replace(/\.pdf$/i, "");

    const key = `${id("file")}.pdf`;
    // Stage to a temp path first.
    const tmpDir = path.join(process.cwd(), "data", "tmp");
    fs.mkdirSync(tmpDir, { recursive: true });
    const tmp = path.join(tmpDir, key);
    await new Promise<void>((resolve, reject) => {
      const ws = fs.createWriteStream(tmp);
      Readable.fromWeb(file.stream() as never)
        .pipe(ws)
        .on("finish", () => resolve())
        .on("error", reject);
    });
    const size = fs.statSync(tmp).size;

    let url: string;
    let storage: "r2" | "local";
    if (r2Configured()) {
      url = await putSingle(`pdfs/${key}`, tmp);
      storage = "r2";
      fs.rmSync(tmp, { force: true });
    } else {
      const pub = path.join(process.cwd(), "public", "files");
      fs.mkdirSync(pub, { recursive: true });
      fs.renameSync(tmp, path.join(pub, key));
      url = `/files/${key}`;
      storage = "local";
    }

    return ok(await createPdf(params.id, { title, filename: file.name, url, storage, sizeBytes: size }), { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
