import { Pool } from "pg";

/**
 * One pooled connection to Supabase Postgres, reused across Next hot-reloads.
 *
 * Through the **transaction** pooler (port 6543), not the session one (5432).
 * Measured: the session pooler holds a real Postgres connection per client and
 * refuses after 15, which at the pool size below is two serverless instances
 * before the platform stops connecting at all. The transaction pooler allows
 * 200 and hands a connection back after each statement.
 *
 * Transaction mode is safe here because nothing needs session state to survive
 * between statements: every `SET CONSTRAINTS` in the product sits inside a
 * BEGIN/COMMIT, and `pg` uses unnamed prepared statements, which the pooler
 * supports. Adding LISTEN/NOTIFY, a temp table, or a named statement later
 * would break that — hence this note.
 */
const g = globalThis as unknown as { __aivedaPool?: Pool };

export function getPool(): Pool {
  if (!g.__aivedaPool) {
    // Trim to defend against trailing spaces/newlines pasted into env values.
    const val = (k: string) => (process.env[k] ?? "").trim();
    const host = val("SUPABASE_DB_HOST");
    if (!host) throw new Error("SUPABASE_DB_HOST is not set — configure .env.local");
    g.__aivedaPool = new Pool({
      host,
      port: Number(val("SUPABASE_DB_PORT") || 5432),
      user: val("SUPABASE_DB_USER"),
      password: val("SUPABASE_DB_PASSWORD"),
      database: val("SUPABASE_DB_NAME") || "postgres",
      ssl: { rejectUnauthorized: false },
      /**
       * Small on purpose.
       *
       * The pooler allows 200 clients in total, shared by every running
       * instance. A serverless instance serves few requests at once, so a
       * small pool in many instances fits far more of them under that ceiling
       * than a large pool in a few — 8 per instance caps the platform at 25
       * instances, 3 allows 66. Locally there is one process running the
       * suites, which want a few more.
       */
      max: Number(val("PG_POOL_MAX")) || (process.env.VERCEL ? 3 : 8),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 12_000,
    });
  }
  return g.__aivedaPool;
}
