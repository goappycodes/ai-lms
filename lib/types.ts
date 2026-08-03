export type TrackId = "explorer" | "builder" | "achiever";

export interface Session {
  id: string; // `${trackId}-${n}`
  n: number; // 1..16
  phase: string;
  title: string;
  takeaway: string;
  tools: string;
  durationMin: number;
}

export interface Track {
  id: TrackId;
  name: string;
  audience: string;
  tagline: string;
  accent: string; // CSS background for the thumbnail
  sessions: Session[];
}

export interface Phase {
  name: string;
  sessions: Session[];
}
