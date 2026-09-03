-- P1-06 · Progress (D-07). Two independent facts per lesson: how much was
-- actually watched, and whether it was marked complete.

CREATE TABLE lesson_progress (
  user_id         text        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  -- course_id is in the key deliberately. A lesson shared between Builder and
  -- Achiever must not share PROGRESS: an Achiever student should not open the
  -- course and find eight lessons already complete because Builder tracked them.
  course_id       text        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id       text        NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  position_sec    integer     NOT NULL DEFAULT 0,
  -- High-water mark, separate from position. A student who watches to the end
  -- then scrubs back to rewatch has not un-completed the lesson: position moves
  -- backwards, this does not.
  furthest_sec    integer     NOT NULL DEFAULT 0,
  completed_at    timestamptz,
  completed_via   text,
  first_played_at timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id, lesson_id),

  CONSTRAINT lesson_progress_via_valid CHECK (completed_via IN ('auto','manual')),
  -- completed_at and completed_via are set together or not at all.
  CONSTRAINT lesson_progress_completion_pair CHECK (
    (completed_at IS NULL AND completed_via IS NULL) OR
    (completed_at IS NOT NULL AND completed_via IS NOT NULL)
  ),
  -- Non-negative only. Deliberately NOT 'furthest >= position': a student who
  -- seeks forward would briefly violate it, and a rejected heartbeat is worse
  -- than a stale one. The upsert keeps the high-water mark with GREATEST().
  CONSTRAINT lesson_progress_seconds_sane CHECK (position_sec >= 0 AND furthest_sec >= 0)
);

-- The per-lesson class view: how many of a class finished each lesson.
CREATE INDEX lesson_progress_course_lesson_idx ON lesson_progress (course_id, lesson_id);
-- "Last active" on the teacher roster.
CREATE INDEX lesson_progress_user_recent_idx ON lesson_progress (user_id, updated_at DESC);
