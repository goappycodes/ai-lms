-- P1-07 · Certificates. Two tables, because a template and an issued
-- certificate are different things and the old schema conflated them.

CREATE TABLE certificate_templates (
  id              text PRIMARY KEY,
  course_id       text        NOT NULL UNIQUE REFERENCES courses(id) ON DELETE CASCADE,
  issuer          text        NOT NULL DEFAULT 'NEXIS School of Business',
  partner         text        NOT NULL DEFAULT 'Government of Kerala',
  signature_name  text,
  signature_title text,
  enabled         boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE certificates_issued (
  id                text PRIMARY KEY,
  user_id           text        NOT NULL REFERENCES users(id)   ON DELETE RESTRICT,
  course_id         text        NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  verification_code text        NOT NULL UNIQUE,
  -- Copied at issue time, not joined. A certificate is a statement about a
  -- moment: if a name is corrected or a student transfers school next year,
  -- the verification page must still match the PDF already in someone's hand.
  student_name      text        NOT NULL,
  school_name       text        NOT NULL,
  issued_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX certificates_issued_once_key ON certificates_issued (user_id, course_id);
CREATE INDEX certificates_issued_course_idx ON certificates_issued (course_id, issued_at DESC);
