# AI Veda — Day-by-Day Build Plan

**Day 1 is Thursday 3 September. Live Tuesday 15 September. Tested and signed off Sunday 20 September.**
Companion to [AI-VEDA-BUILD-BRIEF.md](./AI-VEDA-BUILD-BRIEF.md) (two pages) and
[BRIEF-DETAIL.md](./BRIEF-DETAIL.md) (full) — task rows reference the
decisions (`D-01`…`D-17`) recorded there.

**125 tasks · 13 build days · 5 test days**

---

## All questions answered — nothing is waiting

| Answer | Effect on the plan |
| --- | --- |
| Malayalam = **separate video per language** | No change. The `locale` field on the asset already assumed it |
| Video URLs **must be protected** | **New work**: `P6-13`…`P6-16`. Edge Worker, tokens, cache verification |
| Offline download = **no** | No change. Stays out of scope |
| Concurrency = **500, with heavy caching** | Database is comfortable. The caching instruction is the real one — `P3-09`, `P6-17` |

> **Two weekends are working days.** Sep 5–6 and Sep 12–13 sit inside the build window;
> Sep 19–20 sit in testing. If that is not the case, the plan loses four days and the descope
> ladder starts on Day 3, not Day 12.

---

## Status legend

| Status | Meaning |
| --- | --- |
| ⬜ | Not started |
| 🟨 | In progress |
| ✅ | Done and verified |
| 🟥 | Blocked — add it to the [blocker register](#blocker-register) |
| ⬛ | Descoped |

Task IDs are stable and safe to quote in standups and commits. `P2-07` always means the demo
login panel.

---

## Milestones

| Day | Date | Milestone |
| --- | --- | --- |
| 3 | Sat 5 Sep | Schema live on staging — everything else builds on it |
| 5 | Mon 7 Sep | Login works, roles enforced, demo accounts usable |
| 9 | Fri 11 Sep | **A student can watch a real video** — first end-to-end journey |
| 10 | Sat 12 Sep | Progress and resume working |
| 12 | Mon 14 Sep | Feature freeze · all content handed over |
| 13 | Tue 15 Sep | **Live** |
| 18 | Sun 20 Sep | Tested, revised, signed off |

---

## Rules that apply to every task

Conditions on all 125, because retrofitting any of them costs more than doing it right once.

1. **Every screen is phone-first.** Not desktop with breakpoints added. `D-10`
2. **Every string goes through the catalogue** the moment it is typed. Never "translate later".
3. **Every API route checks authorisation.** Nothing ships open, including internal-feeling routes.
4. **Every administrative action writes an audit row.** `P2-21`
5. **No new dependency without a reason recorded** in the PR. `D-12`

---

# Build days

## Day 1 · Thu 3 Sep — Clear the decks

**Goal:** the codebase stops carrying dead weight and starts carrying the real curriculum.
Environments exist. Nothing here depends on anything.

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| P1-10 | Delete all quiz code — repo functions, `QuizPanel`, API route, zod schema, CSS | ✅ | [PR #1](https://github.com/goappycodes/ai-lms/pull/1). 317 lines out. Also removed a query from `getCourseTree` |
| P1-12 | Replace `lib/data.ts` with the real 6 / 8 / 10 curriculum | ✅ | [PR #2](https://github.com/goappycodes/ai-lms/pull/2). 16 unique lessons → 96 assets confirmed |
| P1-01 | Write the target schema spec — every table, column, relationship | ✅ | [PR #3](https://github.com/goappycodes/ai-lms/pull/3) · [SCHEMA.md](./SCHEMA.md). 19 tables + 1 view. **Needs review before P1-02** |
| P0-06 | Stand up the staging / demo deployment | ✅ | https://ai-lms-xi.vercel.app · verified live. **DB not connected — see blockers** |
| P0-08 | Point a custom domain at the R2 bucket | ⬜ | Deferred by owner. Needs a domain on Cloudflare DNS. Only code change is `R2_PUBLIC_URL`; schema now stores keys not URLs ([PR #5](https://github.com/goappycodes/ai-lms/pull/5)) |
| P0-07 | Create the Sentry and Firebase projects, collect keys | ✅ | Sentry `the-starks/ai-veda-lms` (EU region) · Firebase `ai-veda-lms`. **Still to do: set the same vars in Vercel, and rotate the auth token** |
| P6-01 | Wire Sentry, client and server | ✅ | [PR #6](https://github.com/goappycodes/ai-lms/pull/6). Errors only, no Replay. +31.7 kB after tree-shaking tracing |
| P0-09 | Agree branch, PR and environment workflow | ⬜ | Matters more with several people and no slack |
| P0-01 | ✅ `Q1` answered — separate video per language | ✅ | Content production is unblocked |
| P0-02 | ✅ `Q2` answered — video URLs must be protected | ✅ | Adds `P6-13`…`P6-16` |
| P0-03 | ✅ `Q6` answered — no offline download | ✅ | Stays out of scope |
| P0-04 | **Chase:** confirm engineering headcount | ⬜ | If it is one person, start the descope ladder now |
| P0-05 | **Chase:** confirm content owner and the 96-asset delivery date | ⬜ | The likeliest thing to sink the date |
| P6-13 | Design the signed video access scheme | ⬜ | `D-17`. Must not break CDN caching — decide the shape today |

**End of day:** ________________________________________________

---

## Day 2 · Fri 4 Sep — Write the migrations

**Goal:** the whole new schema exists as reviewed migration files. One migration, before any
content is loaded — doing it later means data migration instead of schema definition.

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| P1-02 | Auth tables — `users`, `sessions`, `password_resets`, `audit_log` | ⬜ | One `users` table with a role — `D-14` |
| P1-03 | Org tables — `schools`, `classes`, `class_teachers`, `enrolments` | ⬜ | School row joins to its `role = school` user |
| P1-04 | `videos` + `documents` with `kind`, `locale` and `storage_key` | ⬜ | Brief §3 · [SCHEMA.md](./SCHEMA.md). Keys not URLs — [PR #5](https://github.com/goappycodes/ai-lms/pull/5) |
| P1-05 | Let a lesson belong to more than one course | ⬜ | Builder ↔ Achiever share 8 sessions — `D-01` |
| P1-06 | `lesson_progress` — position, furthest, completed_at, completed_via | ⬜ | `D-07` |
| P1-07 | `certificates_issued` with a verification id | ⬜ | Separate from the template table |
| P1-08 | `encode_jobs` table | ⬜ | Retires the in-memory `Set` — `D-06` |
| P1-09 | Drop `quizzes` and `quiz_questions` | ⬜ | `D-02` |
| P6-05 | Make VOD playlists immutable | ⬜ | One line. Saves a round trip on every single play |

**End of day:** ________________________________________________

---

## Day 3 · Sat 5 Sep — Schema live on staging 🏁

**Goal:** the new schema is running on staging with the real curriculum seeded into it.

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| P1-11 | Rewrite `lib/db/repo.ts` against the new schema | ⬜ | Keep the batched `getCourseTree` approach |
| P1-13 | Update `/api/seed` for the new curriculum and shared lessons | ⬜ | Must stay idempotent |
| P1-14 | Update `db-setup.mjs` and `db-verify.mjs` | ⬜ | — |
| P1-15 | **Run the migration on staging and verify** | ⬜ | 🏁 Milestone. DB reachable from local; Vercel vars pending |
| P6-04 | Put Cloudflare's CDN in front of R2 via the custom domain | ⬜ | Depends on `P0-08`. Enable Smart Tiered Cache — the classroom multiplier |
| P6-14 | Cloudflare Worker in front of the bucket, validating access | ⬜ | `D-17`. Bucket stops being public |
| P2-01 | Password hashing helpers | ⬜ | First new dependency — record why |

**End of day:** ________________________________________________

---

## Day 4 · Sun 6 Sep — Authentication core

**Goal:** the server knows who is asking, and refuses everyone else. No UI yet.

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| P2-02 | User creation, lookup and the role model | ⬜ | super admin · school · teacher · student |
| P2-03 | Session handling — create, verify, destroy | ⬜ | Cookie-based, httpOnly, secure |
| P2-04 | Route middleware protecting every page by role | ⬜ | Deny by default |
| P2-05 | Authorisation guards on every API route | ⬜ | Including the content routes, all wide open today |
| P2-22 | Rate limiting on login attempts | ⬜ | Student passwords will be weak and shared |

**End of day:** ________________________________________________

---

## Day 5 · Mon 7 Sep — Login and the demo panel 🏁

**Goal:** all six demo accounts sign in and land in the right place. The team stops needing
fixture data to test anything.

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| P2-06 | Real login page — username + password, phone-first | ⬜ | Replaces the current fake form |
| P2-07 | **Demo login panel — six one-click accounts** | ⬜ | `D-16`. Super Admin · School · Teacher · Student 1/2/3 |
| P2-08 | Seed the demo school, class and six accounts | ⬜ | Students 1/2/3 → Explorer / Builder / Achiever |
| P2-09 | Logout and session expiry | ⬜ | 🏁 Milestone: login works, roles enforced |

**End of day:** ________________________________________________

---

## Day 6 · Tue 8 Sep — Schools, teachers, classes

**Goal:** a super admin can create a school that logs in, and that school can build its own
staff and classes.

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| P2-10 | Schools list and CRUD | ⬜ | — |
| P2-11 | Creating a school provisions its login | ⬜ | One form, both records — `D-14` |
| P2-12 | Teachers CRUD — super admin and school | ⬜ | — |
| P2-13 | Classes CRUD and teacher assignment | ⬜ | — |
| P2-14 | Students — manual single add | ⬜ | Bulk import lands Day 12 |
| P2-15 | Enrolment: class level maps to course | ⬜ | 5–7 Explorer · 8–10 Builder · 11–12 Achiever |

**End of day:** ________________________________________________

---

## Day 7 · Wed 9 Sep — Password chain, audit, bilingual groundwork

**Goal:** the reset ladder works end to end, and the i18n foundation exists **before** the
screens that will need it.

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| P2-16 | Teacher resets their own students | ⬜ | `D-04` |
| P2-17 | School resets teachers and its students | ⬜ | `D-04` |
| P2-18 | Super admin resets schools and anyone below | ⬜ | `D-04` |
| P2-19 | Super admin self-recovery by email verification | ⬜ | Only account in the chain with an email |
| P2-20 | Temporary password shown once, on screen | ⬜ | For reading aloud to a student |
| P2-21 | Audit rows on every reset and admin action | ⬜ | Names the person who acted |
| P3-01 | i18n scaffolding — locale routing and string catalogue | ⬜ | **Do this before writing new screens** |
| P3-04 | Load a Malayalam webfont and add the ML subset | ⬜ | Named in CSS today but never actually loaded |

**End of day:** ________________________________________________

---

## Day 8 · Thu 10 Sep — Students read real data

**Goal:** the two-curricula split ends. Authored content finally reaches a student page.

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| P3-06 | `/learning` reads courses from the database | ⬜ | The blocking defect, closed |
| P3-07 | Course resume redirect reads real progress | ⬜ | — |
| P3-08 | Lesson page reads from the database | ⬜ | — |
| P3-09 | Caching — drop `force-dynamic`, revalidate on publish | ⬜ | `D-13`. The explicit instruction from `Q4` |
| P6-17 | Query audit — count database calls per page, remove repeats | ⬜ | Verify the caching rather than assume it |
| P3-16 | Real worksheet and handout links, per locale | ⬜ | Two dead `#` links today |
| P3-02 | Extract every English string into the catalogue | ⬜ | — |
| P3-05 | Language toggle wired to real locale, persisted per user | ⬜ | Decorative state today |

**End of day:** ________________________________________________

---

## Day 9 · Fri 11 Sep — The real player 🏁

**Goal:** a student presses play and a real video streams from R2, capped sensibly for their
phone and their data plan.

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| P3-10 | **Port the hls.js player from the PoC into `VideoStage`** | ⬜ | The placeholder never loads video today |
| P3-11 | Cap quality to screen size, poster frame, error states | ⬜ | `D-11` — protects the student's data plan |
| P3-13 | Language variant selection in the player | ⬜ | Separate video per locale, per `Q1` |
| P6-15 | Token issuance endpoint + player fetches before play, refreshes silently | ⬜ | `D-17`. A long pause must not resume into 403s |
| P6-02 | Define the Firebase event taxonomy and wire it | ⬜ | `D-09` — behaviour only, never progress reporting |
| P6-03 | Playback quality telemetry from the player | ⬜ | 🏁 The PoC already measures all of this |

**End of day:** ________________________________________________

---

## Day 10 · Sat 12 Sep — Progress and resume 🏁

**Goal:** watching is remembered. Completion works both ways, and both are distinguishable.

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| P4-01 | Finalise the progress data shape | ⬜ | `D-07` |
| P4-02 | Heartbeat endpoint — single-row upsert | ⬜ | — |
| P4-03 | Client batching — every 2 min, on pause, on close | ⬜ | `D-13`. Use `sendBeacon` for the close case |
| P4-04 | Auto-complete at 90% watched | ⬜ | — |
| P4-05 | Manual "mark complete" toggle | ⬜ | Records `completed_via = manual` |
| P4-06 | Rewatching never resets completion | ⬜ | — |
| P4-07 | Course percentage calculation, cached | ⬜ | Read on every course card |
| P3-12 | Player resumes from the saved position | ⬜ | 🏁 Milestone: progress and resume working |

**End of day:** ________________________________________________

---

## Day 11 · Sun 13 Sep — Teacher views and the content console

**Goal:** teachers can see their class, and the studio can show which of the 96 assets are
still missing — before content starts arriving.

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| P5-01 | Teacher: class roster, % complete, last active | ⬜ | `D-08` |
| P5-02 | Teacher: per-lesson view — finished, stalled, not started | ⬜ | Stalled is the genuinely useful signal |
| P5-03 | Teacher: individual student detail | ⬜ | Shows watched-through vs ticked — `D-07` |
| P5-12 | Studio: asset slot grid — video, worksheet, handout × EN/ML | ⬜ | Replaces the untyped PDF list |
| P5-13 | Studio: per-lesson completeness and course filled/total | ⬜ | What makes 96 assets manageable |
| P3-14 | Phone-first rebuild — lesson page, curriculum as a sheet | ⬜ | Not a squeezed sidebar |
| P3-15 | Phone-first rebuild — My Learning and course cards | ⬜ | — |
| P3-17 | Empty and error states for missing assets | ⬜ | A lesson without its ML video must degrade well |
| P3-18 | Course card progress from real data | ⬜ | — |

**End of day:** ________________________________________________

---

## Day 12 · Mon 14 Sep — Certificates, dashboards, import · feature freeze 🏁

**Goal:** the last features land and content starts loading. Nothing new after today.

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| P4-08 | Certificate eligibility rule | ⬜ | Confirm: does a manual tick count toward it? |
| P4-09 | Issue certificate records with a verification id | ⬜ | — |
| P4-10 | Certificate page from real data, EN and ML | ⬜ | — |
| P4-11 | Certificate PDF generation and download | ⬜ | `href="#"` today. Descope candidate #4 |
| P4-12 | Certificate layout on a phone | ⬜ | Landscape certificate, portrait screen |
| P5-04 | School: whole-school progress | ⬜ | — |
| P5-05 | School: manage its teachers and classes | ⬜ | — |
| P5-06 | Super admin: platform analytics | ⬜ | Replaces hardcoded numbers in the JSX |
| P5-07 | Spreadsheet parser and downloadable template | ⬜ | New dependency — record why |
| P5-08 | Import: upload, parse, validate the school column | ⬜ | `D-15`. Unknown school → row rejected |
| P5-09 | Import: preview — matched, rejected, reasons | ⬜ | **Nothing written before confirmation** |
| P5-10 | Import: commit and result summary | ⬜ | — |
| P5-11 | Import: role scoping | ⬜ | Super admin picks a school · school itself · teacher own class |
| P5-14 | Studio: encode job status and retry for stranded encodes | ⬜ | Uses `encode_jobs` |
| P6-06 | **Content load — 96 assets uploaded and encoded** | ⬜ | 🏁 Depends entirely on `C-07` |

**End of day:** ________________________________________________

---

## Day 13 · Tue 15 Sep — Harden, verify, launch 🏁

**Goal:** live.

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| P3-03 | Malayalam catalogue populated | ⬜ | Fed by `C-06` |
| P5-15 | Phone-first pass over teacher and school screens | ⬜ | — |
| P6-07 | Content QA — every lesson has all six slots filled | ⬜ | Uses `P5-13` |
| P6-16 | Verify CDN still caches with access control in place | ⬜ | `D-17`. Thirty students in a classroom must share one cached copy |
| P6-08 | Load test at 500 concurrent | ⬜ | Verification, not design |
| P6-09 | **Security pass — authorisation on every route, demo panel OFF in production** | ⬜ | `D-16`. A one-click super admin in prod is a full takeover |
| P6-10 | Error and empty state sweep | ⬜ | — |
| P6-11 | Accessibility basics — focus, labels, contrast | ⬜ | — |
| P6-12 | Production configuration and deploy runbook | ⬜ | 🏁 **LIVE** |

**End of day:** ________________________________________________

---

# Test days

## Day 14 · Wed 16 Sep — Devices and networks

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| P7-01 | Build the QA matrix — 4 roles × screens × 2 languages | ⬜ | — |
| P7-02 | Device testing — low-end Android, iOS Safari | ⬜ | iOS uses native HLS, a different code path |
| P7-03 | Network testing — 3G and 0.6 Mbps behaviour | ⬜ | The PoC's throttle harness already does this |

**End of day:** ________________________________________________

## Day 15 · Thu 17 Sep — Language, permissions, import edges

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| P7-04 | Bilingual QA — every screen in Malayalam | ⬜ | Watch for overflow; ML runs longer than EN |
| P7-05 | Permission testing — negative cases per role | ⬜ | Try to reach what you should not |
| P7-06 | Roster import edge cases | ⬜ | Bad schools, duplicates, wrong columns, empty file |

**End of day:** ________________________________________________

## Day 16 · Fri 18 Sep — Fix cycle 1

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| P7-07 | Bug fix cycle 1 | ⬜ | Triage everything from Days 14–15 |

**End of day:** ________________________________________________

## Day 17 · Sat 19 Sep — Fix cycle 2 and real users

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| P7-08 | Bug fix cycle 2 | ⬜ | — |
| P7-09 | Pilot school user acceptance testing | ⬜ | Real teachers, real students, real phones |

**End of day:** ________________________________________________

## Day 18 · Sun 20 Sep — Sign-off 🏁

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| P7-10 | Go / no-go review | ⬜ | 🏁 Signed off |

**End of day:** ________________________________________________

---

# Content production — parallel track

Not engineering, but the platform cannot launch without it, and it is the likeliest thing to
slip. `C-07` is a hard gate on the 15th.

| ID | Task | Due | Status | Notes |
| --- | --- | --- | --- | --- |
| C-01 | Lock the Malayalam production method | Day 1 · Sep 3 | ⬜ | `Q1`. Blocks recording, not code |
| C-02 | Record and edit 16 English videos | Day 8 · Sep 10 | ⬜ | 6 Explorer + 8 Builder + 2 Achiever-only |
| C-03 | Produce 16 Malayalam videos | Day 10 · Sep 12 | ⬜ | Shape depends on `C-01` |
| C-04 | Worksheets — 16 lessons × 2 languages | Day 9 · Sep 11 | ⬜ | 32 PDFs |
| C-05 | Handouts — 16 lessons × 2 languages | Day 9 · Sep 11 | ⬜ | 32 PDFs |
| C-06 | Translate all UI strings to Malayalam | Day 8 · Sep 10 | ⬜ | Feeds `P3-03` |
| C-07 | **Hand everything over for upload** | Day 11 · Sep 13 | ⬜ | 🏁 Hard gate on the 15 Sep date |

---

## Blocker register

Add a row the moment something stops. Empty is good; stale is not.

| Date | Task | Blocker | Owner | Needed by | Cleared |
| --- | --- | --- | --- | --- | --- |
| Sep 3 | P0-07 | Sentry auth token was pasted into a chat transcript — rotate it and update Vercel | | Sep 4 | ⬜ |
| Sep 3 | P1-15 | ~~Staging cannot reach Supabase~~ — root cause was a stale project ref. New project `nxvehgwbrnkxeasnmcyg` in **Mumbai** (`ap-south-1`), verified from local: 52 ms median round trip, down from 147 ms in Tokyo. **Vercel env vars still need updating (port 6543)** | | Sep 5 | 🟨 |

---

## If we fall behind

Cut in this order — least damage first. Agree it now, not at midnight on Day 12.

| Order | What goes | Tasks | Cost |
| --- | --- | --- | --- |
| 1 | Admin analytics dashboard | `P5-06` | Firebase covers the numbers meanwhile |
| 2 | Excel roster import | `P5-07`…`P5-11` | Accounts made by hand — an afternoon for a few hundred |
| 3 | School-level login | `P2-11`, `P5-04`, `P5-05` | Super admin provisions every school. Fine for a pilot, not past it |
| 4 | Certificate PDF | `P4-11` | Certificate shown as a web page instead |
| 5 | Malayalam content | `C-03`…`C-06`, `P3-03` | Launch English-only, load ML as it lands. Most damaging — and the only lever that really moves the date |

Nothing above line 5 touches the student's core journey. That is deliberate: the student and
school experience is what is being judged, so it is the last thing compromised.

---

_AI Veda LMS · Day-by-day plan v3 · 125 tasks · Day 1 = Thu 3 Sep 2026_
