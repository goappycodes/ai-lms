# AI Veda — LMS screen scaffold

Next.js (App Router, TypeScript) scaffold of the **main screens** for the Phase 0 LMS,
branded **AI Veda** — powered by NEXIS, in partnership with the Government of Kerala.
Premium co-branded design (NEXIS crimson `#E83858` + charcoal, gold accents, Fraunces +
Plus Jakarta Sans), with **Udemy's learning experience, stripped to basics** as the
interaction reference — see [`../phase0-lms-brief.md`](../phase0-lms-brief.md).

This is UI scaffolding: real curriculum data, mock auth/progress, and a placeholder video
stage. The **authoring backend is real** (DB + REST API + video pipeline); the student-facing
screens still read the static curriculum in `lib/data.ts`.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. Requires **Node 24+** (uses the built-in `node:sqlite`) and
**ffmpeg on PATH** for video encoding.

## Backend (course authoring + video pipeline)

Content lives in a local SQLite database (`data/aiveda.db`, via Node's built-in
`node:sqlite` — no native build). Author it in the **Content Studio** at `/admin/studio`
(or drive the REST API directly).

**Entities:** Course → Chapter → Lesson; a Lesson holds one Video, many PDFs and one Quiz;
a Course has one Certificate template.

**Video pipeline (ported from the `ai-lms` experiment).** Upload a source video and the
server encodes a multi-bitrate HLS ladder with ffmpeg — **1080p → 720p → 480p → 360p → 240p**
(the 240p "survival rung" targets ~0.6 Mbps), 4 s segments — then publishes it:

- **Cloudflare R2** when configured (`.env.local`) — zero-egress delivery, the experiment's
  chosen path. Segments cached immutably, playlists short-TTL.
- **Local `/public/hls/<videoId>`** fallback otherwise, so it works out of the box in dev.

Encoding runs detached; poll `GET /api/videos/:id` for live `progress` / `stage` (the Studio
does this automatically). Copy `.env.example` → `.env.local` and fill the `R2_*` vars to use R2.

### REST API

| Method + path | Purpose |
|---|---|
| `GET/POST /api/courses` · `GET/PATCH/DELETE /api/courses/:id` | Courses (`?tree=1` for the full nested tree) |
| `GET/POST /api/courses/:id/chapters` · `PATCH/DELETE /api/chapters/:id` | Chapters |
| `POST /api/chapters/:id/lessons` · `GET/PATCH/DELETE /api/lessons/:id` | Lessons |
| `POST /api/lessons/:id/video` (multipart) · `GET /api/videos/:id` | Upload video + encode; poll status |
| `GET/POST /api/lessons/:id/pdfs` · `DELETE /api/pdfs/:id` | Lesson PDFs |
| `GET/PUT/DELETE /api/lessons/:id/quiz` | Quiz (questions upserted wholesale) |
| `GET/PUT /api/courses/:id/certificate` | Certificate template |
| `POST /api/seed` | Import the 3-track curriculum into the DB (idempotent) |

```
lib/db/       schema.sql, index.ts (connection), repo.ts (typed CRUD)
lib/video/    ffmpeg.ts (HLS ladder), r2.ts (upload), pipeline.ts (orchestrate), jobs.ts (runner)
app/api/      route handlers (above)
app/admin/studio/   authoring UI
```

## Screens

| Route | Screen | Notes |
|-------|--------|-------|
| `/login` | Login | Role switch (student / teacher / admin), language toggle |
| `/learning` | **My Learning** | Enrolled + available tracks as cards with progress + Resume |
| `/learn/[trackId]` | Resume redirect | Jumps to the current session |
| `/learn/[trackId]/[sessionId]` | **Session player** | Video stage + **curriculum sidebar** (phases → sessions, checkmarks), EN/ML audio toggle, downloads, discussion prompt |
| `/certificate/[trackId]` | Certificate | Bilingual NEXIS × Kerala completion certificate |
| `/teacher` | Teacher | Class stats + per-phase session coverage, "Play on panel" |
| `/admin` | Admin | Usage stats, content library, encode→R2 publish pipeline |

Navigate between student / teacher / admin from the top nav (all open for demo).

## Structure ↔ curriculum

Udemy **Course → Section → Lecture** maps to our **Track → Phase → Session**. The three
tracks (Explorer 5–7, Builder 8–10, Achiever 11–12), the 6-phase spine, and all 16 sessions
per track come straight from `ai-unlocked-three-tracks-16.xlsx`.

```
app/
  login/ learning/ teacher/ admin/
  learn/[trackId]/[sessionId]/     # the player
  certificate/[trackId]/
components/   TopNav, TrackCard, ProgressBar, CurriculumSidebar, VideoStage, SessionResources
lib/         data.ts (curriculum), progress.ts (mock student), types.ts
```

## Deliberately NOT built yet

- **Student read-path** — the learner screens still read `lib/data.ts`, not the DB. Point them
  at `repo`/the API next so authored content shows up for students.
- **Video playback UI** — the player stage is still a placeholder; wire the `ai-lms` hls.js
  player to `video.master_url`.
- **Auth** — no login/enrollment yet; the Studio and APIs are open. Add auth + gate video
  URLs (signed R2 / Worker) before real use.
- **Quiz taking + certificate PDF generation** — the quiz/certificate are authored and stored,
  not yet delivered to students.

## Next steps to make it real

1. Switch the learner pages to read courses from the DB (`getCourseTree`).
2. hls.js player bound to `master_url`; gate with signed R2 / a Worker.
3. Auth (student/teacher, age-appropriate for under-13) + per-student progress.
4. Quiz runner + certificate PDF; Malayalam UI strings (i18n).
