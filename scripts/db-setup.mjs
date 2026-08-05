// Apply lib/db/schema.pg.sql to the Supabase Postgres database.
// Usage: node scripts/db-setup.mjs   (reads connection from .env.local)
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    // Mirror Next's env loader: '\$' means a literal '$'.
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/\\\$/g, "$");
  }
  return out;
}

const env = { ...loadEnv(".env.local"), ...loadEnv(".env") };
const client = new pg.Client({
  host: env.SUPABASE_DB_HOST,
  port: Number(env.SUPABASE_DB_PORT || 5432),
  user: env.SUPABASE_DB_USER,
  password: env.SUPABASE_DB_PASSWORD,
  database: env.SUPABASE_DB_NAME || "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

const schema = fs.readFileSync(path.join("lib", "db", "schema.pg.sql"), "utf8");

await client.connect();
console.log(`Connected to ${env.SUPABASE_DB_HOST} as ${env.SUPABASE_DB_USER}`);
await client.query(schema);
console.log("Schema applied.");

const { rows } = await client.query(
  `SELECT table_name,
          (SELECT count(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema='public') AS cols
   FROM information_schema.tables t
   WHERE table_schema='public' AND table_type='BASE TABLE'
   ORDER BY table_name`
);
console.log("\nTables:");
for (const r of rows) console.log(`  ${r.table_name} (${r.cols} cols)`);

await client.end();
