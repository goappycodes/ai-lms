// Quick row counts straight from Supabase. Usage: node scripts/db-verify.mjs
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

const env = loadEnv(".env.local");
const c = new pg.Client({
  host: env.SUPABASE_DB_HOST,
  port: Number(env.SUPABASE_DB_PORT || 5432),
  user: env.SUPABASE_DB_USER,
  password: env.SUPABASE_DB_PASSWORD,
  database: env.SUPABASE_DB_NAME || "postgres",
  ssl: { rejectUnauthorized: false },
});
await c.connect();
for (const t of ["courses", "chapters", "lessons", "videos", "pdfs", "quizzes", "quiz_questions", "certificates"]) {
  const r = await c.query(`select count(*)::int n from ${t}`);
  console.log(t.padEnd(16), r.rows[0].n);
}
const s = await c.query("select title, audience, status from courses order by position");
console.log("\ncourses:");
s.rows.forEach((r) => console.log(`  ${r.title} / ${r.audience} / ${r.status}`));
await c.end();
