-- P1-05 · Courses and lessons. A lesson is NOT owned by a course: Builder and
-- Achiever share eight sessions, and course_lessons is what makes that one
-- lesson row instead of two (D-01). Chapters are gone — the curriculum is a
-- flat ordered list, so a chapters table would hold one row per course.

CREATE TABLE courses (
  id         text PRIMARY KEY,
  slug       text        NOT NULL UNIQUE,
  accent     text,
  status     text        NOT NULL DEFAULT 'draft',
  position   integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT courses_status_valid CHECK (status IN ('draft','published'))
);

-- Which class level sees which course. Data rather than a hard-coded mapping,
-- so an unusual arrangement is a row, not a deployment. One course per level.
CREATE TABLE course_levels (
  level     smallint PRIMARY KEY,
  course_id text NOT NULL REFERENCES courses(id) ON DELETE CASCADE,

  CONSTRAINT course_levels_valid CHECK (level BETWEEN 5 AND 12)
);
CREATE INDEX course_levels_course_idx ON course_levels (course_id);

CREATE TABLE lessons (
  id           text PRIMARY KEY,
  duration_min smallint    NOT NULL DEFAULT 30,
  tools        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE course_lessons (
  course_id   text    NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id   text    NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
  position    integer NOT NULL,
  is_advanced boolean NOT NULL DEFAULT false,
  PRIMARY KEY (course_id, lesson_id),

  CONSTRAINT course_lessons_position_positive CHECK (position >= 1)
);
CREATE UNIQUE INDEX course_lessons_position_key ON course_lessons (course_id, position);
-- Answers "which courses would editing this lesson affect?"
CREATE INDEX course_lessons_lesson_idx ON course_lessons (lesson_id);

-- Language-dependent text lives here rather than in _en / _ml columns, so
-- "which lessons are missing Malayalam?" is a query. If an 'ml' row is absent
-- the app falls back to 'en': a half-translated course must render, not 500.
CREATE TABLE course_translations (
  course_id text NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  locale    text NOT NULL,
  title     text NOT NULL,
  subtitle  text,
  audience  text,
  PRIMARY KEY (course_id, locale),

  CONSTRAINT course_translations_locale_valid CHECK (locale IN ('en','ml'))
);

CREATE TABLE lesson_translations (
  lesson_id text NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  locale    text NOT NULL,
  title     text NOT NULL,
  covers    text,
  PRIMARY KEY (lesson_id, locale),

  CONSTRAINT lesson_translations_locale_valid CHECK (locale IN ('en','ml'))
);
