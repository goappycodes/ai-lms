import { getDb } from "./index";
import { id, nowIso, slugify } from "@/lib/ids";

// node:sqlite returns generic, NULL-PROTOTYPE row records. We both cast them to
// our types and shallow-clone into plain objects — null-prototype objects can't
// cross the Server→Client Component boundary in Next.
type Param = string | number | bigint | null | Uint8Array;
function all<T>(sql: string, ...p: Param[]): T[] {
  return (getDb().prepare(sql).all(...p) as unknown[]).map((r) => ({ ...(r as object) })) as unknown as T[];
}
function one<T>(sql: string, ...p: Param[]): T | undefined {
  const r = getDb().prepare(sql).get(...p);
  return r ? ({ ...(r as object) } as unknown as T) : undefined;
}
function run(sql: string, ...p: Param[]): number {
  return Number(getDb().prepare(sql).run(...p).changes);
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
function nextPos(table: string, whereCol: string | null, val?: string): number {
  if (whereCol) {
    return one<{ n: number }>(
      `SELECT COALESCE(MAX(position), -1) + 1 AS n FROM ${table} WHERE ${whereCol} = ?`,
      val!
    )!.n;
  }
  return one<{ n: number }>(`SELECT COALESCE(MAX(position), -1) + 1 AS n FROM ${table}`)!.n;
}

// -------------------------------------------------------------- courses ----
export function createCourse(input: {
  title: string;
  subtitle?: string;
  audience?: string;
  description?: string;
  accent?: string;
}): Course {
  const now = nowIso();
  const cid = id("crs");
  const base = slugify(input.title);
  let slug = base;
  let i = 2;
  while (one("SELECT 1 FROM courses WHERE slug = ?", slug)) slug = `${base}-${i++}`;
  run(
    `INSERT INTO courses (id, slug, title, subtitle, audience, description, accent, status, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
    cid,
    slug,
    input.title,
    input.subtitle ?? null,
    input.audience ?? null,
    input.description ?? null,
    input.accent ?? null,
    nextPos("courses", null),
    now,
    now
  );
  return getCourse(cid)!;
}
export function listCourses(): Course[] {
  return all<Course>("SELECT * FROM courses ORDER BY position, created_at");
}
export function getCourse(cid: string): Course | undefined {
  return one<Course>("SELECT * FROM courses WHERE id = ?", cid);
}
export function getCourseBySlug(slug: string): Course | undefined {
  return one<Course>("SELECT * FROM courses WHERE slug = ?", slug);
}
export function updateCourse(
  cid: string,
  patch: Partial<Pick<Course, "title" | "subtitle" | "audience" | "description" | "accent" | "status" | "position">>
): Course | undefined {
  const cur = getCourse(cid);
  if (!cur) return undefined;
  const m = { ...cur, ...patch, updated_at: nowIso() };
  run(
    `UPDATE courses SET title=?, subtitle=?, audience=?, description=?, accent=?, status=?, position=?, updated_at=? WHERE id=?`,
    m.title, m.subtitle, m.audience, m.description, m.accent, m.status, m.position, m.updated_at, cid
  );
  return getCourse(cid);
}
export function deleteCourse(cid: string): boolean {
  return run("DELETE FROM courses WHERE id = ?", cid) > 0;
}

// ------------------------------------------------------------- chapters ----
export function createChapter(courseId: string, title: string): Chapter {
  const now = nowIso();
  const cid = id("chp");
  run(
    `INSERT INTO chapters (id, course_id, title, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    cid, courseId, title, nextPos("chapters", "course_id", courseId), now, now
  );
  return getChapter(cid)!;
}
export function getChapter(cid: string): Chapter | undefined {
  return one<Chapter>("SELECT * FROM chapters WHERE id = ?", cid);
}
export function listChapters(courseId: string): Chapter[] {
  return all<Chapter>("SELECT * FROM chapters WHERE course_id = ? ORDER BY position, created_at", courseId);
}
export function updateChapter(cid: string, patch: Partial<Pick<Chapter, "title" | "position">>): Chapter | undefined {
  const cur = getChapter(cid);
  if (!cur) return undefined;
  const m = { ...cur, ...patch, updated_at: nowIso() };
  run("UPDATE chapters SET title=?, position=?, updated_at=? WHERE id=?", m.title, m.position, m.updated_at, cid);
  return getChapter(cid);
}
export function deleteChapter(cid: string): boolean {
  return run("DELETE FROM chapters WHERE id = ?", cid) > 0;
}

// -------------------------------------------------------------- lessons ----
export function createLesson(
  chapterId: string,
  input: { title: string; takeaway?: string; tools?: string; durationMin?: number }
): Lesson {
  const chapter = getChapter(chapterId);
  if (!chapter) throw new Error("chapter not found");
  const now = nowIso();
  const lid = id("lsn");
  run(
    `INSERT INTO lessons (id, chapter_id, course_id, title, takeaway, tools, duration_min, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    lid, chapterId, chapter.course_id, input.title, input.takeaway ?? null, input.tools ?? null,
    input.durationMin ?? 0, nextPos("lessons", "chapter_id", chapterId), now, now
  );
  return getLesson(lid)!;
}
export function getLesson(lid: string): Lesson | undefined {
  return one<Lesson>("SELECT * FROM lessons WHERE id = ?", lid);
}
export function listLessons(chapterId: string): Lesson[] {
  return all<Lesson>("SELECT * FROM lessons WHERE chapter_id = ? ORDER BY position, created_at", chapterId);
}
export function updateLesson(
  lid: string,
  patch: Partial<Pick<Lesson, "title" | "takeaway" | "tools" | "duration_min" | "position">>
): Lesson | undefined {
  const cur = getLesson(lid);
  if (!cur) return undefined;
  const m = { ...cur, ...patch, updated_at: nowIso() };
  run(
    "UPDATE lessons SET title=?, takeaway=?, tools=?, duration_min=?, position=?, updated_at=? WHERE id=?",
    m.title, m.takeaway, m.tools, m.duration_min, m.position, m.updated_at, lid
  );
  return getLesson(lid);
}
export function deleteLesson(lid: string): boolean {
  return run("DELETE FROM lessons WHERE id = ?", lid) > 0;
}

// --------------------------------------------------------------- videos ----
export function createVideo(lessonId: string, originalName: string): Video {
  const now = nowIso();
  const vid = id("vid");
  run(
    `INSERT INTO videos (id, lesson_id, original_name, status, progress, stage, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', 0, 'Queued', ?, ?)`,
    vid, lessonId, originalName, now, now
  );
  return getVideo(vid)!;
}
export function getVideo(vid: string): Video | undefined {
  return one<Video>("SELECT * FROM videos WHERE id = ?", vid);
}
export function getLatestVideo(lessonId: string): Video | undefined {
  return one<Video>("SELECT * FROM videos WHERE lesson_id = ? ORDER BY created_at DESC LIMIT 1", lessonId);
}
export function updateVideo(
  vid: string,
  patch: Partial<
    Pick<Video, "status" | "progress" | "stage" | "storage" | "master_url" | "poster_url" | "renditions" | "duration_sec" | "error">
  >
): Video | undefined {
  const cur = getVideo(vid);
  if (!cur) return undefined;
  const m = { ...cur, ...patch, updated_at: nowIso() };
  run(
    `UPDATE videos SET status=?, progress=?, stage=?, storage=?, master_url=?, poster_url=?, renditions=?, duration_sec=?, error=?, updated_at=? WHERE id=?`,
    m.status, m.progress, m.stage, m.storage, m.master_url, m.poster_url, m.renditions, m.duration_sec, m.error, m.updated_at, vid
  );
  return getVideo(vid);
}

// ----------------------------------------------------------------- pdfs ----
export function createPdf(
  lessonId: string,
  input: { title: string; filename: string; url: string; storage: string; sizeBytes?: number }
): Pdf {
  const pid = id("pdf");
  run(
    `INSERT INTO pdfs (id, lesson_id, title, filename, url, storage, size_bytes, position, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    pid, lessonId, input.title, input.filename, input.url, input.storage,
    input.sizeBytes ?? null, nextPos("pdfs", "lesson_id", lessonId), nowIso()
  );
  return one<Pdf>("SELECT * FROM pdfs WHERE id = ?", pid)!;
}
export function listPdfs(lessonId: string): Pdf[] {
  return all<Pdf>("SELECT * FROM pdfs WHERE lesson_id = ? ORDER BY position, created_at", lessonId);
}
export function deletePdf(pid: string): boolean {
  return run("DELETE FROM pdfs WHERE id = ?", pid) > 0;
}

// -------------------------------------------------------------- quizzes ----
export function upsertQuiz(
  lessonId: string,
  input: { title?: string; passPct?: number; questions: { prompt: string; options: string[]; correctIndex: number }[] }
): { quiz: Quiz; questions: QuizQuestion[] } {
  const now = nowIso();
  let quiz = one<Quiz>("SELECT * FROM quizzes WHERE lesson_id = ?", lessonId);
  if (!quiz) {
    const qid = id("qz");
    run(
      `INSERT INTO quizzes (id, lesson_id, title, pass_pct, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      qid, lessonId, input.title ?? "Quiz", input.passPct ?? 70, now, now
    );
    quiz = one<Quiz>("SELECT * FROM quizzes WHERE id = ?", qid)!;
  } else {
    run(
      "UPDATE quizzes SET title=?, pass_pct=?, updated_at=? WHERE id=?",
      input.title ?? quiz.title, input.passPct ?? quiz.pass_pct, now, quiz.id
    );
  }
  run("DELETE FROM quiz_questions WHERE quiz_id = ?", quiz.id);
  input.questions.forEach((q, i) => {
    run(
      `INSERT INTO quiz_questions (id, quiz_id, prompt, options, correct_index, position) VALUES (?, ?, ?, ?, ?, ?)`,
      id("qq"), quiz!.id, q.prompt, JSON.stringify(q.options), q.correctIndex, i
    );
  });
  return { quiz: one<Quiz>("SELECT * FROM quizzes WHERE id = ?", quiz.id)!, questions: listQuestions(quiz.id) };
}
export function getQuiz(lessonId: string): { quiz: Quiz; questions: QuizQuestion[] } | undefined {
  const quiz = one<Quiz>("SELECT * FROM quizzes WHERE lesson_id = ?", lessonId);
  if (!quiz) return undefined;
  return { quiz, questions: listQuestions(quiz.id) };
}
function listQuestions(quizId: string): QuizQuestion[] {
  return all<QuizQuestion>("SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY position", quizId);
}
export function deleteQuiz(lessonId: string): boolean {
  return run("DELETE FROM quizzes WHERE lesson_id = ?", lessonId) > 0;
}

// --------------------------------------------------------- certificates ----
export function upsertCertificate(
  courseId: string,
  input: Partial<Pick<Certificate, "title" | "issuer" | "partner" | "signature_name" | "signature_title" | "enabled">>
): Certificate {
  const now = nowIso();
  const cert = one<Certificate>("SELECT * FROM certificates WHERE course_id = ?", courseId);
  if (!cert) {
    const cid = id("cert");
    run(
      `INSERT INTO certificates (id, course_id, title, issuer, partner, signature_name, signature_title, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      cid, courseId, input.title ?? "Certificate of Completion", input.issuer ?? "NEXIS School of Business",
      input.partner ?? "Government of Kerala", input.signature_name ?? null, input.signature_title ?? null,
      input.enabled ?? 1, now, now
    );
    return one<Certificate>("SELECT * FROM certificates WHERE id = ?", cid)!;
  }
  const m = { ...cert, ...input, updated_at: now };
  run(
    `UPDATE certificates SET title=?, issuer=?, partner=?, signature_name=?, signature_title=?, enabled=?, updated_at=? WHERE course_id=?`,
    m.title, m.issuer, m.partner, m.signature_name, m.signature_title, m.enabled, m.updated_at, courseId
  );
  return one<Certificate>("SELECT * FROM certificates WHERE course_id = ?", courseId)!;
}
export function getCertificate(courseId: string): Certificate | undefined {
  return one<Certificate>("SELECT * FROM certificates WHERE course_id = ?", courseId);
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

export function getCourseTree(courseId: string): CourseTree | undefined {
  const course = getCourse(courseId);
  if (!course) return undefined;
  const chapters = listChapters(courseId).map((ch): ChapterNode => {
    const lessons = listLessons(ch.id).map((ls): LessonNode => {
      const quiz = getQuiz(ls.id);
      return {
        ...ls,
        video: getLatestVideo(ls.id) ?? null,
        pdfs: listPdfs(ls.id),
        quizCount: quiz ? quiz.questions.length : 0,
      };
    });
    return { ...ch, lessons };
  });
  return { ...course, chapters, certificate: getCertificate(courseId) ?? null };
}
