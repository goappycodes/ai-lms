import Link from "next/link";
import TopNav from "@/components/TopNav";
import NewCourseForm from "@/components/studio/NewCourseForm";
import SeedButton from "@/components/studio/SeedButton";
import ConfigNotice from "@/components/studio/ConfigNotice";
import { dbConfigured } from "@/lib/env";
import { listCoursesWithCounts } from "@/lib/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function StudioHome() {
  if (!dbConfigured()) return <ConfigNotice />;

  let cards;
  try {
    cards = await listCoursesWithCounts();
  } catch (e) {
    return <ConfigNotice detail={e instanceof Error ? e.message : String(e)} />;
  }

  return (
    <>
      <TopNav />
      <main className="container">
        <div className="page-head">
          <div>
            <Link href="/admin" className="crumb">← Admin</Link>
            <h1>Content Studio</h1>
            <p className="muted">Author courses, lessons, videos, worksheets and handouts.</p>
          </div>
          <NewCourseForm />
        </div>

        {cards.length === 0 ? (
          <div className="panel center">
            <h2>No courses yet</h2>
            <p className="muted">Create one, or import the three-course AI Veda curriculum to get started.</p>
            <div style={{ marginTop: 16 }}>
              <SeedButton />
            </div>
          </div>
        ) : (
          <>
            <div className="studio-grid">
              {cards.map((c) => (
                <Link key={c.id} href={`/admin/studio/${c.id}`} className="studio-card">
                  <div className="studio-card-top" style={{ background: c.accent || "var(--ink-nav)" }}>
                    <span>{c.title}</span>
                    <em className={"pill " + (c.status === "published" ? "live" : "draft")}>{c.status}</em>
                  </div>
                  <div className="studio-card-body">
                    <p className="muted">{c.subtitle}</p>
                    <div className="studio-card-meta">
                      <span>{c.audience}</span>
                      <span>
                        {c.lesson_count} lessons · {c.assets_filled}/{c.lesson_count * 6} assets
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
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
