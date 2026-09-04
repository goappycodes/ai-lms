import TopNav from "@/components/TopNav";
import TrackCard from "@/components/TrackCard";
import { tracks } from "@/lib/data";
import { enrolledTrack, student } from "@/lib/progress";
import { requirePage } from "@/lib/auth/guard";

export default async function LearningPage() {
  await requirePage();

  return (
    <>
      <TopNav />
      <main className="container">
        <div className="page-head">
          <div>
            <h1>My Learning</h1>
            <p className="muted">
              Welcome back, {student.name} · {student.school} · Class {student.class}
            </p>
          </div>
        </div>

        <div className="track-grid">
          {tracks.map((t) => (
            <TrackCard key={t.id} track={t} enrolled={t.id === enrolledTrack} />
          ))}
        </div>
      </main>
    </>
  );
}
