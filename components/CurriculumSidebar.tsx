import Link from "next/link";
import { Track } from "@/lib/types";
import { completed, pct } from "@/lib/progress";

export default function CurriculumSidebar({
  track,
  currentId,
}: {
  track: Track;
  currentId: string;
}) {
  const done = new Set(completed[track.id] ?? []);
  const p = pct(track.id, track.sessions.length);

  return (
    <aside className="curriculum">
      <div className="curriculum-head">
        <h2>Course content</h2>
        <span className="muted">
          {track.sessions.length} sessions · {p}% complete
        </span>
      </div>

      <ul className="session-list">
        {track.sessions.map((s) => {
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
    </aside>
  );
}
