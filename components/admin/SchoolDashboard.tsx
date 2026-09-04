import Link from "next/link";
import { getSchoolClasses, getSchoolOverview, getSchoolTeachers } from "@/lib/db/org";
import { AddClassForm, AddTeacherForm } from "@/components/admin/ProvisionForms";

// One year for now. When a second is needed this becomes a selector rather
// than a constant — the schema already keys classes on it.
const YEAR = "2026-27";

/**
 * A school's dashboard: its counts, classes and teachers, with the forms that
 * add to them.
 *
 * Shared by /school, where a school sees itself, and /admin/schools/[id],
 * where a super admin looks at any school. One component rather than two
 * copies of the markup, so the super admin's view cannot quietly fall behind
 * the school's — they are looking at the same screen.
 */
export default async function SchoolDashboard({ schoolId }: { schoolId: string }) {
  const [school, classes, teachers] = await Promise.all([
    getSchoolOverview(schoolId),
    getSchoolClasses(schoolId),
    getSchoolTeachers(schoolId),
  ]);
  if (!school) return null;
  // An archived school takes nobody new, so it is not offered. The API refuses
  // it too — this just stops the screen promising something it cannot do.
  const open = school.status !== "archived";

  return (
    <>
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
          {open && <AddClassForm schoolId={school.id} year={YEAR} />}
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
          {open && <AddTeacherForm schoolId={school.id} />}
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
    </>
  );
}
