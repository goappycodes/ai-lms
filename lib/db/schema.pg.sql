-- AI Veda LMS schema (Supabase Postgres). Idempotent.
-- Timestamps are stored as ISO-8601 TEXT to keep the app layer simple.

CREATE TABLE IF NOT EXISTS courses (
  id          TEXT PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  subtitle    TEXT,
  audience    TEXT,
  description TEXT,
  accent      TEXT,
  status      TEXT NOT NULL DEFAULT 'draft',
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chapters (
  id         TEXT PRIMARY KEY,
  course_id  TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chapters_course ON chapters(course_id);

CREATE TABLE IF NOT EXISTS lessons (
  id           TEXT PRIMARY KEY,
  chapter_id   TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  course_id    TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  takeaway     TEXT,
  tools        TEXT,
  duration_min INTEGER NOT NULL DEFAULT 0,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lessons_chapter ON lessons(chapter_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);

CREATE TABLE IF NOT EXISTS videos (
  id            TEXT PRIMARY KEY,
  lesson_id     TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  original_name TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  progress      DOUBLE PRECISION NOT NULL DEFAULT 0,
  stage         TEXT,
  storage       TEXT,
  master_url    TEXT,
  poster_url    TEXT,
  renditions    TEXT,
  duration_sec  DOUBLE PRECISION,
  error         TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_videos_lesson ON videos(lesson_id);

CREATE TABLE IF NOT EXISTS pdfs (
  id         TEXT PRIMARY KEY,
  lesson_id  TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  filename   TEXT NOT NULL,
  url        TEXT NOT NULL,
  storage    TEXT NOT NULL,
  size_bytes INTEGER,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pdfs_lesson ON pdfs(lesson_id);

CREATE TABLE IF NOT EXISTS quizzes (
  id         TEXT PRIMARY KEY,
  lesson_id  TEXT NOT NULL UNIQUE REFERENCES lessons(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'Quiz',
  pass_pct   INTEGER NOT NULL DEFAULT 70,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id            TEXT PRIMARY KEY,
  quiz_id       TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  prompt        TEXT NOT NULL,
  options       TEXT NOT NULL,
  correct_index INTEGER NOT NULL DEFAULT 0,
  position      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_questions_quiz ON quiz_questions(quiz_id);

CREATE TABLE IF NOT EXISTS certificates (
  id              TEXT PRIMARY KEY,
  course_id       TEXT NOT NULL UNIQUE REFERENCES courses(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT 'Certificate of Completion',
  issuer          TEXT NOT NULL DEFAULT 'NEXIS School of Business',
  partner         TEXT NOT NULL DEFAULT 'Government of Kerala',
  signature_name  TEXT,
  signature_title TEXT,
  enabled         INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
