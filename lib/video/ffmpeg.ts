// Ported from the ai-lms PoC (lib/providers.mjs): probe + multi-bitrate HLS
// ladder encode with ffmpeg. The 240p "survival rung" targets ~0.6 Mbps links.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface Rung {
  name: string;
  height: number;
  vBitrate: string;
  maxrate: string;
  bufsize: string;
  aBitrate: string;
}

export const LADDER: Rung[] = [
  { name: "1080p", height: 1080, vBitrate: "5000k", maxrate: "5350k", bufsize: "7500k", aBitrate: "128k" },
  { name: "720p", height: 720, vBitrate: "2800k", maxrate: "2996k", bufsize: "4200k", aBitrate: "128k" },
  { name: "480p", height: 480, vBitrate: "1400k", maxrate: "1498k", bufsize: "2100k", aBitrate: "96k" },
  { name: "360p", height: 360, vBitrate: "800k", maxrate: "856k", bufsize: "1200k", aBitrate: "96k" },
  // Survival rung for ~0.6 Mbps (2G / weak-3G): ~440 kbps total.
  { name: "240p", height: 240, vBitrate: "350k", maxrate: "375k", bufsize: "560k", aBitrate: "64k" },
];
export const SEGMENT_SECONDS = 4;

// ffmpeg may be on PATH, or installed by winget after the process started.
export function findBinary(name: string): string | null {
  if (spawnSync(name, ["-version"]).status === 0) return name;
  const wingetRoot = path.join(os.homedir(), "AppData", "Local", "Microsoft", "WinGet");
  const candidates = [path.join(wingetRoot, "Links", `${name}.exe`)];
  const pkgRoot = path.join(wingetRoot, "Packages");
  if (fs.existsSync(pkgRoot)) {
    for (const pkg of fs.readdirSync(pkgRoot)) {
      if (!/ffmpeg/i.test(pkg)) continue;
      const pkgDir = path.join(pkgRoot, pkg);
      for (const sub of fs.readdirSync(pkgDir)) {
        candidates.push(path.join(pkgDir, sub, "bin", `${name}.exe`));
      }
    }
  }
  for (const c of candidates) {
    if (fs.existsSync(c) && spawnSync(c, ["-version"]).status === 0) return c;
  }
  return null;
}

export function probeVideo(input: string): { height: number | null; duration: number | null } {
  const ffprobe = findBinary("ffprobe");
  if (!ffprobe) return { height: null, duration: null };
  const out = spawnSync(ffprobe, [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=height:format=duration",
    "-of", "json", input,
  ]);
  try {
    const json = JSON.parse(out.stdout.toString());
    return {
      height: json.streams?.[0]?.height ?? null,
      duration: Number(json.format?.duration) || null,
    };
  } catch {
    return { height: null, duration: null };
  }
}

// Which rungs will be produced for a given source (no upscaling).
export function rungsFor(sourceHeight: number | null): Rung[] {
  const r = LADDER.filter((x) => x.height <= (sourceHeight || Infinity));
  return r.length ? r : [LADDER[LADDER.length - 1]];
}

function runFfmpeg(
  ffmpeg: string,
  args: string[],
  duration: number | null,
  onProgress: ((f: number) => void) | null
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, args);
    let stderrTail = "";
    proc.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderrTail = (stderrTail + text).slice(-4000);
      const m = text.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (m && duration && onProgress) {
        const secs = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
        onProgress(Math.min(0.999, secs / duration));
      }
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: …${stderrTail.slice(-600)}`));
    });
  });
}

export interface EncodeResult {
  renditions: string[];
  duration: number | null;
  hasPoster: boolean;
}

// Encode a multi-bitrate HLS ladder into outDir (master.m3u8 + poster.jpg).
export async function encodeHlsLadder(
  input: string,
  outDir: string,
  opts: { onLog?: (m: string) => void; onProgress?: (name: string, fraction: number) => void } = {}
): Promise<EncodeResult> {
  const onLog = opts.onLog ?? (() => {});
  const onProgress = opts.onProgress ?? (() => {});
  const ffmpeg = findBinary("ffmpeg");
  if (!ffmpeg) throw new Error("ffmpeg not found. Install it (winget install Gyan.FFmpeg) and retry.");

  const { height: sourceHeight, duration } = probeVideo(input);
  const renditions = rungsFor(sourceHeight);
  fs.mkdirSync(outDir, { recursive: true });

  for (const r of renditions) {
    const dir = path.join(outDir, r.name);
    fs.mkdirSync(dir, { recursive: true });
    onLog(`Encoding ${r.name}…`);
    const args = [
      "-y", "-i", input,
      "-vf", `scale=-2:${r.height}`,
      "-c:v", "libx264", "-profile:v", "main", "-preset", "fast",
      "-b:v", r.vBitrate, "-maxrate", r.maxrate, "-bufsize", r.bufsize,
      "-force_key_frames", `expr:gte(t,n_forced*${SEGMENT_SECONDS})`,
      "-c:a", "aac", "-b:a", r.aBitrate, "-ac", "2",
      "-hls_time", String(SEGMENT_SECONDS),
      "-hls_playlist_type", "vod",
      "-hls_segment_filename", path.join(dir, "seg_%04d.ts"),
      path.join(dir, "index.m3u8"),
    ];
    await runFfmpeg(ffmpeg, args, duration, (f) => onProgress(r.name, f));
    onProgress(r.name, 1);
  }

  let hasPoster = false;
  try {
    onLog("Generating poster.jpg…");
    await runFfmpeg(
      ffmpeg,
      ["-y", "-ss", "2", "-i", input, "-frames:v", "1", "-vf", "scale=-2:720", "-q:v", "3", path.join(outDir, "poster.jpg")],
      null,
      null
    );
    hasPoster = true;
  } catch (err) {
    onLog(`Poster generation failed (continuing): ${(err as Error).message}`);
  }

  // Master playlist. Bandwidth = video maxrate + audio bitrate with headroom.
  const toBps = (s: string) => parseInt(s, 10) * 1000;
  const master = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    ...renditions.flatMap((r) => {
      const bandwidth = Math.round((toBps(r.maxrate) + toBps(r.aBitrate)) * 1.1);
      const width = Math.round((r.height * 16) / 9 / 2) * 2;
      return [
        `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${width}x${r.height},CODECS="avc1.4d401f,mp4a.40.2"`,
        `${r.name}/index.m3u8`,
      ];
    }),
  ].join("\n");
  fs.writeFileSync(path.join(outDir, "master.m3u8"), master + "\n");
  onLog(`HLS ladder done: ${renditions.map((r) => r.name).join(", ")}`);
  return { renditions: renditions.map((r) => r.name), duration, hasPoster };
}
