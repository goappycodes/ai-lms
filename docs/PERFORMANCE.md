# AI Veda — Performance and Caching Plan

**Status: proposed. Nothing here is built yet.** Written after measuring, not guessing —
every number below came from this codebase against the real Mumbai database on 4 September 2026.

Companion to [TASKS.md](./TASKS.md) (`P3-09`, `P6-17`, `P4-07`, `P6-08` are the rows this
fills in) and [BRIEF-DETAIL.md](./BRIEF-DETAIL.md) (`D-13`, the caching decision).

**Sizing, revised 4 Sep:** ~1,00,000 students watching video, and concurrency **above** the 500
this plan was originally sized for. That revision changes the conclusion, not just the numbers:
at this scale the database cannot be on the path for most requests at all, because it has a
hard ceiling that no amount of query tuning moves. See finding 0.

---

## What was measured

Local machine → Supabase `ap-south-1` (Mumbai), production build (`next start`), warmed,
median of six runs.

### 0. The connection ceiling — the thing that actually breaks at scale

Measured by opening client connections until refused.

| Pooler | Port | Simultaneous client connections |
| --- | --- | --- |
| **Session** (`5432`) — what `.env.local` uses today | 5432 | **15** |
| **Transaction** (`6543`) | 6543 | **200**, then `EMAXCONN: max client connections reached, limit: 200` |

All 200 transaction-pooler connections ran a query concurrently in 109 ms, so the pooler itself
copes well. The session pooler holds one real Postgres connection per client, and the server
only has 60.

Two consequences, and they are the most important lines in this document:

**a. The current port is wrong for serverless.** `lib/db/pg.ts` opens up to 8 connections per
instance. Against a 15-connection ceiling that is **two Vercel instances** before the site
starts refusing to connect. Not slow — refusing. This has not bitten yet only because staging
cannot reach the database at all (`P1-15`).

**b. Even done right, the database ceiling is about 200 concurrent queries.** In transaction
mode a connection is held only for the length of a query — about 50 ms — so the ceiling is
roughly **4,000 queries per second**, total, for the whole platform.

> With 1,00,000 students, that is the budget the entire product has to live inside. It cannot
> be raised by making queries faster; a query already costs under a millisecond of database
> time. **The only way to serve this many people is for most requests never to reach the
> database.** That is what makes caching the plan rather than a phase of it.

The saving grace is what those students are mostly *doing*: watching video. Video is served
from R2 through Cloudflare and never touches our origin or our database at all. The page around
the video is the part that must be cached.

### 1. The database is not slow. The distance to it is.

| Query | Median |
| --- | --- |
| `SELECT 1` — a pure round trip, no work | **50.6 ms** |
| `getLiveSession` | 50.5 ms |
| `findUserById` (joins `schools`) | 51.1 ms |
| `getSchoolOverview` — three correlated subqueries | 50.8 ms |
| `listSchools` — three subqueries **per row**, every school | 53.6 ms |

Every one of these costs the same as `SELECT 1`. The SQL executes in **under a millisecond**;
the 51 ms is the network. `listSchools` runs three subqueries for each of forty-odd schools and
is still only 3 ms slower than doing nothing.

> **This single fact decides the whole plan.** Optimising SQL buys nothing. Removing a query
> buys 51 ms. Every fix below is about *how many times we go to the database*, never about how
> fast a query runs.

### 2. Most of the 2–3 seconds is the dev server, not the product

| Page | Dev, first hit | Dev, after | Production build |
| --- | --- | --- | --- |
| `/learning` | **1876 ms** | 346 ms | 318 ms |
| `/school` | **1657 ms** | 321 ms | 308 ms |
| `/teacher` | **1266 ms** | 367 ms | 293 ms |
| `/admin` | **1291 ms** | 278 ms | 264 ms |
| `/admin/schools` | **1353 ms** | 356 ms | 340 ms |

`npm run dev` compiles each route the first time it is asked for. That is the 1.3–1.9 seconds,
and it happens **once per route per server start** — it is a development cost that no student
will ever pay. The same pages in a production build are a flat 264–340 ms with no first-hit
penalty at all.

So: the honest headline is that a good part of what feels broken is not in the product. But
264–340 ms of server time before a phone has rendered anything is still too slow for the
audience, and the rest of this document is about that.

### 3. Where the 300 ms goes: round trips, most of them wasted

Counted by instrumenting the connection pool in a production build.

| Page | Queries | Of which avoidable |
| --- | --- | --- |
| `/learning` | 5 | 3 |
| `/school` | **8** | **5** |
| `/teacher` | 6 | 3 |
| `/admin/schools` | 5 | 3 |

Three distinct defects, all of them repeats:

**a. The session and user are fetched four times per page.** Every page calls `requirePage()`,
which calls `getCurrentUser()` — one query for `sessions`, another for `users`. Then `TopNav`
calls `getCurrentUser()` again, independently, for the same request. Two lookups × two queries
= **four round trips, ~204 ms, on every protected page in the product.**

**b. Those two queries are sequential.** `getLiveSession` must finish before `findUserById`
starts, because the second needs the user id from the first. One join answers both.

**c. `getSchoolOverview` runs twice on `/school`** — once in the page for the heading, once
inside `SchoolDashboard`. Introduced when the dashboard was extracted so `/school` and
`/admin/schools/[id]` could share it.

### 4. The deployed site is probably four times worse than these numbers

There is **no `vercel.json`**, so serverless functions run in whatever region the Vercel
dashboard says — by default `iad1`, Washington DC. The database is in Mumbai.

A Washington ↔ Mumbai round trip is roughly 200 ms rather than the 51 ms measured here. At
five to eight queries per page that is **1 to 1.6 seconds of pure network on every page**,
before rendering anything.

This is unverified: staging cannot reach the database at all right now (`P1-15` in the blocker
register), so it could not be measured. **It is the first thing to check, and if true it is the
single largest item in this document — and the cheapest to fix.**

### 5. What is *not* the problem

Worth stating so nobody optimises it:

- **Bundle size.** 120 kB shared, 131–135 kB first load per page. Not small, not the bottleneck.
- **The SQL.** Covered above — execution is sub-millisecond.
- **The number of schools.** `listSchools` scans everything and costs 3 ms over an empty query.

---

## The plan

Ordered by measured impact per unit of risk. Each phase is independently shippable.

### Phase 0 — Survive being deployed at all

Three config-level changes, no product code. This phase is not about speed; without it the
platform falls over at a few dozen concurrent users regardless of how fast the pages are.

**0a. Move to the transaction pooler (port 6543).** 15 connections → 200. Safe here because
nothing relies on session state outside a transaction: the one place that does,
`createSchoolWithLogin`'s deferred-constraint dance, is inside `BEGIN`/`COMMIT`, which
transaction mode preserves. Must be verified against every suite, not assumed.

**0b. Size the pool for serverless.** `max: 8` per instance is a desktop setting. Each Vercel
instance serves few concurrent requests, so a small pool per instance and many instances beats
a large pool per instance. Dropping to 2–3 multiplies how many instances fit under the 200
ceiling.

**0c. Pin the region deterministically.** A `vercel.json` with `"regions": ["bom1"]` overrides
whatever the dashboard says, which settles the open question without anyone having to go and
look. If functions are currently in Washington, every round trip is ~200 ms instead of ~51 ms
and every page carries 1–1.6 s of pure network.

| | |
| --- | --- |
| **Expected** | Turns a hard failure at ~2 instances into a 200-connection ceiling, and up to **4×** on every page if the region was wrong. |
| **Risk** | Low, but 0a touches every query in the product and must be proven by the suites. |
| **Blocked by** | Verifying against staging needs `P1-15` fixed. The changes themselves are not blocked. |

### Phase 1 — Stop asking the same question four times

| | |
| --- | --- |
| **Changes** | 1. Wrap `getCurrentUser` in React's `cache()` so one render pass makes one lookup, however many components ask.<br>2. Fold `getLiveSession` + `findUserById` into a single joined query.<br>3. Drop the duplicate `getSchoolOverview` on `/school`. |
| **Expected** | Auth: **4 round trips → 1**. About **150 ms off every protected page**, ~200 ms off `/school`. |
| **Risk** | Low, but not zero — `cache()` must be per-request, never across requests, or one user could be served another's session. This needs a test that proves two concurrent requests get different users. |
| **Tasks** | Fills in `P6-17` (query audit). |

Worth being explicit about what is **not** being cached here: the session check still hits the
database on every request. That is deliberate — it is what makes signing out, disabling an
account and archiving a school take effect immediately, and it was built that way on purpose.
Deduplicating within one render is safe; caching across requests is not.

### Phase 2 — Cache what is genuinely shared (`P3-09`, `D-13`)

Every route is currently `force-dynamic` — nothing is cached anywhere.

The split that matters:

| Kind of page | Cacheable? | Approach |
| --- | --- | --- |
| Course, lesson, video metadata | **Yes, aggressively** | Same for every student in Kerala. Cache at the edge, revalidate on publish. |
| Certificates template, course structure | **Yes** | Changes only when content is published. |
| `/learning`, `/school`, `/teacher`, `/admin/*` | **No shared cache** | Per-user. Getting this wrong shows one student another's progress. |
| Progress writes | n/a | Batched, not per-tick — already decided in `D-13`. |

The prize is the lesson and video pages: thirty students in one classroom opening the same
lesson should produce **one** origin render, not thirty. At 1,00,000 students that stops being
a nicety — with a 4,000 queries/second ceiling for the whole platform, a lesson page that hits
the database once per view puts a hard cap on how many students can be in a lesson at once. A
cached one does not.

This is also where `P6-04` (Cloudflare Smart Tiered Cache) and `P6-16` (verify the CDN still
caches with signed URLs) land, and `P6-16` matters more than its position in the list suggests:
a signing scheme that puts a unique token in the URL path gives every student a cache miss and
turns the CDN into an expensive proxy. The token belongs somewhere the cache key ignores.

For the per-user pages, the honest answer is that they cannot be shared-cached at all, and the
win there comes from Phase 1 and Phase 3 instead. That is acceptable because they are the small
part of the traffic: a student signs in, opens their course, and then watches video for forty
minutes without touching the database again.

**Decision on staleness (open question 2, now settled).** Content is cached indefinitely and
revalidated **on publish**, by tag, with a one-hour TTL as a backstop. A TTL on its own forces
a choice between stale content and constant revalidation; tagging gives an immediate update
when someone publishes a correction, and the hour is there only to catch a revalidation that
was missed.

### Phase 3 — Make the per-user pages feel instant anyway

Since `/learning` and `/teacher` cannot be cached across users:

- **Stream the shell.** The nav, headings and layout do not depend on the database. With
  `loading.tsx` and Suspense the phone gets pixels immediately and the data fills in — this is
  the phase that carries the loaders and skeletons.
- **Prefetch on the link.** App Router prefetches on hover or viewport entry; on a phone that
  means the tap has already started the work.
- **One query per page where possible.** `/teacher/[classId]` currently runs five sequential
  round trips; the class detail and its students can be one.

### Phase 4 — The phone itself

Only after the above, and only if measurement says so:

- Audit the 95 kB middleware bundle — it runs on **every** request including static assets.
- Check what the 120 kB shared chunk actually contains.
- Confirm `next/font` is not blocking first paint on a slow connection.

### Phase 5 — Prove it (`P6-08`)

- Re-measure every number in this document after each phase.
- Load test at the revised sizing, not the old 500. The number to find is not "does a page
  respond" but **how many concurrent page views fit under the 200-connection ceiling** — and
  then how far caching pushes that.
- Test on a real throttled 3G profile, not a desktop on office wifi.

---

## Expected outcome

| | Now (measured) | After Phase 1 | After Phases 0–3 |
| --- | --- | --- | --- |
| Server time, per-user page | 264–340 ms | ~150–200 ms | ~80–120 ms |
| Lesson page under a full classroom | 1 origin render **per student** | — | 1 per lesson, then cached |
| Concurrent connections before refusal | **15** | 15 | **200** |
| Page views/second the database can sustain | ~150 | ~600 | limited by cache hit rate, not the database |

The last row is the one that matters at 1,00,000 students. Phase 1 raises the ceiling by
removing queries; only Phase 2 removes the ceiling, by making most requests never ask.

---

## Decisions taken

The four questions this document opened with, now answered, so the work is not blocked.

**1. What region is Vercel using?** No longer a question anybody has to answer. `vercel.json`
with `"regions": ["bom1"]` overrides the dashboard, so the compute is next to the database
whatever the setting was.

**2. How stale may course content be?** Cached indefinitely, revalidated **on publish** by tag,
with a one-hour TTL as a backstop. Reasoning in Phase 2.

**3. Is 500 concurrent still the number?** No — revised to 1,00,000 students with concurrency
above 500, which is what prompted finding 0. The plan is sized to the connection ceiling rather
than to a concurrency figure, because that ceiling is the real constraint and it is measurable.

**4. Should the session check be cached across requests?** **No.** The measurement is what
settles it rather than caution:

- After Phase 1 a page navigation costs **one** session query, not four.
- The ceiling is ~4,000 queries/second. A student navigating every thirty seconds costs
  0.03 queries/second. Even 1,00,000 students all navigating that briskly is far inside the
  budget — and they will not be, because they are watching video, which touches nothing.
- Against that, caching sessions across requests means a disabled account, a signed-out
  session or an archived school stays alive for the cache window. That property is relied on
  today and covered by 214 tests.

So the cost is real and the saving is negligible. It should be revisited **only** if Phase 5
load testing shows the session query is actually a bottleneck, with numbers rather than
intuition.

---

## What this plan does not cover

Named so they are not mistaken for oversights:

- **Video bandwidth**, which at 1,00,000 students is the largest cost in the product. It is a
  CDN and R2 story, already tracked as `P0-08`, `P6-04`, `P6-13`…`P6-16`, and it never touches
  the database or a serverless function.
- **The encoder**, which stays local by decision `D-16`.
- **Database read replicas.** If the 200-connection ceiling is genuinely reached after caching,
  the next step is a read replica or a connection proxy — not more query tuning. That is a
  bridge to cross with load-test numbers in hand.

---

## Progress

**Phase 0 and Phase 1 are done.** Measured on the same machine, same production build, same
warmed medians as the findings above.

| Page | Round trips | | Server time | |
| --- | --- | --- | --- | --- |
| | before | after | before | after |
| `/learning` | 5 | **2** | 318 ms | **162 ms** |
| `/school` | 8 | **4** | 308 ms | **199 ms** |
| `/teacher` | 6 | **3** | 293 ms | **154 ms** |
| `/admin/schools` | 5 | **2** | 340 ms | **158 ms** |

Connection ceiling: **15 → 200**.

> **One thing must be changed by hand.** `.env.local` is not in git, so the port change is local
> only. **`SUPABASE_DB_PORT` must be set to `6543` in the Vercel project** or the deployment
> keeps the 15-connection ceiling. `npm run db:smoke` fails loudly if it is wrong, but it cannot
> see Vercel's environment.

Phase 2 (caching) is next, and is the one that removes the ceiling rather than raising it.

---

_AI Veda LMS · Performance plan v2 · measured 4 Sep 2026 · resized for 1,00,000 students_
