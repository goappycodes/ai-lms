import { TrackId } from "./types";

// SAMPLE PROGRESS ONLY.
//
// Identity, school, class and which course someone is enrolled in are now read
// from the database — see lib/db/org.ts. What remains here is watch progress,
// which has no real rows yet: lesson_progress is empty until the player writes
// to it (P4-02) and the student read path lands (P3-06..P3-08).
//
// Anything that still imports this is showing sample numbers, and the screens
// that do say so.

// Completed session numbers per track.
export const completed: Record<TrackId, number[]> = {
  explorer: [1, 2, 3, 4, 5],
  builder: [],
  achiever: [],
};

// Where "Resume" jumps to.
export const currentSession: Record<TrackId, number> = {
  explorer: 6,
  builder: 1,
  achiever: 1,
};

export function isDone(track: TrackId, n: number): boolean {
  return completed[track]?.includes(n) ?? false;
}

export function pct(track: TrackId, total: number): number {
  const c = completed[track]?.length ?? 0;
  return total ? Math.round((c / total) * 100) : 0;
}
