import Link from "next/link";
import TopNav from "@/components/TopNav";
import { getTrack } from "@/lib/data";
import { completed } from "@/lib/progress";
import { requirePage } from "@/lib/auth/guard";

export default async function TeacherPage() {
  await requirePage("super_admin", "school", "teacher");

  const track = getTrack("explorer")!;
  const done = new Set(completed.explorer ?? []);

  return (
    <>
      <TopNav />
      <main className="container">
        <div className="page-head">
          <div>
            <h1>Teacher · Class 6B</h1>
            <p className="muted">GHSS Kochi · Explorer Track · 18 students</p>
          </div>
        </div>

        <div className="stat-row">
          <div className="stat">
            <span className="stat-num">18</span>
            <span className="stat-label">Students</span>
          </div>
          <div className="stat">
            <span className="stat-num">{done.size}/{track.sessions.length}</span>
            <span className="stat-label">Sessions covered</span>
          </div>
          <div className="stat">
            <span className="stat-num">83%</span>
            <span className="stat-label">Avg attendance</span>
          </div>
          <div className="stat">
            <span className="stat-num">0</span>
            <span className="stat-label">Certificates issued</span>
          </div>
        </div>

        <h2 className="section-title">Session coverage</h2>
        <div className="coverage">
          <div className="coverage-phase">
            {track.sessions.map((s) => (
              <div key={s.id} className="coverage-row">
                <span className={"check" + (done.has(s.n) ? " done" : "")}>
                  {done.has(s.n) ? "✓" : ""}
                </span>
                <span className="session-title">
                  {s.n}. {s.title}
                </span>
                <Link className="btn btn-small btn-primary" href={`/learn/${track.id}/${s.id}`}>
                  Play on panel
                </Link>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
