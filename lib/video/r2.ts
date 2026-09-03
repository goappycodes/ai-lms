// Ported from the ai-lms PoC: R2 (S3-compatible) upload of an HLS directory.
// Zero-egress delivery; segments cached immutably, playlists short-TTL.
import { S3Client, PutObjectCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import fs from "node:fs";
import path from "node:path";
import { r2 } from "@/lib/env";

const CONTENT_TYPES: Record<string, string> = {
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
  ".mp4": "video/mp4",
  ".m4s": "video/iso.segment",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".vtt": "text/vtt",
  ".pdf": "application/pdf",
};
export function contentTypeFor(file: string): string {
  return CONTENT_TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
}

function* walkDir(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkDir(full);
    else yield full;
  }
}

export function makeR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
  });
}

export async function ensureCors(client: S3Client): Promise<void> {
  try {
    await client.send(
      new PutBucketCorsCommand({
        Bucket: r2.bucket,
        CORSConfiguration: {
          CORSRules: [
            { AllowedMethods: ["GET", "HEAD"], AllowedOrigins: ["*"], AllowedHeaders: ["*"], MaxAgeSeconds: 86400 },
          ],
        },
      })
    );
  } catch {
    // Token may lack bucket-CORS permission; non-fatal (set CORS once in dashboard).
  }
}

export async function putFile(client: S3Client, key: string, file: string): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: r2.bucket,
      Key: key,
      Body: fs.createReadStream(file),
      ContentLength: fs.statSync(file).size,
      ContentType: contentTypeFor(file),
      // Everything here is immutable, playlists included. A VOD playlist is
      // written once during encode and never edited: a re-encode produces a new
      // videoId and therefore a new path. The old 60-second TTL made every
      // single play revalidate the manifest first — a round trip on the most
      // latency-sensitive request of the session, for a file that cannot change.
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
}

// Upload a directory tree to a key prefix with limited concurrency.
export async function uploadDir(
  client: S3Client,
  dir: string,
  prefix: string,
  opts: { onProgress?: (done: number, total: number) => void; concurrency?: number } = {}
): Promise<number> {
  const onProgress = opts.onProgress ?? (() => {});
  const concurrency = opts.concurrency ?? 5;
  const files = [...walkDir(dir)];
  let done = 0;
  let next = 0;
  const base = prefix.replace(/\/+$/, "");
  const worker = async () => {
    while (next < files.length) {
      const file = files[next++];
      const rel = path.relative(dir, file).split(path.sep).join("/");
      await putFile(client, `${base}/${rel}`, file);
      done += 1;
      onProgress(done, files.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
  return files.length;
}

// Upload a single file (e.g. a PDF) and return its public URL.
export async function putSingle(key: string, file: string): Promise<string> {
  const client = makeR2Client();
  await putFile(client, key, file);
  return `${r2.publicUrl}/${key}`;
}
