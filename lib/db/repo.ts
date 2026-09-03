import { getPool } from "./pg";
import { id, slugify } from "@/lib/ids";
import { assetUrl } from "@/lib/storage";

// Typed helpers over the pg pool. All repo functions are async.
//
// Two conventions the new schema introduces, both load-bearing:
//
//   Locale. Titles live in *_translations, never on the row. Every read takes a
//   locale and falls back to English when a Malayalam row is missing, so a
//   half-translated course renders instead of throwing.
//
//   Keys, not URLs. Assets store a storage_key; the delivery URL is built on
//   read from R2_PUBLIC_URL. The domain is configuration, not data.
async function all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await getPool().query(sql, params);
  return rows as T[];
}
async function one<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const { rows } = await getPool().query(sql, params);
  return rows[0] as T | undefined;
}
async function run(sql: string, params: unknown[] = []): Promise<number> {
  const { rowCount } = await getPool().query(sql, params);
  return rowCount ?? 0;
}

export type Locale = "en" | "ml";
export const LOCALES: Locale[] = ["en", "ml"];
export const DEFAULT_LOCALE: Locale = "en";

// ---------------------------------------------------------------- types ----
export interface Course {
  id: string;
  slug: string;
  accent: string | null;
  status: "draft" | "published";
  position: number;
  created_at: string;
  updated_at: string;
}
/** A course with its title resolved for one locale. */
export interface CourseView extends Course {
  title: string;
  subtitle: string | null;
  audience: string | null;
  /** True when the requested locale had no row and English was used. */
  translation_fallback: boolean;
}
export interface Lesson {
  id: string;
  duration_min: number;
  tools: string | null;
  created_at: string;
  updated_at: string;
}
export interface LessonView extends Lesson {
  title: string;
  covers: string | null;
  translation_fallback: boolean;
  /** Position within the course it was read through. */
  position: number;
  is_advanced: boolean;
}
export interface Video {
  id: string;
  lesson_id: string;
  locale: Locale;
  original_name: string | null;
  status: "pending" | "encoding" | "uploading" | "ready" | "error";
  progress: number;
  stage: string | null;
  storage: "r2" | "local" | null;
  storage_key: string | null;
  has_poster: boolean;
  renditions: string[] | null;
  duration_sec: number | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}
/** A video with playable URLs built from its key. */
export interface VideoView extends Video {
  master_url: string | null;
  poster_url: string | null;
}
export interface DocumentRow {
  id: string;
  lesson_id: string;
  kind: "worksheet" | "handout";
  locale: Locale;
  title: string;
  filename: string;
  storage_key: string;
  storage: "r2" | "local";
  size_bytes: number | null;
  created_at: string;
}
export interface DocumentView extends DocumentRow {
  url: string;
}
export interface CertificateTemplate {
  id: string;
  course_id: string;
  issuer: string;
  partner: string;
  signature_name: string | null;
  signature_title: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

function toVideoView(v: Video): VideoView {
  return {
    ...v,
    master_url: v.storage_key ? assetUrl(v.storage, `${v.storage_key}/master.m3u8`) : null,
    poster_url:
      v.storage_key && v.has_poster ? assetUrl(v.storage, `${v.storage_key}/poster.jpg`) : null,
  };
}
function toDocumentView(d: DocumentRow): DocumentView {
  return { ...d, url: assetUrl(d.storage, d.storage_key)! };
}

// -------------------------------------------------------------- courses ----
export async function createCourse(input: {
  title: string;
  subtitle?: string;
  audience?: string;
  accent?: string;
  locale?: Locale;
}): Promise<CourseView> {
  const cid = id("crs");
  const base = slugify(input.title);
  let slug = base;
  let i = 2;
  while (await one("SELECT 1 FROM courses WHERE slug = $1", [slug])) slug = `${base}-${i++}`;
  const pos = await one<{ n: number }>(
    "SELECT COALESCE(MAX(position), -1) + 1 AS n FROM courses"
  );
  await run(
    `INSERT INTO courses (id, slug, accent, status, position) VALUES ($1,$2,$3,'draft',$4)`,
    [cid, slug, input.accent ?? null, Number(pos!.n)]
  );
  await upsertCourseTranslation(cid, input.locale ?? DEFAULT_LOCALE, {
    title: input.title,
    subtitle: input.subtitle ?? null,
    audience: input.audience ?? null,
  });
  return (await getCourse(cid))!;
}

// COALESCE across the requested locale and English is the fallback rule, in one
// query rather than a second round trip when a translation is missing.
const COURSE_SELECT = `
  SELECT c.*,
         COALESCE(t.title, en.title)       AS title,
         COALESCE(t.subtitle, en.subtitle) AS subtitle,
         COALESCE(t.audience, en.audience) AS audience,
         (t.title IS NULL)                 AS translation_fallback
    FROM courses c
    LEFT JOIN course_translations t  ON t.course_id  = c.id AND t.locale  = $1
    LEFT JOIN course_translations en ON en.course_id = c.id AND en.locale = 'en'`;

export function listCourses(locale: Locale = DEFAULT_LOCALE): Promise<CourseView[]> {
  return all<CourseView>(`${COURSE_SELECT} ORDER BY c.position, c.created_at`, [locale]);
}
export function listPublishedCourses(locale: Locale = DEFAULT_LOCALE): Promise<CourseView[]> {
  return all<CourseView>(
    `${COURSE_SELECT} WHERE c.status = 'published' ORDER BY c.position, c.created_at`,
    [locale]
  );
}
export function getCourse(cid: string, locale: Locale = DEFAULT_LOCALE) {
  return one<CourseView>(`${COURSE_SELECT} WHERE c.id = $2`, [locale, cid]);
}
export function getCourseBySlug(slug: string, locale: Locale = DEFAULT_LOCALE) {
  return one<CourseView>(`${COURSE_SELECT} WHERE c.slug = $2`, [locale, slug]);
}

export async function updateCourse(
  cid: string,
  patch: Partial<Pick<Course, "accent" | "status" | "position">> & {
    title?: string;
    subtitle?: string | null;
    audience?: string | null;
    locale?: Locale;
  }
): Promise<CourseView | undefined> {
  const cur = await one<Course>("SELECT * FROM courses WHERE id = $1", [cid]);
  if (!cur) return undefined;

  const m = { ...cur, ...patch };
  await run(
    `UPDATE courses SET accent=$1, status=$2, position=$3, updated_at=now() WHERE id=$4`,
    [m.accent, m.status, m.position, cid]
  );

  if (patch.title !== undefined || patch.subtitle !== undefined || patch.audience !== undefined) {
    const locale = patch.locale ?? DEFAULT_LOCALE;
    const existing = await getCourseTranslation(cid, locale);
    await upsertCourseTranslation(cid, locale, {
      title: patch.title ?? existing?.title ?? "",
      subtitle: patch.subtitle !== undefined ? patch.subtitle : existing?.subtitle ?? null,
      audience: patch.audience !== undefined ? patch.audience : existing?.audience ?? null,
    });
  }
  return getCourse(cid, patch.locale ?? DEFAULT_LOCALE);
}

export async function deleteCourse(cid: string): Promise<boolean> {
  // course_lessons cascades, but the lessons themselves survive: they may be
  // shared with another course, and RESTRICT would block the delete anyway.
  return (await run("DELETE FROM courses WHERE id = $1", [cid])) > 0;
}

// --------------------------------------------------------- translations ----
export interface CourseTranslation {
  course_id: string;
  locale: Locale;
  title: string;
  subtitle: string | null;
  audience: string | null;
}
export function getCourseTranslation(cid: string, locale: Locale) {
  return one<CourseTranslation>(
    "SELECT * FROM course_translations WHERE course_id = $1 AND locale = $2",
    [cid, locale]
  );
}
export function listCourseTranslations(cid: string) {
  return all<CourseTranslation>(
    "SELECT * FROM course_translations WHERE course_id = $1 ORDER BY locale",
    [cid]
  );
}
export async function upsertCourseTranslation(
  cid: string,
  locale: Locale,
  input: { title: string; subtitle?: string | null; audience?: string | null }
): Promise<void> {
  await run(
    `INSERT INTO course_translations (course_id, locale, title, subtitle, audience)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (course_id, locale)
     DO UPDATE SET title = EXCLUDED.title, subtitle = EXCLUDED.subtitle, audience = EXCLUDED.audience`,
    [cid, locale, input.title, input.subtitle ?? null, input.audience ?? null]
  );
}

export interface LessonTranslation {
  lesson_id: string;
  locale: Locale;
  title: string;
  covers: string | null;
}
export function listLessonTranslations(lid: string) {
  return all<LessonTranslation>(
    "SELECT * FROM lesson_translations WHERE lesson_id = $1 ORDER BY locale",
    [lid]
  );
}
export function getLessonTranslation(lid: string, locale: Locale) {
  return one<LessonTranslation>(
    "SELECT * FROM lesson_translations WHERE lesson_id = $1 AND locale = $2",
    [lid, locale]
  );
}
export async function upsertLessonTranslation(
  lid: string,
  locale: Locale,
  input: { title: string; covers?: string | null }
): Promise<void> {
  await run(
    `INSERT INTO lesson_translations (lesson_id, locale, title, covers)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (lesson_id, locale)
     DO UPDATE SET title = EXCLUDED.title, covers = EXCLUDED.covers`,
    [lid, locale, input.title, input.covers ?? null]
  );
}

// -------------------------------------------------------------- lessons ----
const LESSON_SELECT = `
  SELECT l.*,
         cl.position, cl.is_advanced,
         COALESCE(t.title, en.title)   AS title,
         COALESCE(t.covers, en.covers) AS covers,
         (t.title IS NULL)             AS translation_fallback
    FROM lessons l
    JOIN course_lessons cl ON cl.lesson_id = l.id
    LEFT JOIN lesson_translations t  ON t.lesson_id  = l.id AND t.locale  = $1
    LEFT JOIN lesson_translations en ON en.lesson_id = l.id AND en.locale = 'en'`;

/**
 * Creates a lesson and attaches it to a course. A lesson is not owned by a
 * course — this is the only place the two are joined at creation time, and
 * `attachLesson` exists to add the same lesson to a second course.
 */
export async function createLesson(
  courseId: string,
  input: {
    title: string;
    covers?: string;
    tools?: string;
    durationMin?: number;
    locale?: Locale;
    isAdvanced?: boolean;
  }
): Promise<LessonView> {
  const lid = id("lsn");
  await run(`INSERT INTO lessons (id, duration_min, tools) VALUES ($1,$2,$3)`, [
    lid,
    input.durationMin ?? 30,
    input.tools ?? null,
  ]);
  await upsertLessonTranslation(lid, input.locale ?? DEFAULT_LOCALE, {
    title: input.title,
    covers: input.covers ?? null,
  });
  await attachLesson(courseId, lid, { isAdvanced: input.isAdvanced });
  return (await getLesson(lid, courseId))!;
}

/** Adds an existing lesson to a course at the next free position. */
export async function attachLesson(
  courseId: string,
  lessonId: string,
  opts: { position?: number; isAdvanced?: boolean } = {}
): Promise<void> {
  const next = await one<{ n: number }>(
    "SELECT COALESCE(MAX(position), 0) + 1 AS n FROM course_lessons WHERE course_id = $1",
    [courseId]
  );
  await run(
    `INSERT INTO course_lessons (course_id, lesson_id, position, is_advanced)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (course_id, lesson_id) DO NOTHING`,
    [courseId, lessonId, opts.position ?? Number(next!.n), opts.isAdvanced ?? false]
  );
}

export function detachLesson(courseId: string, lessonId: string): Promise<number> {
  return run("DELETE FROM course_lessons WHERE course_id = $1 AND lesson_id = $2", [
    courseId,
    lessonId,
  ]);
}

export function getLesson(lid: string, courseId?: string, locale: Locale = DEFAULT_LOCALE) {
  return courseId
    ? one<LessonView>(`${LESSON_SELECT} WHERE l.id = $2 AND cl.course_id = $3`, [
        locale,
        lid,
        courseId,
      ])
    : one<LessonView>(`${LESSON_SELECT} WHERE l.id = $2 ORDER BY cl.course_id LIMIT 1`, [
        locale,
        lid,
      ]);
}

export function listLessons(courseId: string, locale: Locale = DEFAULT_LOCALE) {
  return all<LessonView>(`${LESSON_SELECT} WHERE cl.course_id = $2 ORDER BY cl.position`, [
    locale,
    courseId,
  ]);
}

/** Which courses use this lesson — the "what would editing this affect?" query. */
export function coursesUsingLesson(lid: string) {
  return all<{ course_id: string; slug: string; position: number }>(
    `SELECT cl.course_id, c.slug, cl.position
       FROM course_lessons cl JOIN courses c ON c.id = cl.course_id
      WHERE cl.lesson_id = $1 ORDER BY c.position`,
    [lid]
  );
}

export async function updateLesson(
  lid: string,
  patch: {
    title?: string;
    covers?: string | null;
    tools?: string | null;
    duration_min?: number;
    locale?: Locale;
  }
): Promise<LessonView | undefined> {
  const cur = await one<Lesson>("SELECT * FROM lessons WHERE id = $1", [lid]);
  if (!cur) return undefined;

  const m = { ...cur, ...patch };
  await run("UPDATE lessons SET duration_min=$1, tools=$2, updated_at=now() WHERE id=$3", [
    m.duration_min,
    m.tools,
    lid,
  ]);

  if (patch.title !== undefined || patch.covers !== undefined) {
    const locale = patch.locale ?? DEFAULT_LOCALE;
    const existing = await getLessonTranslation(lid, locale);
    await upsertLessonTranslation(lid, locale, {
      title: patch.title ?? existing?.title ?? "",
      covers: patch.covers !== undefined ? patch.covers : existing?.covers ?? null,
    });
  }
  return getLesson(lid, undefined, patch.locale ?? DEFAULT_LOCALE);
}

/**
 * Deletes a lesson outright. Fails if any course still uses it — the schema
 * enforces this, because a shared lesson is usually being deleted by someone
 * looking at only one of the courses that need it.
 */
export async function deleteLesson(lid: string): Promise<boolean> {
  return (await run("DELETE FROM lessons WHERE id = $1", [lid])) > 0;
}

export async function reorderLessons(courseId: string, lessonIds: string[]): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // Park positions out of range first: the unique index on (course_id,
    // position) would otherwise collide half-way through the reshuffle.
    await client.query(
      "UPDATE course_lessons SET position = position + 1000 WHERE course_id = $1",
      [courseId]
    );
    for (let i = 0; i < lessonIds.length; i++) {
      await client.query(
        "UPDATE course_lessons SET position = $1 WHERE course_id = $2 AND lesson_id = $3",
        [i + 1, courseId, lessonIds[i]]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// --------------------------------------------------------------- videos ----
export async function createVideo(
  lessonId: string,
  locale: Locale,
  originalName: string
): Promise<Video> {
  const vid = id("vid");
  await run(
    `INSERT INTO videos (id, lesson_id, locale, original_name, status, progress, stage)
     VALUES ($1,$2,$3,$4,'pending',0,'Queued')`,
    [vid, lessonId, locale, originalName]
  );
  return (await getVideo(vid))!;
}
export function getVideo(vid: string) {
  return one<Video>("SELECT * FROM videos WHERE id = $1", [vid]);
}

/**
 * The newest READY video for a lesson and language.
 *
 * Deliberately not "the newest video": a failed re-encode creates a newer row,
 * and taking that one replaces a working video with a broken one for every
 * student. The failure stays visible in the Studio and invisible to learners.
 */
export async function getCurrentVideo(
  lessonId: string,
  locale: Locale
): Promise<VideoView | undefined> {
  const v = await one<Video>(
    `SELECT * FROM videos WHERE lesson_id = $1 AND locale = $2 AND status = 'ready'
      ORDER BY created_at DESC LIMIT 1`,
    [lessonId, locale]
  );
  return v ? toVideoView(v) : undefined;
}

/** Newest row of any status — what the Studio shows, including failures. */
export async function getLatestVideo(
  lessonId: string,
  locale: Locale
): Promise<VideoView | undefined> {
  const v = await one<Video>(
    `SELECT * FROM videos WHERE lesson_id = $1 AND locale = $2 ORDER BY created_at DESC LIMIT 1`,
    [lessonId, locale]
  );
  return v ? toVideoView(v) : undefined;
}

export async function updateVideo(
  vid: string,
  patch: Partial<
    Pick<
      Video,
      | "status"
      | "progress"
      | "stage"
      | "storage"
      | "storage_key"
      | "has_poster"
      | "renditions"
      | "duration_sec"
      | "error"
    >
  >
): Promise<Video | undefined> {
  const cur = await getVideo(vid);
  if (!cur) return undefined;
  const m = { ...cur, ...patch };
  await run(
    `UPDATE videos SET status=$1, progress=$2, stage=$3, storage=$4, storage_key=$5,
            has_poster=$6, renditions=$7, duration_sec=$8, error=$9, updated_at=now()
      WHERE id=$10`,
    [
      m.status,
      m.progress,
      m.stage,
      m.storage,
      m.storage_key,
      m.has_poster,
      m.renditions,
      m.duration_sec,
      m.error,
      vid,
    ]
  );
  return getVideo(vid);
}

// ------------------------------------------------------------ documents ----
export async function createDocument(
  lessonId: string,
  input: {
    kind: "worksheet" | "handout";
    locale: Locale;
    title: string;
    filename: string;
    storageKey: string;
    storage: "r2" | "local";
    sizeBytes?: number;
  }
): Promise<DocumentView> {
  const did = id("doc");
  // One worksheet and one handout per language per lesson: re-upload replaces
  // rather than accumulating a pile nobody can tell apart.
  await run(
    `INSERT INTO documents (id, lesson_id, kind, locale, title, filename, storage_key, storage, size_bytes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (lesson_id, kind, locale) DO UPDATE SET
       title = EXCLUDED.title, filename = EXCLUDED.filename,
       storage_key = EXCLUDED.storage_key, storage = EXCLUDED.storage,
       size_bytes = EXCLUDED.size_bytes`,
    [
      did,
      lessonId,
      input.kind,
      input.locale,
      input.title,
      input.filename,
      input.storageKey,
      input.storage,
      input.sizeBytes ?? null,
    ]
  );
  return (await getDocument(lessonId, input.kind, input.locale))!;
}

export async function getDocument(lessonId: string, kind: string, locale: Locale) {
  const d = await one<DocumentRow>(
    "SELECT * FROM documents WHERE lesson_id = $1 AND kind = $2 AND locale = $3",
    [lessonId, kind, locale]
  );
  return d ? toDocumentView(d) : undefined;
}
export async function listDocuments(lessonId: string, locale?: Locale): Promise<DocumentView[]> {
  const rows = locale
    ? await all<DocumentRow>(
        "SELECT * FROM documents WHERE lesson_id = $1 AND locale = $2 ORDER BY kind",
        [lessonId, locale]
      )
    : await all<DocumentRow>("SELECT * FROM documents WHERE lesson_id = $1 ORDER BY locale, kind", [
        lessonId,
      ]);
  return rows.map(toDocumentView);
}
export async function deleteDocument(did: string): Promise<boolean> {
  return (await run("DELETE FROM documents WHERE id = $1", [did])) > 0;
}

// --------------------------------------------------------- certificates ----
export async function upsertCertificateTemplate(
  courseId: string,
  input: Partial<
    Pick<
      CertificateTemplate,
      "issuer" | "partner" | "signature_name" | "signature_title" | "enabled"
    >
  >
): Promise<CertificateTemplate> {
  const cur = await getCertificateTemplate(courseId);
  if (!cur) {
    await run(
      `INSERT INTO certificate_templates (id, course_id, issuer, partner, signature_name, signature_title, enabled)
       VALUES ($1,$2,COALESCE($3,'NEXIS School of Business'),COALESCE($4,'Government of Kerala'),$5,$6,COALESCE($7,true))`,
      [
        id("cert"),
        courseId,
        input.issuer ?? null,
        input.partner ?? null,
        input.signature_name ?? null,
        input.signature_title ?? null,
        input.enabled ?? null,
      ]
    );
  } else {
    const m = { ...cur, ...input };
    await run(
      `UPDATE certificate_templates SET issuer=$1, partner=$2, signature_name=$3,
              signature_title=$4, enabled=$5, updated_at=now() WHERE course_id=$6`,
      [m.issuer, m.partner, m.signature_name, m.signature_title, m.enabled, courseId]
    );
  }
  return (await getCertificateTemplate(courseId))!;
}
export function getCertificateTemplate(courseId: string) {
  return one<CertificateTemplate>("SELECT * FROM certificate_templates WHERE course_id = $1", [
    courseId,
  ]);
}

// ---------------------------------------------------------------- trees ----
export interface LessonNode extends LessonView {
  /** Keyed by locale: every language's video, so the Studio can show slots. */
  videos: Partial<Record<Locale, VideoView>>;
  documents: DocumentView[];
  /** Filled asset slots out of the six a lesson needs. */
  assets_filled: number;
}
export interface CourseTree extends CourseView {
  lessons: LessonNode[];
  certificate: CertificateTemplate | null;
  /** Filled slots across the whole course, for the Studio's progress read-out. */
  assets_filled: number;
  assets_expected: number;
}

const SLOTS_PER_LESSON = LOCALES.length * 3; // video + worksheet + handout, per locale

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

/**
 * The whole course in a fixed number of queries regardless of lesson count.
 * Four round trips to a remote database, not one per lesson.
 */
export async function getCourseTree(
  courseId: string,
  locale: Locale = DEFAULT_LOCALE
): Promise<CourseTree | undefined> {
  const course = await getCourse(courseId, locale);
  if (!course) return undefined;

  const [lessons, cert] = await Promise.all([
    listLessons(courseId, locale),
    getCertificateTemplate(courseId),
  ]);

  const lessonIds = lessons.map((l) => l.id);
  let videos: Video[] = [];
  let docs: DocumentRow[] = [];
  if (lessonIds.length) {
    [videos, docs] = await Promise.all([
      // DISTINCT ON gives the newest row per (lesson, locale) in one pass.
      all<Video>(
        `SELECT DISTINCT ON (lesson_id, locale) * FROM videos
          WHERE lesson_id = ANY($1::text[])
          ORDER BY lesson_id, locale, created_at DESC`,
        [lessonIds]
      ),
      all<DocumentRow>(
        "SELECT * FROM documents WHERE lesson_id = ANY($1::text[]) ORDER BY locale, kind",
        [lessonIds]
      ),
    ]);
  }

  const videosByLesson = groupBy(videos, (v) => v.lesson_id);
  const docsByLesson = groupBy(docs, (d) => d.lesson_id);

  let filled = 0;
  const nodes: LessonNode[] = lessons.map((ls) => {
    const vs: Partial<Record<Locale, VideoView>> = {};
    for (const v of videosByLesson.get(ls.id) ?? []) vs[v.locale] = toVideoView(v);
    const ds = (docsByLesson.get(ls.id) ?? []).map(toDocumentView);
    // A video counts as a filled slot only once it is playable.
    const n = Object.values(vs).filter((v) => v.status === "ready").length + ds.length;
    filled += n;
    return { ...ls, videos: vs, documents: ds, assets_filled: n };
  });

  return {
    ...course,
    lessons: nodes,
    certificate: cert ?? null,
    assets_filled: filled,
    assets_expected: nodes.length * SLOTS_PER_LESSON,
  };
}

/** One query with subquery counts — for the Studio course grid. */
export interface CourseWithCounts extends CourseView {
  lesson_count: number;
  assets_filled: number;
}
export function listCoursesWithCounts(
  locale: Locale = DEFAULT_LOCALE
): Promise<CourseWithCounts[]> {
  return all<CourseWithCounts>(
    `SELECT c.*,
            COALESCE(t.title, en.title)       AS title,
            COALESCE(t.subtitle, en.subtitle) AS subtitle,
            COALESCE(t.audience, en.audience) AS audience,
            (t.title IS NULL)                 AS translation_fallback,
            (SELECT count(*)::int FROM course_lessons cl WHERE cl.course_id = c.id) AS lesson_count,
            (SELECT count(*)::int FROM lesson_assets a
               JOIN course_lessons cl2 ON cl2.lesson_id = a.lesson_id
              WHERE cl2.course_id = c.id AND a.is_ready)                            AS assets_filled
       FROM courses c
       LEFT JOIN course_translations t  ON t.course_id  = c.id AND t.locale  = $1
       LEFT JOIN course_translations en ON en.course_id = c.id AND en.locale = 'en'
      ORDER BY c.position, c.created_at`,
    [locale]
  );
}

export const SLOTS_PER_LESSON_COUNT = SLOTS_PER_LESSON;
