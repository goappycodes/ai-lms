import TopNav from "@/components/TopNav";
import TrackCard from "@/components/TrackCard";
import { requirePage } from "@/lib/auth/guard";
import { getUserContext } from "@/lib/db/org";
import { tracks } from "@/lib/data";
import type { TrackId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LearningPage() {
  const user = await requirePage();
  const ctx = await getUserContext(user.id);

  // Which course this person is enrolled in is REAL: their class level maps
  // through course_levels. Nobody has to be enrolled by hand, and it cannot
  // drift out of step with the class they are in.
  const enrolledTrack = (ctx?.course_slug ?? null) as TrackId | null;

  const where = [ctx?.school_name, ctx?.class_name && `Class ${ctx.class_name}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <TopNav />
      <main className="container">
        <div className="page-head">
          <div>
            <h1>My Learning</h1>
            <p className="muted">
              Welcome back, {user.full_name}
              {where && ` · ${where}`}
            </p>
          </div>
        </div>

        {user.role !== "student" && (
          <p className="muted tiny" style={{ marginTop: -8 }}>
            You are signed in as {user.role === "super_admin" ? "a super admin" : `a ${user.role}`},
            so no course is assigned to you. Every course is shown for preview.
          </p>
        )}

        {/* Which course is yours is real. How far through it you are is not:
            no student has watched anything yet, because the player does not
            record progress until P4-02. Said plainly rather than letting a
            percentage imply otherwise. */}
        <p className="muted tiny" style={{ marginTop: -4 }}>
          Progress figures below are sample data until lessons start being watched.
        </p>

        <div className="track-grid">
          {tracks.map((t) => (
            <TrackCard key={t.id} track={t} enrolled={t.id === enrolledTrack} />
          ))}
        </div>
      </main>
    </>
  );
}
