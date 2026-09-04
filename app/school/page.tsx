import Link from "next/link";
import TopNav from "@/components/TopNav";
import { requirePage } from "@/lib/auth/guard";
import { getSchoolOverview } from "@/lib/db/org";
import SchoolDashboard from "@/components/admin/SchoolDashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Every number on this page is a real count from the database. There are no
// invented statistics here — when something is not built yet it says so rather
// than showing a plausible figure.
export default async function SchoolPage() {
  const user = await requirePage("school", "super_admin");

  // A super admin belongs to no school, so there is nothing here that is
  // theirs. They pick one from the list and manage it at
  // /admin/schools/[id], which renders this same dashboard.
  if (!user.school_id) {
    return (
      <>
        <TopNav />
        <main className="container narrow">
          <div className="panel center">
            <h1>Pick a school</h1>
            <p className="muted">
              You are signed in as a super admin, who does not belong to a school. Open any
              school from the list to manage it.
            </p>
            <Link className="btn btn-primary" href="/admin/schools">
              Browse schools
            </Link>
          </div>
        </main>
      </>
    );
  }

  const school = await getSchoolOverview(user.school_id);
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
        <SchoolDashboard schoolId={school.id} />
      </main>
    </>
  );
}
