// Applies pending SQL migrations from lib/db/migrations, in filename order.
//
//   node scripts/migrate.mjs             apply pending migrations
//   node scripts/migrate.mjs --dry-run   apply inside one transaction, roll back
//   node scripts/migrate.mjs --status    list applied and pending, change nothing
//
// Each migration runs in its own transaction, so a failure leaves the database
// on the last good migration rather than half-way through a broken one.
//
// Deliberately dependency-free. A migration tool would be a reasonable choice
// on a longer project; here it would be a framework to learn, configure and
// debug for something that is 120 lines of pg.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import pg from "pg";

const MIGRATIONS_DIR = path.join("lib", "db", "migrations");

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

const env = { ...loadEnv(".env.local"), ...loadEnv(".env"), ...process.env };
const dryRun = process.argv.includes("--dry-run");
const statusOnly = process.argv.includes("--status");

if (!env.SUPABASE_DB_HOST) {
  console.error("SUPABASE_DB_HOST is not set — configure .env.local");
  process.exit(1);
}

const client = new pg.Client({
  host: env.SUPABASE_DB_HOST,
  port: Number(env.SUPABASE_DB_PORT || 5432),
  user: env.SUPABASE_DB_USER,
  password: env.SUPABASE_DB_PASSWORD,
  database: env.SUPABASE_DB_NAME || "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);

await client.connect();
console.log(`Connected to ${env.SUPABASE_DB_HOST} as ${env.SUPABASE_DB_USER}\n`);

await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version    text PRIMARY KEY,
    checksum   text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`);

const files = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const { rows } = await client.query("SELECT version, checksum FROM schema_migrations");
const applied = new Map(rows.map((r) => [r.version, r.checksum]));

// An already-applied migration that has since been edited is a real problem:
// the database and the file no longer agree, and nothing will ever reconcile
// them. Fail loudly rather than pretend.
let drifted = false;
for (const file of files) {
  if (!applied.has(file)) continue;
  const current = sha(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  if (current !== applied.get(file)) {
    console.error(`  ✗ ${file} was edited after being applied (${applied.get(file)} → ${current})`);
    drifted = true;
  }
}
if (drifted) {
  console.error("\nEdit a new migration instead of an applied one.");
  await client.end();
  process.exit(1);
}

const pending = files.filter((f) => !applied.has(f));

if (statusOnly) {
  for (const f of files) console.log(`  ${applied.has(f) ? "applied" : "pending"}  ${f}`);
  console.log(`\n${applied.size} applied, ${pending.length} pending.`);
  await client.end();
  process.exit(0);
}

if (pending.length === 0) {
  console.log("Nothing to apply — database is up to date.");
  await client.end();
  process.exit(0);
}

console.log(`${pending.length} migration(s) to apply${dryRun ? " (DRY RUN — will roll back)" : ""}:\n`);

try {
  if (dryRun) await client.query("BEGIN");

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const started = Date.now();
    if (!dryRun) await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)", [
        file,
        sha(sql),
      ]);
      if (!dryRun) await client.query("COMMIT");
      console.log(`  ✓ ${file}  (${Date.now() - started} ms)`);
    } catch (err) {
      if (!dryRun) await client.query("ROLLBACK");
      throw new Error(`${file}: ${err.message}`);
    }
  }

  if (dryRun) {
    await client.query("ROLLBACK");
    console.log("\nDry run complete — every migration applied cleanly, then rolled back.");
  } else {
    console.log(`\n${pending.length} migration(s) applied.`);
  }
} catch (err) {
  if (dryRun) await client.query("ROLLBACK").catch(() => {});
  console.error(`\nFAILED — ${err.message}`);
  console.error(dryRun ? "Nothing was changed." : "Earlier migrations in this run are committed.");
  await client.end();
  process.exit(1);
}

// Report the resulting shape, so a run is self-verifying.
const summary = await client.query(`
  SELECT table_name,
         (SELECT count(*) FROM information_schema.columns c
           WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS cols
  FROM information_schema.tables t
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name
`);
console.log(`\nTables (${summary.rows.length}):`);
for (const r of summary.rows) console.log(`  ${r.table_name.padEnd(24)} ${r.cols} cols`);

const views = await client.query(
  `SELECT table_name FROM information_schema.views WHERE table_schema = 'public' ORDER BY 1`
);
if (views.rows.length) {
  console.log(`\nViews (${views.rows.length}):`);
  for (const r of views.rows) console.log(`  ${r.table_name}`);
}

await client.end();
