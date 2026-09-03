-- P1-03 · Schools, classes, teachers. A school is itself a login account
-- (D-14), so schools.user_id and users.school_id point at each other. Both
-- foreign keys are DEFERRABLE INITIALLY DEFERRED, which lets one transaction
-- insert the school user and the school row in either order.

CREATE TABLE schools (
  id         text PRIMARY KEY,
  user_id    text        NOT NULL UNIQUE,
  name       text        NOT NULL,
  district   text,
  code       text UNIQUE,
  is_demo    boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT schools_user_fk FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);

-- Load-bearing for roster import (D-15): rows are matched to a school by name
-- from a spreadsheet column. Without case-insensitive uniqueness "GHSS Kochi"
-- and "GHSS KOCHI" become two schools and an import silently splits a roster.
CREATE UNIQUE INDEX schools_name_key ON schools (lower(name));

CREATE TABLE classes (
  id            text PRIMARY KEY,
  school_id     text        NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  name          text        NOT NULL,
  level         smallint    NOT NULL,
  academic_year text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT classes_level_valid CHECK (level BETWEEN 5 AND 12)
);
CREATE UNIQUE INDEX classes_name_key ON classes (school_id, academic_year, lower(name));
CREATE INDEX classes_school_idx ON classes (school_id);

-- A class can have more than one teacher, and a teacher more than one class.
CREATE TABLE class_teachers (
  class_id        text        NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_user_id text        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, teacher_user_id)
);
-- Every teacher screen starts from "which classes are mine".
CREATE INDEX class_teachers_teacher_idx ON class_teachers (teacher_user_id);

-- Now that both targets exist, close the loop from users.
ALTER TABLE users
  ADD CONSTRAINT users_school_fk FOREIGN KEY (school_id) REFERENCES schools(id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT users_class_fk  FOREIGN KEY (class_id)  REFERENCES classes(id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
