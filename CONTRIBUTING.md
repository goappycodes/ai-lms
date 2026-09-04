# Working on AI Veda

Short, because a 13-day build cannot afford process. Everything here exists to
stop two people breaking each other's work.

See [docs/TASKS.md](docs/TASKS.md) for what to do next and
[docs/SCHEMA.md](docs/SCHEMA.md) before touching the database.

---

## Getting set up

```bash
npm install
cp .env.example .env.local     # fill in the values — see below
npm run db:status              # confirms you can reach the database
npm run dev
```

`.env.local` is gitignored and must stay that way. The five `SUPABASE_DB_*`
values are the whole database story: Supabase is used **only** as a managed
Postgres host, no Auth, Storage or PostgREST, so the app moves to any Postgres
by changing those five and nothing else.

Two traps that have already cost time:

- **Port 5432 locally, 6543 on Vercel.** Session pooler for a long-lived
  process, transaction pooler for serverless functions.
- **`$` in the database password must be written `\$` in `.env.local`** — Next
  expands variables — but **raw on Vercel**, which does not. Easiest to use a
  password with no `$` in it.

---

## Branches and pull requests

One task, one branch, one PR. Task ids are stable, so name the branch after
what it does and put the id in the PR title:

```
feat/…    new capability          feat/repo-rewrite
fix/…     something is wrong      fix/trackcard-phases
chore/…   tidying, config         chore/postgres-only-env
docs/…    documentation only      docs/schema-spec
```

```bash
git checkout main && git pull
git checkout -b feat/thing
# …work…
npm run verify                 # see below — do not skip
git commit && git push -u origin feat/thing
gh pr create --base main
```

**A PR body should say why, not what.** The diff already says what. Anyone
reviewing under time pressure needs the reasoning, the trade-off you took, and
what you verified — especially anything you deliberately did *not* do.

Squash-merge and delete the branch. `main` is always deployable.

---

## Before every PR

```bash
npm run verify
```

Which is typecheck, build, and the two suites that do not need a browser:

| Command | Checks |
| --- | --- |
| `npm run db:smoke` | 25 schema behaviours, in a transaction that always rolls back |
| `npm run verify:password` | 24 password-hashing behaviours |
| `npm run db:status` | which migrations are applied |

`db:smoke` writes nothing — it is safe against the live database.

`verify:auth` needs a dev server. Run it against a **freshly started** one:
`next build` and `next dev` share `.next`, and a dev server started on top of a
production build throws `__webpack_modules__[moduleId] is not a function` from
a page that is perfectly fine. If a page 500s right after `npm run verify`,
that is why — `rm -rf .next` and restart before believing it.

---

## Changing the database

**Never edit an applied migration.** The runner stores a checksum and refuses
to continue if one changes, because the file and the database would silently
disagree forever. Add a new numbered file instead.

```bash
# 1. write lib/db/migrations/00NN_thing.sql
npm run db:migrate:dry        # applies everything in one transaction, rolls back
npm run db:migrate            # for real
npm run db:smoke              # prove the shape still behaves
```

Update [docs/SCHEMA.md](docs/SCHEMA.md) in the same PR. A schema doc that has
drifted from the schema is worse than none.

---

## Rules that apply to everything

These are conditions on all 125 tasks, not suggestions. Each one costs more to
retrofit than to do first time.

1. **Phone first.** Most students are on a shared Android phone on mobile data.
   Not desktop with breakpoints bolted on.
2. **Every string goes through the catalogue** the moment it is typed. Never
   "translate it later" — half the product ships in Malayalam.
3. **Every API route checks authorisation.** Nothing ships open, including
   routes that feel internal.
4. **Every administrative action writes an audit row.** Especially password
   resets: the whole recovery model assumes we can say who did what.
5. **No new dependency without the reason in the PR.** The runtime has six.
   Password hashing uses Node's built-in scrypt precisely to avoid a seventh.
6. **Assets store a key, never a URL.** The delivery domain is configuration.

---

## Environments

| | Where | Database | Notes |
| --- | --- | --- | --- |
| Local | your machine | shared Supabase | the only place that can encode video — needs ffmpeg |
| Staging | ai-lms-xi.vercel.app | shared Supabase | demo login panel enabled here |
| Production | not yet | — | demo panel **must** be off |

**Video encoding runs locally, by design.** Serverless has no ffmpeg, a
read-only disk and short timeouts. An admin runs the whole app on a machine
that has ffmpeg, uploads through *that* Studio, and the encode publishes to R2
and writes back to the shared database. The live site picks it up with no
redeploy. Uploading through the deployed Studio returns a 501 that says so.

Environment variables only apply to **new** Vercel deployments — redeploy after
changing them.
