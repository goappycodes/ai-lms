export type TrackId = "explorer" | "builder" | "achiever";

export interface Session {
  id: string; // `${trackId}-${n}`
  n: number; // 1-based position within the course
  title: string;
  covers: string; // what the session covers
  durationMin: number;
  advanced?: boolean; // Achiever-only sessions beyond the shared eight
}

export interface Track {
  id: TrackId;
  name: string;
  audience: string;
  tagline: string;
  accent: string; // CSS background for the thumbnail
  sessions: Session[];
}
