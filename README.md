# AI Veda — LMS screen scaffold

Next.js (App Router, TypeScript) scaffold of the **main screens** for the Phase 0 LMS,
branded **AI Veda** — powered by NEXIS, in partnership with the Government of Kerala.
Premium co-branded design (NEXIS crimson `#E83858` + charcoal, gold accents, Fraunces +
Plus Jakarta Sans), with **Udemy's learning experience, stripped to basics** as the
interaction reference — see [`../phase0-lms-brief.md`](../phase0-lms-brief.md).

This is UI scaffolding: real curriculum data, mock auth/progress, and a placeholder video
stage. No backend yet.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

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

## Deliberately NOT built (matches the brief's scope)

- **Video playback** — the stage is a placeholder. Wire to the `ai-lms` PoC's hls.js player
  reading gated HLS from Cloudflare R2 (brief §7).
- **Auth / DB** — logins, enrollment, and progress are mocked in `lib/progress.ts`.
- Assessment layer (quizzes, uploads, rubrics), certificate PDF generation, admin uploads —
  all Phase 1 or later wiring.

## Next steps to make it real

1. Auth (student/teacher, age-appropriate for under-13) + enrollment.
2. Replace `VideoStage` placeholder with the hls.js player + **signed R2 / Worker** gating.
3. Persist progress; drive certificates from verified completion.
4. Malayalam UI strings (structure is EN-first; add i18n).
