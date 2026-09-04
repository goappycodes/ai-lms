import Link from "next/link";
import TopNav from "@/components/TopNav";
import { requirePage } from "@/lib/auth/guard";
import { getTeacherClasses, getUserContext } from "@/lib/db/org";
import { getTrack } from "@/lib/data";
import { completed } from "@/lib/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TeacherPage() {
  const user = await requirePage("teacher", "school", "super_admin");
  const [ctx, classes] = await Promise.all([
    getUserContext(user.id),
    getTeacherClasses(user.id),
  ]);

  const students = classes.reduce((n, c) => n + c.student_count, 0);

  return (
    <>
      <TopNav />
      <main className="container">
        <div className="page-head">
          <div>
            <h1>{user.full_name}</h1>
            <p className="muted">
              {[ctx?.school_name, classes.length ? `${classes.length} classes` : null]
                .filter(Boolean)
                .join(" · ") || "Teacher dashboard"}
            </p>
          </div>
        </div>

        {/* Real counts. Anything we cannot compute yet is absent rather than
            invented — the attendance and certificate figures that used to sit
            here were literals. */}
        <div className="stat-row">
          <div className="stat">
            <span className="stat-num">{classes.length}</span>
            <span className="stat-label">Classes</span>
          </div>
          <div className="stat">
            <span className="stat-num">{students}</span>
            <span className="stat-label">Students</span>
          </div>
        </div>

        <h2 className="section-title">My classes</h2>
        {classes.length === 0 ? (
          <div className="panel center">
            <h2>No classes yet</h2>
            <p className="muted">
              {user.role === "teacher"
                ? "Your school assigns you to classes. Ask them to add you to one."
                : "You are not assigned to any class. This view shows a teacher's own classes."}
            </p>
          </div>
        ) : (
          <div className="table">
            <div className="tr th">
              <span>Class</span>
              <span>Course</span>
              <span>Students</span>
              <span>Year</span>
              <span></span>
            </div>
            {classes.map((c) => (
              <div className="tr" key={c.id}>
                <span>
                  {c.name} <small className="muted">Class {c.level}</small>
                </span>
                <span>
                  {c.course_slug ? (
                    <em className="pill live">{c.course_slug}</em>
                  ) : (
                    <small className="muted">no course for this level</small>
                  )}
                </span>
                <span>{c.student_count}</span>
                <span>{c.academic_year}</span>
                <span>
                  {c.course_slug && (
                    <Link className="btn btn-small btn-ghost" href={`/learn/${c.course_slug}`}>
                      Open course
                    </Link>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Session coverage still reads the mock progress file: no student has
            watched anything yet, and the real read path lands in P3-06..P3-08.
            Labelled so nobody mistakes it for live data. */}
        <h2 className="section-title">
          Session coverage <small className="muted">· sample data</small>
        </h2>
        <SessionCoverage />
      </main>
    </>
  );
}

function SessionCoverage() {
  const track = getTrack("explorer")!;
  const done = new Set(completed.explorer ?? []);
  return (
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
  );
}
