import Link from "next/link";
import { Track } from "@/lib/types";
import { getPhases } from "@/lib/data";
import { completed, pct } from "@/lib/progress";

export default function CurriculumSidebar({
  track,
  currentId,
}: {
  track: Track;
  currentId: string;
}) {
  const phases = getPhases(track);
  const done = new Set(completed[track.id] ?? []);
  const p = pct(track.id, track.sessions.length);

  return (
    <aside className="curriculum">
      <div className="curriculum-head">
        <h2>Course content</h2>
        <span className="muted">
          {track.sessions.length} sessions · 6 phases · {p}% complete
        </span>
      </div>

      <ol className="phase-list">
        {phases.map((ph, i) => (
          <li key={ph.name} className="phase">
            <div className="phase-head">
              <span className="phase-index">Phase {i + 1}</span>
              <span className="phase-name">{ph.name}</span>
            </div>
            <ul className="session-list">
              {ph.sessions.map((s) => {
                const current = s.id === currentId;
                const isDone = done.has(s.n);
                return (
                  <li key={s.id}>
                    <Link
                      href={`/learn/${track.id}/${s.id}`}
                      className={"session-row" + (current ? " current" : "")}
                    >
                      <span className={"check" + (isDone ? " done" : "")} aria-hidden>
                        {isDone ? "✓" : ""}
                      </span>
                      <span className="session-title">
                        {s.n}. {s.title}
                      </span>
                      <span className="session-dur">{s.durationMin}m</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </aside>
  );
}
