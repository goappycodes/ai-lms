import { Pool } from "pg";

// One pooled connection to Supabase Postgres, reused across Next hot-reloads.
// We connect through Supabase's IPv4 session pooler (see .env.local).
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
      max: 8,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 12_000,
    });
  }
  return g.__aivedaPool;
}
