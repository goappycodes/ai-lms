import { ok, serverError } from "@/lib/api";
import { tracks } from "@/lib/data";
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
      if (await getCourseBySlug(track.id)) {
        skipped.push(track.id);
        continue;
      }
      const course = await createCourse({
        title: track.name,
        subtitle: track.tagline,
        audience: track.audience,
        accent: track.accent,
      });
      await updateCourse(course.id, { status: "published" });
      await upsertCertificate(course.id, {
        signature_name: "Principal",
        signature_title: `${track.name} Track`,
      });
      // The curriculum is a flat list of sessions, so each course gets one
      // chapter holding them in order.
      const chapter = await createChapter(course.id, "Sessions");
      for (const s of track.sessions) {
        await createLesson(chapter.id, {
          title: s.title,
          takeaway: s.covers,
          durationMin: s.durationMin,
        });
      }
      created.push(course.slug);
    }
    return ok({ created, skipped });
  } catch (e) {
    return serverError(e);
  }
}
