// Row counts for every table, straight from the database.
//   node scripts/db-verify.mjs
//
// Reads the table list from the catalogue rather than hard-coding it, so it
// works before and after a migration and never reports a table that is not
// there any more.
import fs from "node:fs";
import pg from "pg";

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/\\\$/g, "$");
  }
  return out;
}

const env = { ...loadEnv(".env.local"), ...loadEnv(".env"), ...process.env };
const c = new pg.Client({
  host: env.SUPABASE_DB_HOST,
  port: Number(env.SUPABASE_DB_PORT || 5432),
  user: env.SUPABASE_DB_USER,
  password: env.SUPABASE_DB_PASSWORD,
  database: env.SUPABASE_DB_NAME || "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

await c.connect();
console.log(`${env.SUPABASE_DB_HOST}\n`);

const { rows: tables } = await c.query(
  `SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name`
);

let total = 0;
for (const { table_name } of tables) {
  const r = await c.query(`SELECT count(*)::int n FROM "${table_name}"`);
  total += r.rows[0].n;
  console.log(`  ${table_name.padEnd(24)} ${String(r.rows[0].n).padStart(6)}`);
}
console.log(`\n${tables.length} tables, ${total} rows total`);

const migrations = tables.some((t) => t.table_name === "schema_migrations");
if (migrations) {
  const { rows } = await c.query("SELECT version FROM schema_migrations ORDER BY version");
  console.log(`\nMigrations applied (${rows.length}):`);
  for (const r of rows) console.log(`  ${r.version}`);
} else {
  console.log("\nNo schema_migrations table — run `npm run db:migrate`.");
}

const { rows: courses } = await c.query(
  tables.some((t) => t.table_name === "course_translations")
    ? `SELECT c.slug, t.title, c.status FROM courses c
         LEFT JOIN course_translations t ON t.course_id = c.id AND t.locale = 'en'
        ORDER BY c.position`
    : `SELECT slug, title, status FROM courses ORDER BY position`
).catch(() => ({ rows: [] }));
if (courses.length) {
  console.log("\nCourses:");
  for (const r of courses) console.log(`  ${r.slug} — ${r.title ?? "(untitled)"} · ${r.status}`);
}

await c.end();
