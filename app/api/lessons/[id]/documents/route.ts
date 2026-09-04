import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { bad, notFound, ok, serverError } from "@/lib/api";
import { createDocument, getLesson, listDocuments } from "@/lib/db/repo";
import { id } from "@/lib/ids";
import { r2Configured } from "@/lib/env";
import { putSingle } from "@/lib/video/r2";
import { asLocale, localeFrom } from "@/lib/locale";
import { requireContentAdmin } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = ["worksheet", "handout"] as const;

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const g = await requireContentAdmin();
  if ("response" in g) return g.response;

  try {
    if (!(await getLesson(params.id))) return notFound("lesson not found");
    const url = new URL(req.url);
    // No ?locale= means every language, which is what the slot grid needs.
    return ok(await listDocuments(params.id, url.searchParams.has("locale") ? localeFrom(req) : undefined));
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await requireContentAdmin();
  if ("response" in g) return g.response;

  try {
    if (!(await getLesson(params.id))) return notFound("lesson not found");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return bad("multipart field 'file' (a PDF) is required");

    const kind = String(form.get("kind") ?? "");
    if (!(KINDS as readonly string[]).includes(kind)) {
      return bad(`'kind' must be one of: ${KINDS.join(", ")}`);
    }
    const locale = asLocale(form.get("locale"));
    const title = (form.get("title") as string) || file.name.replace(/\.pdf$/i, "");

    const key = `${id("file")}.pdf`;
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

    // The key is stored, never the URL — see docs/SCHEMA.md.
    let storageKey: string;
    let storage: "r2" | "local";
    if (r2Configured()) {
      storageKey = `pdfs/${key}`;
      await putSingle(storageKey, tmp);
      storage = "r2";
      fs.rmSync(tmp, { force: true });
    } else {
      const pub = path.join(process.cwd(), "public", "files");
      fs.mkdirSync(pub, { recursive: true });
      fs.renameSync(tmp, path.join(pub, key));
      storageKey = `files/${key}`;
      storage = "local";
    }

    return ok(
      await createDocument(params.id, {
        kind: kind as (typeof KINDS)[number],
        locale,
        title,
        filename: file.name,
        storageKey,
        storage,
        sizeBytes: size,
      }),
      { status: 201 }
    );
  } catch (e) {
    return serverError(e);
  }
}
