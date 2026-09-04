import { notFound } from "next/navigation";
import TopNav from "@/components/TopNav";
import StudioEditor, { type Tree } from "@/components/studio/StudioEditor";
import ConfigNotice from "@/components/studio/ConfigNotice";
import { dbConfigured } from "@/lib/env";
import { getCourseTree } from "@/lib/db/repo";
import { requirePage } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CourseStudio({ params }: { params: { courseId: string } }) {
  await requirePage("super_admin");

  if (!dbConfigured()) return <ConfigNotice />;

  let tree;
  try {
    tree = await getCourseTree(params.courseId);
  } catch (e) {
    return <ConfigNotice detail={e instanceof Error ? e.message : String(e)} />;
  }
  if (!tree) notFound();

  return (
    <>
      <TopNav />
      <main className="container">
        <StudioEditor initial={tree as unknown as Tree} />
      </main>
    </>
  );
}
