# AI Veda — Performance and Caching Plan

**Status: proposed. Nothing here is built yet.** Written after measuring, not guessing —
every number below came from this codebase against the real Mumbai database on 4 September 2026.

Companion to [TASKS.md](./TASKS.md) (`P3-09`, `P6-17`, `P4-07`, `P6-08` are the rows this
fills in) and [BRIEF-DETAIL.md](./BRIEF-DETAIL.md) (`D-13`, the caching decision).

---

## What was measured

Local machine → Supabase `ap-south-1` (Mumbai), production build (`next start`), warmed,
median of six runs.

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

### Phase 0 — Put the compute next to the data

| | |
| --- | --- |
| **Change** | Add `vercel.json` pinning functions to `bom1` (Mumbai). Confirm the dashboard region. |
| **Why** | If functions run in Washington, every round trip is ~200 ms instead of ~51 ms. |
| **Expected** | Up to **4× on every page**, if the region is currently wrong. |
| **Risk** | Very low — one config file, no code. |
| **Blocked by** | `P1-15`: staging cannot reach the database, so this cannot be measured until that is fixed. |

Nothing else in this document comes close to this for effort-to-payoff. It should be verified
before any code is written, because if the region is wrong then every later measurement taken
against staging is measuring the wrong thing.

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
lesson should produce **one** origin render, not thirty. That is also where `P6-04` (Cloudflare
Smart Tiered Cache) and `P6-16` (verify the CDN still caches with signed URLs) land.

For the per-user pages, the honest answer is that they cannot be shared-cached at all, and the
win there comes from Phase 1 and Phase 3 instead.

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
- Load test at 500 concurrent, which is the sizing already agreed.
- Test on a real throttled 3G profile, not a desktop on office wifi.

---

## Expected outcome

| | Now (measured) | After Phase 1 | After Phases 0–3 |
| --- | --- | --- | --- |
| Server time, per-user page | 264–340 ms | ~150–200 ms | ~80–120 ms |
| Server time, lesson page | not yet measured | — | near zero when cached |
| Deployed, if region is wrong today | ~1–1.6 s | — | ~100 ms |

---

## Open questions

1. **What region is the Vercel project set to?** Everything in Phase 0 depends on the answer,
   and it cannot be read from the repository.
2. **How stale may course content be?** A one-minute revalidate is far simpler than
   revalidating on publish, and for content that changes a few times a term it may be enough.
3. **Is 500 concurrent still the number?** It sized the database comfortably; it also decides
   how hard Phase 5 needs to push.
4. **Should the session check ever be cached across requests?** Today it is one round trip per
   request, deliberately, so revocation is immediate. A short cache would save ~51 ms per page
   at the cost of a disabled account staying alive for that window. Recommendation: **no** —
   but it should be a decision, not an oversight.

---

_AI Veda LMS · Performance plan v1 · measured 4 Sep 2026 · proposed, not built_
