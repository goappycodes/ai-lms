import { ok, serverError } from "@/lib/api";
import { tracks } from "@/lib/data";
import {
  attachLesson,
  createCourse,
  createLesson,
  getCourseBySlug,
  updateCourse,
  upsertCertificateTemplate,
} from "@/lib/db/repo";
import { getPool } from "@/lib/db/pg";
import { requireContentAdmin } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Import the three-course curriculum. Idempotent by slug.
//
// Builder and Achiever share eight sessions, so a lesson is created once and
// attached to both courses. Sessions are matched on title + covers: identical
// content is the same lesson, which is exactly what the shared-lesson model in
// docs/SCHEMA.md means. Creating them twice would double the video production.
export async function POST() {
  const g = await requireContentAdmin();
  if ("response" in g) return g.response;

  try {
    const created: string[] = [];
    const skipped: string[] = [];
    const shared = new Map<string, string>(); // title|covers → lesson id
    let reused = 0;

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
      await upsertCertificateTemplate(course.id, {
        signature_name: "Principal",
        signature_title: `${track.name} Course`,
      });

      for (const s of track.sessions) {
        const key = `${s.title}|${s.covers}`;
        const existing = shared.get(key);
        if (existing) {
          await attachLesson(course.id, existing, { isAdvanced: s.advanced ?? false });
          reused++;
        } else {
          const lesson = await createLesson(course.id, {
            title: s.title,
            covers: s.covers,
            durationMin: s.durationMin,
            isAdvanced: s.advanced ?? false,
          });
          shared.set(key, lesson.id);
        }
      }

      // Class level decides the course, so the mapping is data, not code.
      const levels =
        track.id === "explorer" ? [5, 6, 7] : track.id === "builder" ? [8, 9, 10] : [11, 12];
      for (const level of levels) {
        await getPool().query(
          `INSERT INTO course_levels (level, course_id) VALUES ($1,$2)
           ON CONFLICT (level) DO UPDATE SET course_id = EXCLUDED.course_id`,
          [level, course.id]
        );
      }
      created.push(course.slug);
    }

    return ok({ created, skipped, lessonsCreated: shared.size, lessonsReused: reused });
  } catch (e) {
    return serverError(e);
  }
}
