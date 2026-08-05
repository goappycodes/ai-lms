import { Pool } from "pg";

// One pooled connection to Supabase Postgres, reused across Next hot-reloads.
// We connect through Supabase's IPv4 session pooler (see .env.local).
const g = globalThis as unknown as { __aivedaPool?: Pool };

export function getPool(): Pool {
  if (!g.__aivedaPool) {
    const host = process.env.SUPABASE_DB_HOST;
    if (!host) throw new Error("SUPABASE_DB_HOST is not set — configure .env.local");
    g.__aivedaPool = new Pool({
      host,
      port: Number(process.env.SUPABASE_DB_PORT || 5432),
      user: process.env.SUPABASE_DB_USER,
      password: process.env.SUPABASE_DB_PASSWORD,
      database: process.env.SUPABASE_DB_NAME || "postgres",
      ssl: { rejectUnauthorized: false },
      max: 8,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 12_000,
    });
  }
  return g.__aivedaPool;
}
