import Link from "next/link";
import TopNav from "@/components/TopNav";
import NewCourseForm from "@/components/studio/NewCourseForm";
import SeedButton from "@/components/studio/SeedButton";
import { listChapters, listCourses, listLessons } from "@/lib/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function StudioHome() {
  const courses = listCourses();

  return (
    <>
      <TopNav />
      <main className="container">
        <div className="page-head">
          <div>
            <Link href="/admin" className="crumb">← Admin</Link>
            <h1>Content Studio</h1>
            <p className="muted">Author courses, chapters, videos, PDFs, quizzes and certificates.</p>
          </div>
          <NewCourseForm />
        </div>

        {courses.length === 0 ? (
          <div className="panel center">
            <h2>No courses yet</h2>
            <p className="muted">Create one, or import the three-track AI Veda curriculum to get started.</p>
            <div style={{ marginTop: 16 }}>
              <SeedButton />
            </div>
          </div>
        ) : (
          <>
            <div className="studio-grid">
              {courses.map((c) => {
                const chapters = listChapters(c.id);
                const lessons = chapters.reduce((n, ch) => n + listLessons(ch.id).length, 0);
                return (
                  <Link key={c.id} href={`/admin/studio/${c.id}`} className="studio-card">
                    <div className="studio-card-top" style={{ background: c.accent || "var(--ink-nav)" }}>
                      <span>{c.title}</span>
                      <em className={"pill " + (c.status === "published" ? "live" : "draft")}>{c.status}</em>
                    </div>
                    <div className="studio-card-body">
                      <p className="muted">{c.subtitle}</p>
                      <div className="studio-card-meta">
                        <span>{c.audience}</span>
                        <span>{chapters.length} ch · {lessons} lessons</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div style={{ marginTop: 24 }}>
              <SeedButton />
            </div>
          </>
        )}
      </main>
    </>
  );
}
