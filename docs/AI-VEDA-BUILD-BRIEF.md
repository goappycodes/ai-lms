# AI Veda — Build Brief

**For sign-off** · 3 September 2026
**Live 15 September · Tested and signed off 20 September**

A bilingual video LMS for AI literacy in Kerala government schools. Students watch ~30-minute
video lessons on their own phones, download a worksheet and a handout for each, and earn a
certificate. Teachers track their class. Schools manage their teachers. Everything exists in
English and Malayalam. Mobile first.

_Full detail, if you want it: [BRIEF-DETAIL.md](./BRIEF-DETAIL.md) · Day-by-day plan:
[TASKS.md](./TASKS.md)_

---

## The product

| Course | Classes | Sessions |
| --- | --- | ---: |
| Explorer | 5–7 | 6 |
| Builder | 8–10 | 8 |
| Achiever | 11–12 | 10 _(Builder's 8 + 2 advanced)_ |

Eight sessions are shared between Builder and Achiever, so there are **16 unique lessons**,
not 24. Each needs a video, a worksheet and a handout, in both languages — **96 files**.

**Four roles, all signing in with a username and password.** Super admin owns all content. A
school is itself a login and manages its teachers and students. Teachers manage their class
and see its progress. Students watch. No self-signup; no email is ever sent to a student.

**Forgotten passwords go one step up the chain:** student → teacher, teacher → school, school
→ super admin, super admin → email link. Every reset is audited.

**No quizzes.** Progress is tracked two ways: how much of a video was actually watched, and
whether the student marked it complete. Teachers see both, so a lesson ticked at two minutes
in is distinguishable from one watched through.

---

## Where the code is today

Being direct, because it sets the estimate.

- **Works:** the content authoring console, and the video encoding pipeline that produces
  adaptive-quality streams and publishes them to Cloudflare R2.
- **Does not exist:** login, permissions, the video player itself, any student reading real
  data, bilingual support, and every teacher and admin number (they are typed into the page).
- **The blocking defect:** there are two copies of the curriculum. A hard-coded file drives
  every student screen; the database drives only the admin console. An admin can upload and
  publish a video today and **no student will ever see it.** Fixing that is the first real
  milestone.

---

## Decisions taken

| # | Decision |
| --- | --- |
| 1 | Courses are 6 / 8 / 10 sessions, replacing an older 16-session plan |
| 2 | No quizzes — existing quiz code is deleted |
| 3 | Every student gets an account, including classes 5–7, provisioned by their teacher |
| 4 | Password resets run one step up the chain, and are audited |
| 5 | Video is self-encoded and served from Cloudflare R2 — **zero egress fees**, so delivery cost does not grow with student numbers |
| 6 | Encoding runs on an admin's machine, not the web host — no server cost |
| 7 | Progress tracks both watch position and manual completion, and records which |
| 8 | Teachers see per-student and per-lesson progress for their class |
| 9 | Postgres is authoritative for progress; Firebase for behaviour; Sentry for errors |
| 10 | Mobile is the primary target, desktop secondary |
| 11 | We optimise the **student's data cost**, not the hosting bill — hosting is ~$3/month |
| 12 | No new frameworks or libraries beyond what is strictly needed |
| 13 | Aggressive caching; progress writes batched, not per-tick |
| 14 | A school is a login account, not a record with a person beside it |
| 15 | Roster import rejects rows naming an unknown school, and previews before writing |
| 16 | The login page carries six one-click demo accounts — **disabled in production** |
| 17 | Video URLs are protected at the edge by a Cloudflare Worker |

All seven open questions are now answered: Malayalam ships as a **separate video per
language**; video URLs **are** protected; **no** offline downloads; concurrency sized at 500
with heavy caching; school accounts live from day one; encoding stays local; no data-residency
constraints.

---

## Timeline

13 build days, then 5 days of testing. **Two weekends are working days** — Sep 5–6 and
Sep 12–13. If they are not, the plan loses four days.

| Date | Milestone |
| --- | --- |
| Sat 5 Sep | New database schema live |
| Mon 7 Sep | Login works, roles enforced |
| Fri 11 Sep | **A student can watch a real video** |
| Sat 12 Sep | Progress and resume working |
| Mon 14 Sep | Feature freeze · all 96 content files handed over |
| **Tue 15 Sep** | **Live** |
| Sun 20 Sep | Tested, revised, signed off |

---

_AI Veda LMS · Build brief · 3 September 2026_
