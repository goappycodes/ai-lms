import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { bad, notFound, ok, serverError } from "@/lib/api";
import { createVideo, getLatestVideo, getLesson } from "@/lib/db/repo";
import { uploadPathFor } from "@/lib/video/pipeline";
import { startEncodeJob } from "@/lib/video/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    if (!getLesson(params.id)) return notFound("lesson not found");
    return ok(getLatestVideo(params.id) ?? null);
  } catch (e) {
    return serverError(e);
  }
}

// Upload a source video → encode HLS ladder → publish to R2 (or local fallback).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    if (!getLesson(params.id)) return notFound("lesson not found");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return bad("multipart field 'file' (a video) is required");

    const video = createVideo(params.id, file.name);
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
