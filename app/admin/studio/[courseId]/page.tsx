import { notFound } from "next/navigation";
import TopNav from "@/components/TopNav";
import StudioEditor, { type Tree } from "@/components/studio/StudioEditor";
import { getCourseTree } from "@/lib/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CourseStudio({ params }: { params: { courseId: string } }) {
  const tree = await getCourseTree(params.courseId);
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
