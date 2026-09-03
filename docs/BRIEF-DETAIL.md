# AI Veda — Build Brief (full detail)

**Team reference. The two-page version for sign-off is [AI-VEDA-BUILD-BRIEF.md](./AI-VEDA-BUILD-BRIEF.md).**

**Detail** · 2 September 2026 · Repo `ai-lms` · Build brief v1

A bilingual video LMS delivering AI-literacy courses to government school students in
Kerala, across three courses keyed to class level. Mobile first.

**Deadline: fully live and tested platform by 15 September. Testing and revision 15–20 September.**

> **What I need from you:** confirm or correct the decision register in §4 — items are
> All seven questions are now answered and folded in. The decision register runs `D-01` to
> `D-17`; `D-17` is new and came out of the answer to Q2.

---

## 1. What we are building

Students log in on their own phones, watch a sequence of ~30-minute video lessons for their
class level, download a worksheet and a handout for each, tick lessons off as they go, and
receive a certificate on completion. Teachers manage their class roster and watch progress
across it. Each school signs in to manage its own teachers and students. A super admin owns
all content and sees platform-wide numbers.

Everything — interface and course content — exists in **English and Malayalam**. The
reference experience is Udemy or Coursera stripped to essentials. There is no novel
interaction design here, by intent.

### The three courses

| Course       | Audience      | Sessions | Notes                                               |
| ------------ | ------------- | -------: | --------------------------------------------------- |
| **Explorer** | Classes 5–7   |        6 | Wonder and play                                     |
| **Builder**  | Classes 8–10  |        8 | Board prep, stream choice                           |
| **Achiever** | Classes 11–12 |       10 | Builder's 8 _plus_ Build an App No Code + AI Agents |

Because eight sessions are shared between Builder and Achiever, there are **16 unique
lessons**, not 24. That distinction drives the content model in §3 and halves video
production.

---

## 2. Roles — who can do what

Four kinds of account. **Every one of them signs in with a username and password** — there is
no self-signup anywhere in the product, and no email is ever sent to a student.

A **school is itself an account that logs in**, not just a record. When a super admin adds a
school they are creating a login: the school signs in and manages its own teachers, students
and progress.

| Capability                              | Super admin | School | Teacher | Student |
| --------------------------------------- | :---------: | :----: | :-----: | :-----: |
| Create courses, upload video & PDFs      |      ✓      |   —    |    —    |    —    |
| Add schools                              |      ✓      |   —    |    —    |    —    |
| Add teachers                             |      ✓      |   ✓    |    —    |    —    |
| Import students from Excel               |      ✓      |   ✓    |    ✓    |    —    |
| Reset a student password                 |      ✓      |   ✓    |    ✓    |    —    |
| Reset a teacher password                 |      ✓      |   ✓    |    —    |    —    |
| Reset a school password                  |      ✓      |   —    |    —    |    —    |
| View progress — own class                |      ✓      |   ✓    |    ✓    |    —    |
| View progress — whole school             |      ✓      |   ✓    |    —    |    —    |
| Platform analytics                       |      ✓      |   —    |    —    |    —    |
| Watch lessons, download worksheets       |      ✓      |   ✓    |    ✓    |    ✓    |

### Forgotten passwords

Nobody resets their own password except the super admin. Each level is reset by the level
above it, which is what makes a password system workable for students who have no email:

```
student  →  asks their teacher       →  teacher resets it
teacher  →  asks their school        →  school resets it
school   →  asks the super admin     →  super admin resets it
super admin                          →  email verification link
```

The super admin is the only account with a real email address in the chain, and therefore the
only one who can recover without another human. Higher levels keep the ability to reset
anything below them as a support escape hatch — a super admin can reset a student directly
when a school is unreachable — but the chain above is the normal path. Every reset writes an
audit row naming who performed it.

## 3. Content model

The super admin picks an existing course or creates one, then walks its lessons filling three
slots per lesson, in both languages:

| Slot          | English  | Malayalam | Stored as                   |
| ------------- | -------- | --------- | --------------------------- |
| **Video**     | required | required  | HLS ladder on Cloudflare R2 |
| **Worksheet** | required | required  | PDF on R2                   |
| **Handout**   | required | required  | PDF on R2                   |

That is **16 lessons × 6 assets ≈ 96 files** to produce and track. At that volume the admin
console's real job is showing what is still missing, so every lesson carries a completeness
state and every course a filled/total count.

Video and PDF assets are **referenced** by lessons rather than owned by them, so the eight
sessions shared between Builder and Achiever point at one encode instead of two. Each course
still keeps its own ordering, its own progress and its own certificate.

---

## 4. Decision register

Settled unless you say otherwise. Reply against the item number.

**D-01 · Course shape is 6 / 8 / 10, not 16 × 3**
The repo currently hard-codes three 16-session tracks from an old spreadsheet. That is
replaced by the shorter session tables, with Achiever sharing Builder's eight.

**D-02 · No quizzes**
Descoped entirely. The repo carries a complete working quiz implementation — two tables, an
authoring panel, an API route — that no student screen references. It gets deleted during the
schema rework.

**D-03 · Every student gets an individual account, including classes 5–7**
Teacher-provisioned, username-based, no email. Progress and certificates are per student
across all three courses.

**D-04 · Password reset runs one step up the chain**
Student → teacher. Teacher → school. School → super admin. The super admin recovers by email
verification, being the only account in the chain with a real email address. Higher levels
retain override for support cases. Every reset is audited. See §2 for the full chain.

**D-05 · Video is delivered as self-encoded HLS from Cloudflare R2**
Chosen against Cloudflare Stream, MUX and S3 + CloudFront in a measured bake-off. R2 has zero
egress fees, so delivery cost does not grow with student count. The same catalogue on
CloudFront would cost roughly $680–880 per 1,000 full view-throughs.
_Working today:_ ffmpeg encodes a 1080p→240p ladder in 4-second segments, uploads to R2, and
writes the playlist URL to the database.

**D-06 · Encoding runs on an admin machine, not on the web host**
Serverless hosts have no ffmpeg, a read-only disk and short timeouts. An admin runs the full
app locally, uploads there, and the encode publishes to R2 and writes back to the shared
database — the live site picks it up with no redeploy.
_Change inside this decision:_ encode jobs move from an in-memory set to a database table, so
an interrupted encode is recoverable instead of stranding a lesson.

**D-07 · Both: watch position is tracked, and students can tick complete manually**
Two independent things are recorded, and neither replaces the other.

- _Watch position_ — the player sends a heartbeat carrying current position and furthest
  position reached, so we always know how much of a video a student has actually seen, and
  they can resume where they left off.
- _Completion_ — a lesson can be completed **either** automatically at 90% watched **or** by
  the student ticking it manually at any point. We store when it was completed and which of
  the two did it. Rewatching is always allowed and never resets completion.

Recording _how_ a lesson was completed is what keeps the teacher view honest: a student who
ticked a lesson at two minutes in and a student who watched it through both show as complete,
but the teacher can see the difference — see D-08.

**D-08 · Teachers see per-student and per-lesson progress**
A teacher opens their class and sees the roster with each student's percentage complete and
last-active date, plus a per-lesson view showing how many of the class have finished each
video and who has not started. Students who have stalled mid-video are visible as such, not
just as "incomplete" — and a lesson marked complete shows whether it was watched through or
ticked manually, so a teacher can tell genuine progress from a student clicking ahead.

**D-09 · Two analytics systems, deliberately**
Postgres is authoritative for anything a decision depends on — progress, completions,
certificates, teacher and admin dashboards. Firebase carries behavioural events and playback
quality telemetry. Sentry catches errors. We do not report progress numbers out of Firebase,
because it samples and lags.

**D-10 · Mobile is the primary target; desktop is secondary**
The existing screens are desktop-first — a fixed 384px sidebar and a two-column player with
breakpoints bolted on. Student and teacher screens get built phone-first rather than patched;
on a phone the lesson list becomes a sheet, not a squeezed column.

**D-11 · Optimise for the student's data plan, not the hosting bill**
Storage for the whole bilingual catalogue is about $3 a month, and R2 egress is free — so
hosting cost is not the constraint. One student watching a full course at 720p pulls several
GB of their own prepaid data. We cap quality to screen size on phones, put a CDN in front of
R2 so a classroom shares cached segments, and serve immutable playlists so a replay costs no
extra round trips.

**D-12 · Stack stays as-is**
Next.js 14 App Router with TypeScript, Postgres on Supabase, Cloudflare R2, Vercel. Six
runtime dependencies today. No UI framework, no ORM, no state library is being introduced —
the brief is explicitly "no new innovation".

**D-13 · Cache aggressively; batch progress writes**
_Q4 answered: assume 500 concurrent, with heavy caching to minimise repeated database calls._
At 500 concurrent the database is never the bottleneck — provided we stop asking it the same
question over and over, which the code does today.

- **Nothing is queried twice for the same request.** Every route is currently marked
  `force-dynamic` and hits Postgres on every page load. Course structure changes weekly at
  most, so the lesson tree is cached and revalidated on publish.
- **A page load should issue a countable, small number of queries.** We verify this rather
  than assume it — `P6-17`.
- **Writes are batched.** The player holds progress locally and flushes every two minutes, on
  pause, and on page close, rather than every thirty seconds. Each flush is a single-row
  upsert. Completions are written immediately and separately, because losing a heartbeat is
  acceptable and losing a completion is not.

No queue and no new infrastructure at this scale — but the write path is shaped so one can be
added later without rework.

**D-14 · A school is a login account**
The school signs in with its own username and password and manages its teachers, students and
progress directly. There is no separate "school admin" person sitting beside the school
record — the school _is_ the account, which is how you described it and how it will behave.

_Implementation note, invisible to users:_ every account in the system is one row in one table
with a role, so a school login is that row with `role = school`, joined to the school's
organisational details (name, district, code). This keeps a single sign-in mechanism for all
four roles rather than a special case, and leaves room to attach a second login to a school
later if one ever asks for it.

**D-15 · Roster import validates the school column and rejects rows it cannot match**
Students are added by uploading a spreadsheet. Who can do it and what happens to the school
column differs by role:

- **Super admin** — selects the target school first, then uploads. Rows naming a different
  school are rejected.
- **School** — uploads for itself. Rows naming any other school are rejected.
- **Teacher** — uploads for their own class.

The file carries a school name per student. **If the school is not already in the system, the
row is not imported** — the import never creates a school as a side effect, because a typo in
a spreadsheet would otherwise quietly produce a duplicate school with one student in it.

Every import goes through a preview before anything is written: matched rows, rejected rows,
and the reason for each rejection, with a count. Nothing is committed until that preview is
confirmed. This matters more than it sounds — a botched roster import is the failure most
likely to need manual database cleanup at three in the morning.

**D-16 · The login page carries a demo panel with six one-click accounts**
Alongside the normal username and password form, a second panel offers one-click sign-in as
**Super Admin, School, Teacher, Student 1, Student 2, Student 3** — the three students being
enrolled in Explorer, Builder and Achiever respectively, so every course can be reached
without setting up data. This makes demos and testing fast and gives the whole team a
consistent set of accounts to work against.

_Safeguard, and it is not optional:_ the panel is behind an environment flag that is **off by
default**. A one-click super admin button on a public production site is a complete takeover
of the platform — every school, every student record — for anyone who finds the page. It is
enabled on the demo and staging deployments only, and the six demo accounts are seeded into a
demo school so no real school's data is ever reachable through them.

**D-17 · Video is access-controlled at the edge by a Cloudflare Worker**
_Q2 answered: yes, protect it._ The bucket stops being publicly readable. A Worker sits in
front of it and refuses anything without valid, short-lived credentials.

The design has to protect the content **without destroying the CDN caching that makes delivery
free**, so authorisation is checked at the edge while the cached object stays keyed on the
path alone:

- When a signed-in student opens a lesson, the app issues a short-lived token scoped to that
  one video's path and sets it as a cookie for that path.
- The Worker validates the cookie and serves the segment from cache. The cache key is the
  path, not the token, so thirty students in a classroom still share one cached copy.
- Tokens expire in hours, not minutes, and the player refreshes silently — otherwise a long
  pause resumes into a wall of 403s.
- Playlists and segments both sit behind it. Protecting only the playlist is pointless when
  segment URLs are predictable.

_Cost:_ real work in a tight window — a Worker, a token endpoint, player integration and cache
verification. Tracked as `P6-13` to `P6-16`.

---

## 5. Scope

**In**

- Bilingual interface and content (EN / ML)
- Four roles with the permissions in §2
- Excel roster import with a validated preview (super admin, school, teacher)
- Demo login panel: six one-click accounts, environment-gated
- Video playback with adaptive quality and resume
- Worksheet + handout download per lesson
- Per-student progress, rewatch, completion
- Teacher progress dashboards
- Certificate of completion, downloadable
- Admin analytics: visits, plays, completions
- Error monitoring and event logging

**Out**

- Quizzes and assessment of any kind
- Discussion forums, comments, messaging
- Live classes or scheduling
- Native mobile apps — responsive web only
- Payments or subscriptions
- Offline download of videos _(see Q6)_
- AI features inside the product itself
- Student-authored content or uploads

---

## 6. Where the code actually is

Being direct about this, because it determines whether the deadline is real. The authoring
backend works. The student-facing product is a visual scaffold.

| Area                       | State            | Detail                                                                                                                             |
| -------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Content authoring console  | **Working**      | Courses, chapters, lessons, uploads, publish toggle, validated API                                                                 |
| Video encode → R2 pipeline | **Working**      | Five-rung ladder, progress reporting, cache headers                                                                                |
| Database + schema          | **Content only** | Eight tables, all about the catalogue                                                                                              |
| Video player               | **Placeholder**  | A play button and an animation; never loads a video. The real player exists in the proof-of-concept repo and needs porting across. |
| Student screens            | **Mock**         | Read a hard-coded file, not the database. Authored content is invisible to students today.                                         |
| Login and permissions      | **None**         | No users table, no sessions, no authorisation. Every route is publicly reachable.                                                  |
| Bilingual support          | **None**         | Language toggles are decorative. No string catalogue, no locale on any content row.                                                |
| Teacher / admin dashboards | **Mock**         | Every number on those pages is a literal typed into the markup                                                                     |

### The one blocking defect

There are two parallel copies of the curriculum. A hard-coded file drives every student,
teacher and certificate screen; the database drives only the admin console. An admin can
author a lesson, upload and encode a video, publish it — **and no student page will ever show
it.**

Pointing the student screens at the database is the change that turns this from a demo into a
product, and most of the work below depends on it landing first.

---

## 7. Build order

Sequenced by dependency, not by visibility. Each phase leaves the app working.

1. **Schema rework** — assets referenced by lessons with kind and locale; quiz tables dropped;
   encode jobs made durable. One migration, before any content is loaded.
2. **Identity and organisation** — users, roles, schools, classes, enrolments, sessions, the
   reset chain, and authorisation on every route. Nothing student-facing can be real before this.
3. **Student read path and real player** — student screens read the database with caching; the
   proof-of-concept player is ported in and bound to real video, capped to screen size.
4. **Progress, resume, certificates** — heartbeat writes, completion rules, rewatch, and
   certificate issuance with a verifiable id.
5. **Teacher and admin dashboards, roster import** — real numbers replacing the literals,
   per-class progress views, Excel import with a preview step before anything is written.
6. **Instrumentation and hardening** — Firebase events, Sentry, CDN in front of R2,
   cache-header fixes, load check against the concurrency assumption in Q4.

**Bilingual support and mobile layout are not phases.** With a 15 September deadline they
cannot be a pass at the end — you cannot rebuild every layout after launch. Both are built
into phases 2–5 as they go: every screen is written phone-first the first time, and every
string goes through the catalogue from the moment it is typed. This is a change from how I
would sequence it without a deadline, and it is the single most important scheduling decision
in this brief.

---

## 8. Timeline — and an honest read of it

**Target: live and tested 15 September. Testing and revision 15–20 September.**
That is **13 working days** from today for a product that currently has no login, no working
video player, no student data path, and no bilingual support.

### Schedule

| Dates         | Work                                                                      | Depends on                  |
| ------------- | ------------------------------------------------------------------------- | --------------------------- |
| **Sep 2–4**   | Schema rework, quiz removal, durable encode jobs                          | Q1 answered by Sep 3        |
| **Sep 4–7**   | Identity, roles, schools, classes, reset chain, route authorisation       | —                           |
| **Sep 6–9**   | Student read path, real HLS player, phone-first layouts, i18n scaffolding | Phases above                |
| **Sep 9–11**  | Progress heartbeat, resume, completion rules, certificates                | Player landed               |
| **Sep 11–13** | Teacher dashboards, admin analytics, Excel roster import                  | Progress landed             |
| **Sep 13–15** | Content load (96 assets), Sentry + Firebase, CDN, cache fixes, load check | **Content ready by Sep 13** |
| **Sep 15**    | **Live**                                                                  | —                           |
| **Sep 15–20** | Testing, bug fixes, revision                                              | —                           |

Running in parallel, not by the engineering team: **content production, Sep 2–13.**

### What has to be true for 15 September to hold

1. **Two to three engineers on this full time.** One engineer does not build authentication, a
   player, progress tracking, dashboards, roster import, bilingual support and a mobile
   rebuild in thirteen days. If it is one engineer, the date is not achievable and we should
   pick from the descope ladder below now rather than on 14 September.
2. **Q1 is answered within a day.** Whether Malayalam is a separate video or a second audio
   track determines what the production team records. Every day that decision waits is a day
   removed from a 13-day content window, and content — not code — is most likely the binding
   constraint here.
3. **All 96 assets are delivered by 13 September.** The platform can be finished on time and
   still not be launchable if the videos are not recorded, translated and handed over. I have
   no visibility into that track; if it is behind, tell me early, because it changes what we
   build rather than just when we ship.
4. **The rollout is staged.** Q4 clarified 50,000–100,000 as total enrolled, so the load
   picture is comfortable — but going live means opening to a first set of schools and
   widening from there, not switching on every district at once on 15 September.

### Descope ladder

If we fall behind, these come out in this order — least damage first. I would rather agree
this list now than improvise it under pressure.

1. **Admin analytics dashboard** — Firebase covers the numbers in the interim.
2. **Excel roster import** — the super admin bulk-creates pilot accounts by hand; a few
   hundred rows is an afternoon.
3. **School-level login** — a real cut, since Q5 confirmed it ships day one. Falling back
   means the super admin provisions every school's teachers directly: workable for a pilot,
   not past it.
4. **Certificate PDF generation** — show the certificate as a web page, add the PDF after.
5. **Malayalam content** — launch English-only with the ML infrastructure in place, and load
   Malayalam as it arrives. _This is the most damaging item on the list given the partnership,
   which is exactly why it is last — but it is also the largest single block of time, so if
   we are far behind it is the only lever that moves the date._

Note that nothing above the line touches the student experience. That is deliberate: the
student and school journey is the thing being judged, so it is the last thing to be
compromised.

---

## 9. Risks

- **The timeline is the risk.** See §8. Everything else on this list is manageable; the date
  is the thing that makes them matter.
- **Publishing is single-threaded.** Only the person with the encoder machine set up can
  publish video, and a sleeping laptop kills an encode. The durable job table in phase 1
  makes it recoverable; moving it to a server would make it robust — see Q3.
- **The Malayalam decision blocks content production, not code.** The schema absorbs either
  answer, but recordings cannot start until it is made — see Q1.
- **Video URLs are public today.** Anyone with a link can stream without logging in,
  forever — see Q2.
- **Malayalam will not render correctly as things stand.** The stylesheet names a Malayalam
  font it never loads, and both webfonts request the Latin character set only. Cheap to fix,
  easy to miss until the first Malayalam content lands.
- **Every page currently queries the database on every request.** All routes are marked
  `force-dynamic`. Survivable at pilot scale, wasteful at any scale, and the cheapest
  performance win on the list — see D-13.
- **Roster import is the most likely source of messy production data.** A spreadsheet with
  inconsistent school names, duplicate students or a wrong column order is the normal case,
  not the exception. D-15's preview-before-commit exists specifically to keep that out of the
  database.

---

## 10. Questions

### All answered

**Q1 · Malayalam delivery** → **Separate video per language.** A `locale` field on the video
asset distinguishes them. Content production can start.

**Q2 · Video URL protection** → **Yes, protect them.** The bucket is no longer public. See
**D-17** for how this is done without losing the CDN caching that makes delivery free.

**Q3 · Encoder location** → **Admin's machine. No server load.** Confirmed as D-06.

**Q4 · Concurrency** → **Assume 500 concurrent, with aggressive caching to keep repeated
database calls to a minimum.** Comfortable for Postgres. The caching requirement is the real
instruction here and is reflected in D-13: cached reads, revalidation on publish, and a check
that no page issues repeated queries for the same data.

**Q5 · School-level account** → **Yes, from day one, and the school is the account.** See D-14.

**Q6 · Offline download** → **No.** Out of scope. Worksheets and handouts download; video is
stream-only.

**Q7 · Data residency** → **No constraints. Supabase** for all personal data; R2 for course
media per D-05.

### Notes on the answers

**Video delivery was never the concern, and now neither is the database.** Even at the
pessimistic reading, 100,000 concurrent streams at 480p is around 140 Gbps in aggregate —
Cloudflare absorbs that, R2 egress is free, and a synchronised audience is the _best_ case for
a CDN, since everyone requests the same segments at the same moment and the edge cache hit
rate is very high. With Q4 clarified as enrolled rather than concurrent, the write path
relaxes too, and the schedule keeps a day it was about to lose.

**One reading I have assumed.** On who can upload a student roster you wrote "school does too
and student does too". I have read the second as **teacher**, since a student uploading other
students has no place in the permission model. Say the word if you meant something else.

---

_AI Veda LMS · Full detail · D-01…D-17 · All questions answered_
