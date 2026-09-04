import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import TopNav from "@/components/TopNav";
import { requirePage } from "@/lib/auth/guard";
import { canManageClass } from "@/lib/auth/scope";
import { listClassStudents } from "@/lib/db/admin";
import { getPool } from "@/lib/db/pg";
import { AddStudentForm } from "@/components/admin/ProvisionForms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ClassDetail {
  id: string;
  name: string;
  level: number;
  academic_year: string;
  school_name: string;
  course_slug: string | null;
}

export default async function ClassPage({ params }: { params: { classId: string } }) {
  const user = await requirePage("teacher", "school", "super_admin");

  // Role is not enough: a teacher reaches only the classes they are assigned
  // to, and a school only its own. The check is the same one the API uses.
  const allow = await canManageClass(user, params.classId);
  if (!allow.ok) {
    if (allow.status === 404) notFound();
    redirect("/teacher");
  }

  const { rows } = await getPool().query<ClassDetail>(
    `SELECT c.id, c.name, c.level, c.academic_year,
            s.name AS school_name, co.slug AS course_slug
       FROM classes c
       JOIN schools s ON s.id = c.school_id
       LEFT JOIN course_levels l ON l.level = c.level
       LEFT JOIN courses co ON co.id = l.course_id
      WHERE c.id = $1`,
    [params.classId]
  );
  if (!rows.length) notFound();
  const cls = rows[0];
  const students = await listClassStudents(params.classId);

  return (
    <>
      <TopNav />
      <main className="container">
        <div className="page-head">
          <div>
            <Link href="/teacher" className="crumb">
              ← My classes
            </Link>
            <h1>
              {cls.name} <small className="muted">Class {cls.level}</small>
            </h1>
            <p className="muted">
              {cls.school_name} · {cls.academic_year}
              {cls.course_slug && <> · {cls.course_slug}</>}
            </p>
          </div>
          <AddStudentForm classId={cls.id} />
        </div>

        {students.length === 0 ? (
          <div className="panel center">
            <h2>No students yet</h2>
            <p className="muted">
              Add them one at a time here. Importing a whole roster from a spreadsheet arrives
              later.
            </p>
          </div>
        ) : (
          <>
            <div className="stat-row">
              <div className="stat">
                <span className="stat-num">{students.length}</span>
                <span className="stat-label">Students</span>
              </div>
              <div className="stat">
                <span className="stat-num">
                  {students.filter((s) => s.last_login_at).length}
                </span>
                <span className="stat-label">Have signed in</span>
              </div>
            </div>

            <div className="table">
              <div className="tr th">
                <span>Name</span>
                <span>Username</span>
                <span>Status</span>
                <span>Last signed in</span>
                <span></span>
              </div>
              {students.map((s) => (
                <div className="tr" key={s.id}>
                  <span>{s.full_name}</span>
                  <span>
                    <code>{s.username}</code>
                  </span>
                  <span>
                    <em className={"pill " + (s.status === "active" ? "live" : "draft")}>
                      {s.status}
                    </em>
                  </span>
                  <span>
                    {s.last_login_at ? (
                      new Date(s.last_login_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })
                    ) : (
                      <small className="muted">never</small>
                    )}
                  </span>
                  <span></span>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
