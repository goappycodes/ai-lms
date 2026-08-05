// Fire-and-forget in-process job runner. Fine for a single-node pilot; a
// production build would move this to a queue (BullMQ / Cloudflare Queues).
import { updateVideo } from "@/lib/db/repo";
import { processVideo } from "./pipeline";

const g = globalThis as unknown as { __aivedaJobs?: Set<string> };
const running: Set<string> = (g.__aivedaJobs ??= new Set());

export function isRunning(videoId: string): boolean {
  return running.has(videoId);
}

export function startEncodeJob(videoId: string): void {
  if (running.has(videoId)) return;
  running.add(videoId);
  // Do not await — let the request return immediately.
  processVideo(videoId)
    .catch((err) =>
      updateVideo(videoId, {
        status: "error",
        stage: "Failed",
        error: err instanceof Error ? err.message : String(err),
      })
    )
    .finally(() => running.delete(videoId));
}
