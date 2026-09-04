import Link from "next/link";
import TopNav from "@/components/TopNav";
import { tracks } from "@/lib/data";
import { requirePage } from "@/lib/auth/guard";

export default async function AdminPage() {
  await requirePage("super_admin");

  return (
    <>
      <TopNav />
      <main className="container">
        <div className="page-head">
          <div>
            <h1>Admin Console</h1>
            <p className="muted">NEXIS · content, access &amp; usage</p>
          </div>
          <div className="page-head-actions">
            <Link className="btn btn-ghost" href="/admin/schools">
              Schools
            </Link>
            <Link className="btn btn-primary" href="/admin/studio">
              Open Content Studio →
            </Link>
          </div>
        </div>

        <h2 className="section-title">Usage this month</h2>
        <div className="stat-row">
          <div className="stat">
            <span className="stat-num">42</span>
            <span className="stat-label">Schools live</span>
          </div>
          <div className="stat">
            <span className="stat-num">1,284</span>
            <span className="stat-label">Students enrolled</span>
          </div>
          <div className="stat">
            <span className="stat-num">6,910</span>
            <span className="stat-label">Sessions played</span>
          </div>
          <div className="stat">
            <span className="stat-num">37</span>
            <span className="stat-label">Certificates issued</span>
          </div>
        </div>

        <h2 className="section-title">Content library</h2>
        <div className="table">
          <div className="tr th">
            <span>Track</span>
            <span>Sessions</span>
            <span>Languages</span>
            <span>Video source</span>
            <span>Status</span>
          </div>
          {tracks.map((t) => (
            <div className="tr" key={t.id}>
              <span>
                {t.name} <small className="muted">{t.audience}</small>
              </span>
              <span>{t.sessions.length}</span>
              <span>EN · ML</span>
              <span>
                <code>R2 · HLS</code>
              </span>
              <span>
                <em className={"pill " + (t.id === "explorer" ? "live" : "draft")}>
                  {t.id === "explorer" ? "Published" : "Draft"}
                </em>
              </span>
            </div>
          ))}
        </div>

        <h2 className="section-title">Encode &amp; publish pipeline</h2>
        <div className="pipeline">
          <div className="pstep done">
            <span>1</span>Upload master MP4
          </div>
          <div className="pstep done">
            <span>2</span>ffmpeg HLS ladder (1080→240p)
          </div>
          <div className="pstep done">
            <span>3</span>Push to Cloudflare R2
          </div>
          <div className="pstep">
            <span>4</span>Gate via signed URL / Worker
          </div>
        </div>
      </main>
    </>
  );
}
