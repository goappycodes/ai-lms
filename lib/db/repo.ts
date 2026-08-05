import { getPool } from "./pg";
import { id, nowIso, slugify } from "@/lib/ids";

// Thin typed helpers over the pg pool. All repo functions are async.
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

// ---------------------------------------------------------------- types ----
export interface Course {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  audience: string | null;
  description: string | null;
  accent: string | null;
  status: "draft" | "published";
  position: number;
  created_at: string;
  updated_at: string;
}
export interface Chapter {
  id: string;
  course_id: string;
  title: string;
  position: number;
  created_at: string;
  updated_at: string;
}
export interface Lesson {
  id: string;
  chapter_id: string;
  course_id: string;
  title: string;
  takeaway: string | null;
  tools: string | null;
  duration_min: number;
  position: number;
  created_at: string;
  updated_at: string;
}
export interface Video {
  id: string;
  lesson_id: string;
  original_name: string | null;
  status: "pending" | "encoding" | "uploading" | "ready" | "error";
  progress: number;
  stage: string | null;
  storage: string | null;
  master_url: string | null;
  poster_url: string | null;
  renditions: string | null;
  duration_sec: number | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}
export interface Pdf {
  id: string;
  lesson_id: string;
  title: string;
  filename: string;
  url: string;
  storage: string;
  size_bytes: number | null;
  position: number;
  created_at: string;
}
export interface Quiz {
  id: string;
  lesson_id: string;
  title: string;
  pass_pct: number;
  created_at: string;
  updated_at: string;
}
export interface QuizQuestion {
  id: string;
  quiz_id: string;
  prompt: string;
  options: string;
  correct_index: number;
  position: number;
}
export interface Certificate {
  id: string;
  course_id: string;
  title: string;
  issuer: string;
  partner: string;
  signature_name: string | null;
  signature_title: string | null;
  enabled: number;
  created_at: string;
  updated_at: string;
}

// -------------------------------------------------------------- helpers ----
async function nextPos(table: string, whereCol: string | null, val?: string): Promise<number> {
  if (whereCol) {
    const r = await one<{ n: number }>(
      `SELECT COALESCE(MAX(position), -1) + 1 AS n FROM ${table} WHERE ${whereCol} = $1`,
      [val]
    );
    return Number(r!.n);
  }
  const r = await one<{ n: number }>(`SELECT COALESCE(MAX(position), -1) + 1 AS n FROM ${table}`);
  return Number(r!.n);
}

// -------------------------------------------------------------- courses ----
export async function createCourse(input: {
  title: string;
  subtitle?: string;
  audience?: string;
  description?: string;
  accent?: string;
}): Promise<Course> {
  const now = nowIso();
  const cid = id("crs");
  const base = slugify(input.title);
  let slug = base;
  let i = 2;
  while (await one("SELECT 1 FROM courses WHERE slug = $1", [slug])) slug = `${base}-${i++}`;
  const pos = await nextPos("courses", null);
  await run(
    `INSERT INTO courses (id, slug, title, subtitle, audience, description, accent, status, position, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',$8,$9,$10)`,
    [cid, slug, input.title, input.subtitle ?? null, input.audience ?? null, input.description ?? null, input.accent ?? null, pos, now, now]
  );
  return (await getCourse(cid))!;
}
export function listCourses(): Promise<Course[]> {
  return all<Course>("SELECT * FROM courses ORDER BY position, created_at");
}
export function getCourse(cid: string): Promise<Course | undefined> {
  return one<Course>("SELECT * FROM courses WHERE id = $1", [cid]);
}
export function getCourseBySlug(slug: string): Promise<Course | undefined> {
  return one<Course>("SELECT * FROM courses WHERE slug = $1", [slug]);
}
export async function updateCourse(
  cid: string,
  patch: Partial<Pick<Course, "title" | "subtitle" | "audience" | "description" | "accent" | "status" | "position">>
): Promise<Course | undefined> {
  const cur = await getCourse(cid);
  if (!cur) return undefined;
  const m = { ...cur, ...patch, updated_at: nowIso() };
  await run(
    `UPDATE courses SET title=$1, subtitle=$2, audience=$3, description=$4, accent=$5, status=$6, position=$7, updated_at=$8 WHERE id=$9`,
    [m.title, m.subtitle, m.audience, m.description, m.accent, m.status, m.position, m.updated_at, cid]
  );
  return getCourse(cid);
}
export async function deleteCourse(cid: string): Promise<boolean> {
  return (await run("DELETE FROM courses WHERE id = $1", [cid])) > 0;
}

// ------------------------------------------------------------- chapters ----
export async function createChapter(courseId: string, title: string): Promise<Chapter> {
  const now = nowIso();
  const cid = id("chp");
  const pos = await nextPos("chapters", "course_id", courseId);
  await run(
    `INSERT INTO chapters (id, course_id, title, position, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6)`,
    [cid, courseId, title, pos, now, now]
  );
  return (await getChapter(cid))!;
}
export function getChapter(cid: string): Promise<Chapter | undefined> {
  return one<Chapter>("SELECT * FROM chapters WHERE id = $1", [cid]);
}
export function listChapters(courseId: string): Promise<Chapter[]> {
  return all<Chapter>("SELECT * FROM chapters WHERE course_id = $1 ORDER BY position, created_at", [courseId]);
}
export async function updateChapter(cid: string, patch: Partial<Pick<Chapter, "title" | "position">>): Promise<Chapter | undefined> {
  const cur = await getChapter(cid);
  if (!cur) return undefined;
  const m = { ...cur, ...patch, updated_at: nowIso() };
  await run("UPDATE chapters SET title=$1, position=$2, updated_at=$3 WHERE id=$4", [m.title, m.position, m.updated_at, cid]);
  return getChapter(cid);
}
export async function deleteChapter(cid: string): Promise<boolean> {
  return (await run("DELETE FROM chapters WHERE id = $1", [cid])) > 0;
}

// -------------------------------------------------------------- lessons ----
export async function createLesson(
  chapterId: string,
  input: { title: string; takeaway?: string; tools?: string; durationMin?: number }
): Promise<Lesson> {
  const chapter = await getChapter(chapterId);
  if (!chapter) throw new Error("chapter not found");
  const now = nowIso();
  const lid = id("lsn");
  const pos = await nextPos("lessons", "chapter_id", chapterId);
  await run(
    `INSERT INTO lessons (id, chapter_id, course_id, title, takeaway, tools, duration_min, position, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [lid, chapterId, chapter.course_id, input.title, input.takeaway ?? null, input.tools ?? null, input.durationMin ?? 0, pos, now, now]
  );
  return (await getLesson(lid))!;
}
export function getLesson(lid: string): Promise<Lesson | undefined> {
  return one<Lesson>("SELECT * FROM lessons WHERE id = $1", [lid]);
}
export function listLessons(chapterId: string): Promise<Lesson[]> {
  return all<Lesson>("SELECT * FROM lessons WHERE chapter_id = $1 ORDER BY position, created_at", [chapterId]);
}
export async function updateLesson(
  lid: string,
  patch: Partial<Pick<Lesson, "title" | "takeaway" | "tools" | "duration_min" | "position">>
): Promise<Lesson | undefined> {
  const cur = await getLesson(lid);
  if (!cur) return undefined;
  const m = { ...cur, ...patch, updated_at: nowIso() };
  await run(
    "UPDATE lessons SET title=$1, takeaway=$2, tools=$3, duration_min=$4, position=$5, updated_at=$6 WHERE id=$7",
    [m.title, m.takeaway, m.tools, m.duration_min, m.position, m.updated_at, lid]
  );
  return getLesson(lid);
}
export async function deleteLesson(lid: string): Promise<boolean> {
  return (await run("DELETE FROM lessons WHERE id = $1", [lid])) > 0;
}

// --------------------------------------------------------------- videos ----
export async function createVideo(lessonId: string, originalName: string): Promise<Video> {
  const now = nowIso();
  const vid = id("vid");
  await run(
    `INSERT INTO videos (id, lesson_id, original_name, status, progress, stage, created_at, updated_at)
     VALUES ($1,$2,$3,'pending',0,'Queued',$4,$5)`,
    [vid, lessonId, originalName, now, now]
  );
  return (await getVideo(vid))!;
}
export function getVideo(vid: string): Promise<Video | undefined> {
  return one<Video>("SELECT * FROM videos WHERE id = $1", [vid]);
}
export function getLatestVideo(lessonId: string): Promise<Video | undefined> {
  return one<Video>("SELECT * FROM videos WHERE lesson_id = $1 ORDER BY created_at DESC LIMIT 1", [lessonId]);
}
export async function updateVideo(
  vid: string,
  patch: Partial<
    Pick<Video, "status" | "progress" | "stage" | "storage" | "master_url" | "poster_url" | "renditions" | "duration_sec" | "error">
  >
): Promise<Video | undefined> {
  const cur = await getVideo(vid);
  if (!cur) return undefined;
  const m = { ...cur, ...patch, updated_at: nowIso() };
  await run(
    `UPDATE videos SET status=$1, progress=$2, stage=$3, storage=$4, master_url=$5, poster_url=$6, renditions=$7, duration_sec=$8, error=$9, updated_at=$10 WHERE id=$11`,
    [m.status, m.progress, m.stage, m.storage, m.master_url, m.poster_url, m.renditions, m.duration_sec, m.error, m.updated_at, vid]
  );
  return getVideo(vid);
}

// ----------------------------------------------------------------- pdfs ----
export async function createPdf(
  lessonId: string,
  input: { title: string; filename: string; url: string; storage: string; sizeBytes?: number }
): Promise<Pdf> {
  const pid = id("pdf");
  const pos = await nextPos("pdfs", "lesson_id", lessonId);
  await run(
    `INSERT INTO pdfs (id, lesson_id, title, filename, url, storage, size_bytes, position, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [pid, lessonId, input.title, input.filename, input.url, input.storage, input.sizeBytes ?? null, pos, nowIso()]
  );
  return (await one<Pdf>("SELECT * FROM pdfs WHERE id = $1", [pid]))!;
}
export function listPdfs(lessonId: string): Promise<Pdf[]> {
  return all<Pdf>("SELECT * FROM pdfs WHERE lesson_id = $1 ORDER BY position, created_at", [lessonId]);
}
export async function deletePdf(pid: string): Promise<boolean> {
  return (await run("DELETE FROM pdfs WHERE id = $1", [pid])) > 0;
}

// -------------------------------------------------------------- quizzes ----
export async function upsertQuiz(
  lessonId: string,
  input: { title?: string; passPct?: number; questions: { prompt: string; options: string[]; correctIndex: number }[] }
): Promise<{ quiz: Quiz; questions: QuizQuestion[] }> {
  const now = nowIso();
  let quiz = await one<Quiz>("SELECT * FROM quizzes WHERE lesson_id = $1", [lessonId]);
  if (!quiz) {
    const qid = id("qz");
    await run(
      `INSERT INTO quizzes (id, lesson_id, title, pass_pct, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6)`,
      [qid, lessonId, input.title ?? "Quiz", input.passPct ?? 70, now, now]
    );
    quiz = (await one<Quiz>("SELECT * FROM quizzes WHERE id = $1", [qid]))!;
  } else {
    await run("UPDATE quizzes SET title=$1, pass_pct=$2, updated_at=$3 WHERE id=$4", [
      input.title ?? quiz.title,
      input.passPct ?? quiz.pass_pct,
      now,
      quiz.id,
    ]);
  }
  await run("DELETE FROM quiz_questions WHERE quiz_id = $1", [quiz.id]);
  for (let i = 0; i < input.questions.length; i++) {
    const q = input.questions[i];
    await run(
      `INSERT INTO quiz_questions (id, quiz_id, prompt, options, correct_index, position) VALUES ($1,$2,$3,$4,$5,$6)`,
      [id("qq"), quiz.id, q.prompt, JSON.stringify(q.options), q.correctIndex, i]
    );
  }
  return { quiz: (await one<Quiz>("SELECT * FROM quizzes WHERE id = $1", [quiz.id]))!, questions: await listQuestions(quiz.id) };
}
export async function getQuiz(lessonId: string): Promise<{ quiz: Quiz; questions: QuizQuestion[] } | undefined> {
  const quiz = await one<Quiz>("SELECT * FROM quizzes WHERE lesson_id = $1", [lessonId]);
  if (!quiz) return undefined;
  return { quiz, questions: await listQuestions(quiz.id) };
}
function listQuestions(quizId: string): Promise<QuizQuestion[]> {
  return all<QuizQuestion>("SELECT * FROM quiz_questions WHERE quiz_id = $1 ORDER BY position", [quizId]);
}
export async function deleteQuiz(lessonId: string): Promise<boolean> {
  return (await run("DELETE FROM quizzes WHERE lesson_id = $1", [lessonId])) > 0;
}

// --------------------------------------------------------- certificates ----
export async function upsertCertificate(
  courseId: string,
  input: Partial<Pick<Certificate, "title" | "issuer" | "partner" | "signature_name" | "signature_title" | "enabled">>
): Promise<Certificate> {
  const now = nowIso();
  const cert = await one<Certificate>("SELECT * FROM certificates WHERE course_id = $1", [courseId]);
  if (!cert) {
    const cid = id("cert");
    await run(
      `INSERT INTO certificates (id, course_id, title, issuer, partner, signature_name, signature_title, enabled, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        cid, courseId, input.title ?? "Certificate of Completion", input.issuer ?? "NEXIS School of Business",
        input.partner ?? "Government of Kerala", input.signature_name ?? null, input.signature_title ?? null,
        input.enabled ?? 1, now, now,
      ]
    );
    return (await one<Certificate>("SELECT * FROM certificates WHERE id = $1", [cid]))!;
  }
  const m = { ...cert, ...input, updated_at: now };
  await run(
    `UPDATE certificates SET title=$1, issuer=$2, partner=$3, signature_name=$4, signature_title=$5, enabled=$6, updated_at=$7 WHERE course_id=$8`,
    [m.title, m.issuer, m.partner, m.signature_name, m.signature_title, m.enabled, m.updated_at, courseId]
  );
  return (await one<Certificate>("SELECT * FROM certificates WHERE course_id = $1", [courseId]))!;
}
export function getCertificate(courseId: string): Promise<Certificate | undefined> {
  return one<Certificate>("SELECT * FROM certificates WHERE course_id = $1", [courseId]);
}

// ---------------------------------------------------------------- trees ----
export interface LessonNode extends Lesson {
  video: Video | null;
  pdfs: Pdf[];
  quizCount: number;
}
export interface ChapterNode extends Chapter {
  lessons: LessonNode[];
}
export interface CourseTree extends Course {
  chapters: ChapterNode[];
  certificate: Certificate | null;
}

export async function getCourseTree(courseId: string): Promise<CourseTree | undefined> {
  const course = await getCourse(courseId);
  if (!course) return undefined;
  const chapterRows = await listChapters(courseId);
  const chapters: ChapterNode[] = [];
  for (const ch of chapterRows) {
    const lessonRows = await listLessons(ch.id);
    const lessons: LessonNode[] = [];
    for (const ls of lessonRows) {
      const quiz = await getQuiz(ls.id);
      lessons.push({
        ...ls,
        video: (await getLatestVideo(ls.id)) ?? null,
        pdfs: await listPdfs(ls.id),
        quizCount: quiz ? quiz.questions.length : 0,
      });
    }
    chapters.push({ ...ch, lessons });
  }
  return { ...course, chapters, certificate: (await getCertificate(courseId)) ?? null };
}
