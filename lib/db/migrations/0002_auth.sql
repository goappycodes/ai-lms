-- P1-02 · Identity. One users table for all four roles, so sign-in has a
-- single code path (D-14).
--
-- school_id and class_id are declared here but their foreign keys are added in
-- 0003, once schools and classes exist. users and schools reference each other
-- (a school IS a login), so the cycle has to be broken somewhere.

CREATE TABLE users (
  id                   text PRIMARY KEY,
  username             text        NOT NULL,
  password_hash        text        NOT NULL,
  role                 text        NOT NULL,
  full_name            text        NOT NULL,
  email                text,
  school_id            text,
  class_id             text,
  status               text        NOT NULL DEFAULT 'active',
  must_change_password boolean     NOT NULL DEFAULT false,
  last_login_at        timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT users_role_valid   CHECK (role   IN ('super_admin','school','teacher','student')),
  CONSTRAINT users_status_valid CHECK (status IN ('active','disabled')),

  -- Only the super admin sits outside a school.
  CONSTRAINT users_school_scope CHECK (
    (role =  'super_admin' AND school_id IS NULL) OR
    (role <> 'super_admin' AND school_id IS NOT NULL)
  ),
  -- A student is always in exactly one class and never has an email: they are
  -- provisioned by a teacher and recover through the reset chain (D-04). The
  -- constraint stops a well-meaning roster import from filling one in.
  CONSTRAINT users_student_shape CHECK (
    role <> 'student' OR (class_id IS NOT NULL AND email IS NULL)
  )
);

CREATE UNIQUE INDEX users_username_key ON users (lower(username));
CREATE UNIQUE INDEX users_email_key    ON users (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX users_school_role_idx     ON users (school_id, role);
CREATE INDEX users_class_idx           ON users (class_id) WHERE role = 'student';

-- The id is a hash of the cookie token, never the token: a leaked database
-- backup must not hand over live sessions.
CREATE TABLE sessions (
  id         text PRIMARY KEY,
  user_id    text        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx    ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

-- Only ever used for the super admin's email recovery. Every other reset is
-- performed by the level above and recorded in audit_log instead — there is no
-- token to manage when a teacher reads a new password aloud.
CREATE TABLE password_resets (
  id         text PRIMARY KEY,
  user_id    text        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text        NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_resets_user_idx ON password_resets (user_id);

CREATE TABLE audit_log (
  id            text PRIMARY KEY,
  actor_user_id text REFERENCES users(id) ON DELETE SET NULL,
  action        text        NOT NULL,
  target_type   text,
  target_id     text,   -- not a foreign key: targets outlive their rows
  detail        jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);
CREATE INDEX audit_log_actor_idx   ON audit_log (actor_user_id, created_at DESC);
CREATE INDEX audit_log_target_idx  ON audit_log (target_type, target_id);
