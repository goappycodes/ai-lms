-- P1-04 · Video and documents, one per lesson per language (Q1: Malayalam
-- ships as a separate video).
--
-- Kept as two tables rather than one generic `assets`: video carries ten
-- encode-specific columns that would be NULL on every PDF row. The
-- lesson_assets view at the bottom gives the Studio its six-slot completeness
-- grid in a single query anyway (P5-13).

CREATE TABLE videos (
  id            text PRIMARY KEY,
  lesson_id     text        NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  locale        text        NOT NULL,
  original_name text,
  status        text        NOT NULL DEFAULT 'pending',
  progress      real        NOT NULL DEFAULT 0,
  stage         text,
  storage       text,
  -- Key PREFIX, e.g. 'hls/vid_abc123'. Not a URL: the delivery domain changes
  -- twice in the next fortnight (custom domain, then the D-17 Worker), and it
  -- must be configuration rather than data.
  storage_key   text,
  has_poster    boolean     NOT NULL DEFAULT false,
  renditions    text[],
  duration_sec  real,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT videos_locale_valid  CHECK (locale IN ('en','ml')),
  CONSTRAINT videos_status_valid  CHECK (status IN ('pending','encoding','uploading','ready','error')),
  CONSTRAINT videos_storage_valid CHECK (storage IS NULL OR storage IN ('r2','local'))
);

-- Several rows per (lesson, locale) are allowed and the app takes the newest
-- READY one. Taking the newest row of any status — which is what the old code
-- did — means a failed re-encode replaces a working video with a broken one.
CREATE INDEX videos_lesson_locale_idx ON videos (lesson_id, locale, created_at DESC);
CREATE INDEX videos_ready_idx ON videos (lesson_id, locale, created_at DESC) WHERE status = 'ready';

CREATE TABLE documents (
  id          text PRIMARY KEY,
  lesson_id   text        NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  kind        text        NOT NULL,
  locale      text        NOT NULL,
  title       text        NOT NULL,
  filename    text        NOT NULL,
  storage_key text        NOT NULL,
  storage     text        NOT NULL,
  size_bytes  integer,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT documents_kind_valid    CHECK (kind    IN ('worksheet','handout')),
  CONSTRAINT documents_locale_valid  CHECK (locale  IN ('en','ml')),
  CONSTRAINT documents_storage_valid CHECK (storage IN ('r2','local'))
);
-- Exactly one worksheet and one handout per language per lesson. Re-upload
-- replaces rather than accumulating.
CREATE UNIQUE INDEX documents_slot_key ON documents (lesson_id, kind, locale);

-- Six expected slots per lesson: video, worksheet, handout × en, ml.
-- 16 lessons × 6 = the 96 assets the brief counts.
CREATE VIEW lesson_assets AS
  SELECT lesson_id,
         'video'::text AS kind,
         locale,
         status = 'ready' AS is_ready
    FROM videos
  UNION ALL
  SELECT lesson_id, kind, locale, true FROM documents;
