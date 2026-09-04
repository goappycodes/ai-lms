import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { bad, notFound, ok, serverError } from "@/lib/api";
import { createVideo, getLatestVideo, getLesson } from "@/lib/db/repo";
import { uploadPathFor } from "@/lib/video/pipeline";
import { startEncodeJob } from "@/lib/video/jobs";
import { findBinary } from "@/lib/video/ffmpeg";
import { asLocale, localeFrom } from "@/lib/locale";
import { requireContentAdmin } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const g = await requireContentAdmin();
  if ("response" in g) return g.response;

  try {
    if (!(await getLesson(params.id))) return notFound("lesson not found");
    return ok((await getLatestVideo(params.id, localeFrom(req))) ?? null);
  } catch (e) {
    return serverError(e);
  }
}

// Upload a source video → encode an HLS ladder → publish to R2 (or a local
// fallback). One video per lesson per language: Malayalam is a separate
// recording, not a second audio track (Q1).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await requireContentAdmin();
  if ("response" in g) return g.response;

  try {
    if (!(await getLesson(params.id))) return notFound("lesson not found");

    // Encoding is deliberately off-platform (needs ffmpeg + a writable disk).
    // On hosts without ffmpeg (e.g. Vercel serverless) reject with guidance.
    if (!findBinary("ffmpeg")) {
      return bad(
        "This server can't encode video (no ffmpeg — e.g. Vercel). Upload videos from a machine running the app locally with R2 configured; they'll encode, publish to R2, and appear here automatically.",
        501
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return bad("multipart field 'file' (a video) is required");
    const locale = asLocale(form.get("locale"));

    const video = await createVideo(params.id, locale, file.name);
    const dir = uploadPathFor(video.id);
    fs.mkdirSync(dir, { recursive: true });
    const safe = file.name.replace(/[^\w.\-]+/g, "_") || "source.mp4";
    const dest = path.join(dir, safe);

    await new Promise<void>((resolve, reject) => {
      const ws = fs.createWriteStream(dest);
      Readable.fromWeb(file.stream() as never)
        .pipe(ws)
        .on("finish", () => resolve())
        .on("error", reject);
    });

    // Detached — encoding + R2 upload run in the background; poll the video row.
    startEncodeJob(video.id);
    return ok(video, { status: 202 });
  } catch (e) {
    return serverError(e);
  }
}
