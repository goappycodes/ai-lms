import Link from "next/link";
import { notFound } from "next/navigation";
import TopNav from "@/components/TopNav";
import { requirePage } from "@/lib/auth/guard";
import { getSchoolOverview } from "@/lib/db/org";
import SchoolDashboard from "@/components/admin/SchoolDashboard";
import SchoolControls from "@/components/admin/SchoolControls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One school, as the super admin sees it.
 *
 * The body is the same dashboard the school gets at /school — same counts,
 * same classes, same add forms — so managing a school does not mean using a
 * poorer copy of the screen the school itself uses. The difference is the
 * controls above it, which only a super admin has.
 */
export default async function AdminSchoolPage({ params }: { params: { id: string } }) {
  // Only a super admin: a school reaching another school's id here would be
  // reaching sideways, and /school is where a school manages itself.
  await requirePage("super_admin");

  const school = await getSchoolOverview(params.id);
  if (!school) notFound();

  return (
    <>
      <TopNav />
      <main className="container">
        <div className="page-head">
          <div>
            <Link href="/admin/schools" className="crumb">
              ← All schools
            </Link>
            <h1>
              {school.name}{" "}
              {school.status === "archived" && <em className="pill draft">archived</em>}
            </h1>
            <p className="muted">
              {[school.district, school.code].filter(Boolean).join(" · ") || "No district set"}
            </p>
          </div>
          <SchoolControls school={school} />
        </div>

        {school.status === "archived" && (
          <div className="panel notice">
            <p>
              This school is archived. Nobody at it can sign in, and it is hidden from the
              active list. Nothing has been deleted — restoring it gives everyone their access
              back.
            </p>
          </div>
        )}

        <SchoolDashboard schoolId={school.id} />
      </main>
    </>
  );
}
