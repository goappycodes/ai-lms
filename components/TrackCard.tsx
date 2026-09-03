import Link from "next/link";
import { Track } from "@/lib/types";
import { completed, pct } from "@/lib/progress";
import ProgressBar from "./ProgressBar";

export default function TrackCard({ track, enrolled }: { track: Track; enrolled: boolean }) {
  const total = track.sessions.length;
  const done = completed[track.id]?.length ?? 0;
  const p = pct(track.id, total);

  return (
    <div className="track-card">
      <div className="thumb" style={{ background: track.accent }}>
        <span className="thumb-track">{track.name}</span>
        <span className="thumb-audience">{track.audience}</span>
      </div>
      <div className="track-body">
        <h3>{track.name} Track</h3>
        <p className="muted">{track.tagline}</p>

        {enrolled ? (
          <>
            <ProgressBar value={p} />
            <div className="track-meta">
              <span>
                {done} / {total} sessions
              </span>
              <span>{p}%</span>
            </div>
            <Link className="btn btn-primary" href={`/learn/${track.id}`}>
              {done ? "Resume" : "Start"}
            </Link>
          </>
        ) : (
          <>
            <div className="track-meta">
              <span>
                {total} sessions · {track.audience}
              </span>
              <span className="pill draft">Not enrolled</span>
            </div>
            <Link className="btn btn-ghost" href={`/learn/${track.id}`}>
              Preview
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
