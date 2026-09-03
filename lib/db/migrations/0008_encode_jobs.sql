-- P1-08 · Durable encode jobs (D-06). Replaces the in-memory Set that loses
-- every running job when the encoder machine sleeps or the dev server restarts,
-- stranding a video row on 'encoding' with no way back.

CREATE TABLE encode_jobs (
  id           text PRIMARY KEY,
  video_id     text        NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  status       text        NOT NULL DEFAULT 'queued',
  attempts     smallint    NOT NULL DEFAULT 0,
  -- A 'running' job whose heartbeat has gone stale is dead. On startup those
  -- are requeued or failed, which is what makes a stranded encode recoverable.
  heartbeat_at timestamptz,
  started_at   timestamptz,
  finished_at  timestamptz,
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT encode_jobs_status_valid CHECK (status IN ('queued','running','done','error'))
);
CREATE INDEX encode_jobs_queue_idx ON encode_jobs (status, created_at);
CREATE INDEX encode_jobs_video_idx ON encode_jobs (video_id, created_at DESC);
-- One live job per video: a second upload should not race the first.
CREATE UNIQUE INDEX encode_jobs_one_active_key ON encode_jobs (video_id)
  WHERE status IN ('queued','running');
