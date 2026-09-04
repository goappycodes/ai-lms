import Link from "next/link";
import TopNav from "@/components/TopNav";
import { requirePage } from "@/lib/auth/guard";
import { getSchoolClasses, getSchoolOverview, getSchoolTeachers } from "@/lib/db/org";
import { AddClassForm, AddTeacherForm } from "@/components/admin/ProvisionForms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One year for now. When a second is needed this becomes a selector rather
// than a constant — the schema already keys classes on it.
const YEAR = "2026-27";

// Every number on this page is a real count from the database. There are no
// invented statistics here — when something is not built yet it says so rather
// than showing a plausible figure.
export default async function SchoolPage() {
  const user = await requirePage("school", "super_admin");

  // A super admin has no school of their own, so there is nothing to show them
  // until school selection exists (P5-04).
  if (!user.school_id) {
    return (
      <>
        <TopNav />
        <main className="container narrow">
          <div className="panel center">
            <h1>No school selected</h1>
            <p className="muted">
              You are signed in as a super admin, who does not belong to a school. Choosing a
              school to view lands with the admin school list.
            </p>
            <Link className="btn btn-primary" href="/admin">
              Go to Admin
            </Link>
          </div>
        </main>
      </>
    );
  }

  const [school, classes, teachers] = await Promise.all([
    getSchoolOverview(user.school_id),
    getSchoolClasses(user.school_id),
    getSchoolTeachers(user.school_id),
  ]);

  if (!school) {
    return (
      <>
        <TopNav />
        <main className="container narrow">
          <div className="panel center">
            <h1>School not found</h1>
            <p className="muted">This account is linked to a school that no longer exists.</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <TopNav />
      <main className="container">
        <div className="page-head">
          <div>
            <h1>{school.name}</h1>
            <p className="muted">
              {[school.district, school.code].filter(Boolean).join(" · ") || "School dashboard"}
            </p>
          </div>
        </div>

        <div className="stat-row">
          <div className="stat">
            <span className="stat-num">{school.class_count}</span>
            <span className="stat-label">Classes</span>
          </div>
          <div className="stat">
            <span className="stat-num">{school.teacher_count}</span>
            <span className="stat-label">Teachers</span>
          </div>
          <div className="stat">
            <span className="stat-num">{school.student_count}</span>
            <span className="stat-label">Students</span>
          </div>
        </div>

        <div className="section-head">
          <h2 className="section-title">Classes</h2>
          <AddClassForm schoolId={school.id} year={YEAR} />
        </div>
        {classes.length === 0 ? (
          <div className="panel center">
            <p className="muted">
              No classes yet. Add one above — the course follows from the class level.
              Importing a whole roster from a spreadsheet arrives later.
            </p>
          </div>
        ) : (
          <div className="table table-classes">
            <div className="tr th">
              <span>Class</span>
              <span>Course</span>
              <span>Students</span>
              <span>Teachers</span>
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
                <span>
                  {c.teacher_names.length ? (
                    c.teacher_names.join(", ")
                  ) : (
                    <small className="muted">unassigned</small>
                  )}
                </span>
                <span>{c.academic_year}</span>
                <span>
                  <Link className="btn btn-small btn-ghost" href={`/teacher/${c.id}`}>
                    Open
                  </Link>
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="section-head">
          <h2 className="section-title">Teachers</h2>
          <AddTeacherForm schoolId={school.id} />
        </div>
        {teachers.length === 0 ? (
          <div className="panel center">
            <p className="muted">
              No teachers yet. Add one above; they get a username and a password to pass on.
            </p>
          </div>
        ) : (
          <div className="table table-teachers">
            <div className="tr th">
              <span>Name</span>
              <span>Username</span>
              <span>Classes</span>
              <span>Last signed in</span>
            </div>
            {teachers.map((t) => (
              <div className="tr" key={t.id}>
                <span>{t.full_name}</span>
                <span>
                  <code>{t.username}</code>
                </span>
                <span>{t.class_count}</span>
                <span>
                  {t.last_login_at ? (
                    new Date(t.last_login_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })
                  ) : (
                    <small className="muted">never</small>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
