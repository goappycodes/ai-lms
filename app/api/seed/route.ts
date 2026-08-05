import { ok, serverError } from "@/lib/api";
import { tracks, getPhases } from "@/lib/data";
import {
  createChapter,
  createCourse,
  createLesson,
  getCourseBySlug,
  updateCourse,
  upsertCertificate,
} from "@/lib/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Import the three-track curriculum into the DB. Idempotent by slug.
export async function POST() {
  try {
    const created: string[] = [];
    const skipped: string[] = [];
    for (const track of tracks) {
      if (getCourseBySlug(track.id)) {
        skipped.push(track.id);
        continue;
      }
      const course = createCourse({
        title: track.name,
        subtitle: track.tagline,
        audience: track.audience,
        accent: track.accent,
      });
      updateCourse(course.id, { status: "published" });
      upsertCertificate(course.id, {
        signature_name: "Principal",
        signature_title: `${track.name} Track`,
      });
      for (const phase of getPhases(track)) {
        const chapter = createChapter(course.id, phase.name);
        for (const s of phase.sessions) {
          createLesson(chapter.id, {
            title: s.title,
            takeaway: s.takeaway,
            tools: s.tools,
            durationMin: s.durationMin,
          });
        }
      }
      created.push(course.slug);
    }
    return ok({ created, skipped });
  } catch (e) {
    return serverError(e);
  }
}
