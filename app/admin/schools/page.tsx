import Link from "next/link";
import TopNav from "@/components/TopNav";
import { requirePage } from "@/lib/auth/guard";
import { listSchools } from "@/lib/db/admin";
import { AddSchoolForm } from "@/components/admin/ProvisionForms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SchoolsPage() {
  await requirePage("super_admin");
  const schools = await listSchools();
  const real = schools.filter((s) => !s.is_demo);
  const live = real.filter((s) => s.status === "active").length;
  const archived = real.length - live;

  return (
    <>
      <TopNav />
      <main className="container">
        <div className="page-head">
          <div>
            <Link href="/admin" className="crumb">
              ← Admin
            </Link>
            <h1>Schools</h1>
            <p className="muted">
              {live} {live === 1 ? "school" : "schools"}
              {archived > 0 && ` · ${archived} archived`}
              {schools.length > real.length && " · plus the demo school"}
            </p>
          </div>
          <AddSchoolForm />
        </div>

        {schools.length === 0 ? (
          <div className="panel center">
            <h2>No schools yet</h2>
            <p className="muted">Adding a school also creates the login it signs in with.</p>
          </div>
        ) : (
          <div className="table table-schools">
            <div className="tr th">
              <span>School</span>
              <span>Signs in as</span>
              <span>Classes</span>
              <span>Teachers</span>
              <span>Students</span>
              <span></span>
            </div>
            {schools.map((s) => (
              <div className={"tr" + (s.status === "archived" ? " tr-muted" : "")} key={s.id}>
                <span>
                  {s.name}{" "}
                  {s.is_demo && <em className="pill draft">demo</em>}
                  {s.status === "archived" && <em className="pill draft">archived</em>}
                  {s.district && <small className="muted"> {s.district}</small>}
                </span>
                <span>
                  <code>{s.username}</code>
                </span>
                <span>{s.class_count}</span>
                <span>{s.teacher_count}</span>
                <span>{s.student_count}</span>
                <span>
                  <Link className="btn btn-small btn-ghost" href={`/admin/schools/${s.id}`}>
                    Manage
                  </Link>
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
