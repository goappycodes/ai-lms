import { TrackId } from "./types";

// Mock per-student state for the scaffold. Replace with a real API / DB later.
export const student = {
  name: "Aparna Nair",
  school: "GHSS Kochi",
  class: "6B",
  initials: "AN",
};

export const enrolledTrack: TrackId = "explorer";

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
