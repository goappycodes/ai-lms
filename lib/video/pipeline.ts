// Orchestrates one video: encode (ffmpeg HLS ladder) → publish (R2 or local
// fallback) → update the DB row with progress, urls and status.
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, r2, r2Configured } from "@/lib/env";
import { getVideo, getLatestVideo, updateVideo } from "@/lib/db/repo";
import { encodeHlsLadder, probeVideo, rungsFor } from "./ffmpeg";
import { ensureCors, makeR2Client, uploadDir } from "./r2";

// Weight: encoding is the long pole (~85%), publishing ~15%.
const ENCODE_SHARE = 0.85;

export function uploadPathFor(videoId: string): string {
  return path.join(DATA_DIR, "uploads", videoId);
}

function copyDir(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

export async function processVideo(videoId: string): Promise<void> {
  const video = await getVideo(videoId);
  if (!video) throw new Error(`video ${videoId} not found`);

  const uploadDirPath = uploadPathFor(videoId);
  const files = fs.existsSync(uploadDirPath) ? fs.readdirSync(uploadDirPath) : [];
  if (!files.length) throw new Error("uploaded source file missing");
  const input = path.join(uploadDirPath, files[0]);

  await updateVideo(videoId, { status: "encoding", stage: "Probing source", progress: 0, error: null });

  // Pre-compute rungs so we can map per-rung progress to an overall number.
  const { height } = probeVideo(input);
  const expected = rungsFor(height).map((r) => r.name);

  const workDir = path.join(DATA_DIR, "work", videoId, "hls");
  fs.rmSync(path.join(DATA_DIR, "work", videoId), { recursive: true, force: true });

  // Throttle DB writes: the DB is now remote (Supabase), and ffmpeg emits
  // progress many times per second. Persist only on ~2% moves or stage change.
  let lastWritten = -1;
  let lastStage = "";
  const result = await encodeHlsLadder(input, workDir, {
    onLog: () => {},
    onProgress: (name, frac) => {
      const i = Math.max(0, expected.indexOf(name));
      const overall = Number(((i + frac) / expected.length * ENCODE_SHARE).toFixed(3));
      const stage = `Encoding ${name} · ${Math.round(frac * 100)}%`;
      if (overall - lastWritten >= 0.02 || name !== lastStage.split(" ")[1]) {
        lastWritten = overall;
        lastStage = stage;
        void updateVideo(videoId, { status: "encoding", stage, progress: overall });
      }
    },
  });

  // ---- Publish: R2 if configured, else local /public/hls fallback ----
  const keyPrefix = `hls/${videoId}`;
  let storage: "r2" | "local";
  let masterUrl: string;
  let posterUrl: string | null;

  if (r2Configured()) {
    await updateVideo(videoId, { status: "uploading", stage: "Uploading to Cloudflare R2", progress: ENCODE_SHARE });
    const client = makeR2Client();
    await ensureCors(client);
    let lastPct = -1;
    await uploadDir(client, workDir, keyPrefix, {
      onProgress: (done, total) => {
        const overall = ENCODE_SHARE + (done / total) * (1 - ENCODE_SHARE);
        if (overall - lastPct >= 0.02 || done === total) {
          lastPct = overall;
          void updateVideo(videoId, {
            status: "uploading",
            stage: `Uploading to R2 · ${done}/${total} files`,
            progress: Number(overall.toFixed(3)),
          });
        }
      },
    });
    storage = "r2";
    masterUrl = `${r2.publicUrl}/${keyPrefix}/master.m3u8`;
    posterUrl = result.hasPoster ? `${r2.publicUrl}/${keyPrefix}/poster.jpg` : null;
  } else {
    await updateVideo(videoId, { status: "uploading", stage: "Publishing locally (R2 not configured)", progress: ENCODE_SHARE });
    const publicDir = path.join(process.cwd(), "public", keyPrefix);
    fs.rmSync(publicDir, { recursive: true, force: true });
    copyDir(workDir, publicDir);
    storage = "local";
    masterUrl = `/${keyPrefix}/master.m3u8`;
    posterUrl = result.hasPoster ? `/${keyPrefix}/poster.jpg` : null;
  }

  await updateVideo(videoId, {
    status: "ready",
    stage: "Ready",
    progress: 1,
    storage,
    master_url: masterUrl,
    poster_url: posterUrl,
    renditions: JSON.stringify(result.renditions),
    duration_sec: result.duration,
    error: null,
  });

  // Free the encode working directory (keep the original upload for re-encode).
  fs.rmSync(path.join(DATA_DIR, "work", videoId), { recursive: true, force: true });
}

// If a video was interrupted mid-encode by a server restart, surface it.
export async function markStaleAsError(lessonId: string) {
  const v = await getLatestVideo(lessonId);
  if (v && (v.status === "encoding" || v.status === "uploading")) {
    await updateVideo(v.id, { status: "error", error: "Interrupted by server restart — re-upload to retry." });
  }
}
