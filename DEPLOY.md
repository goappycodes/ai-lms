# Deploying AI Veda LMS

The app runs as **two tiers that share one Supabase database and one R2 bucket**.

```
            ┌─────────────────────────┐         ┌──────────────────────┐
Students /  │  Vercel (front-end +    │  reads  │  Supabase Postgres   │
teachers →  │  authoring / CRUD)      │ ──────▶ │  (courses, lessons,  │
            │  NO video encoding here │         │   quizzes, videos…)  │
            └─────────────────────────┘         └──────────▲───────────┘
                                                           │ writes video rows
            ┌─────────────────────────┐  encode  ┌─────────┴───────────┐
Admin uploads a video on →           │  ffmpeg   │  Cloudflare R2      │
            │  LOCAL app (npm run dev)│ ────────▶ │  (HLS ladder,       │
            │  has ffmpeg + disk      │  publish  │   zero-egress)      │
            └─────────────────────────┘          └─────────────────────┘
                     student player streams HLS from R2 ▲
```

## Vercel (front-end + authoring)

Serves the UI and all course/chapter/lesson/quiz/certificate CRUD against Supabase.
It **cannot encode video** (serverless has no ffmpeg, a read-only filesystem, and no
long-running jobs) — the upload endpoint returns a 501 with guidance there.

Set these in **Settings → Environment Variables** (Production + Preview), then Redeploy.
Enter every value **raw** — Vercel does not do `$` expansion, so no `\$` escaping:

- `SUPABASE_DB_HOST` = `aws-0-ap-south-1.pooler.supabase.com`
- `SUPABASE_DB_PORT` = `6543`  (transaction pooler — best for serverless)
- `SUPABASE_DB_USER` = `postgres.<project-ref>`
- `SUPABASE_DB_PASSWORD` = *(raw DB password, real `$`, no backslash)*
- `SUPABASE_DB_NAME` = `postgres`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`
- (optional) `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

> Env changes only apply to **new** deployments — Redeploy after editing.

## Local encoder (video ingestion)

Run the app on a machine with **ffmpeg on PATH**. Use the same Supabase creds
(`.env.local`, `$` escaped as `\$` because Next expands env vars) **and the same
R2 creds as Vercel** — otherwise encodes fall back to `/public/hls` and are
stranded on that machine.

```bash
npm run db:setup     # one-time: create tables in Supabase
npm run dev          # author + upload/encode videos here
```

Uploading a video: encodes an HLS ladder → pushes to R2 → writes the R2
`master_url` into Supabase → the Vercel app plays it. No redeploy needed.
