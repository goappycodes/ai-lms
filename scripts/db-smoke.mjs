// Exercises the schema against real inserts, inside a transaction that is
// always rolled back. Nothing is written.
//
//   node scripts/db-smoke.mjs            against the already-migrated database
//   node scripts/db-smoke.mjs --migrate  apply pending migrations first, in the
//                                        same transaction — use before P1-15
//
// This is not a unit test suite; it is the answer to "does this schema support
// the queries the product actually needs", which is the only question a schema
// review can get wrong quietly.
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
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/\\\$/g, "$");
  }
  return out;
}

const env = { ...loadEnv(".env.local"), ...loadEnv(".env"), ...process.env };
const withMigrate = process.argv.includes("--migrate");

const c = new pg.Client({
  host: env.SUPABASE_DB_HOST,
  port: Number(env.SUPABASE_DB_PORT || 5432),
  user: env.SUPABASE_DB_USER,
  password: env.SUPABASE_DB_PASSWORD,
  database: env.SUPABASE_DB_NAME || "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

let pass = 0;
let fail = 0;

async function ok(name, fn) {
  try {
    await c.query("SAVEPOINT sp");
    await fn();
    await c.query("RELEASE SAVEPOINT sp");
    console.log(`  ✓ ${name}`);
    pass++;
  } catch (err) {
    await c.query("ROLLBACK TO SAVEPOINT sp");
    console.log(`  ✗ ${name}\n      ${err.message}`);
    fail++;
  }
}

// Asserts that a statement is REJECTED. A constraint nobody has seen reject
// anything is a constraint nobody knows works.
async function rejects(name, fn) {
  try {
    await c.query("SAVEPOINT sp");
    await fn();
    await c.query("ROLLBACK TO SAVEPOINT sp");
    console.log(`  ✗ ${name}\n      expected the database to reject this, it did not`);
    fail++;
  } catch {
    await c.query("ROLLBACK TO SAVEPOINT sp");
    console.log(`  ✓ ${name}`);
    pass++;
  }
}

await c.connect();
console.log(`Connected to ${env.SUPABASE_DB_HOST}\n`);
await c.query("BEGIN");

try {
  if (withMigrate) {
    const dir = path.join("lib", "db", "migrations");
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
      await c.query(fs.readFileSync(path.join(dir, f), "utf8"));
    }
    console.log("Migrations applied inside the transaction.\n");
  }

  console.log("Identity and organisation");
  // The circular reference: a school IS a login, so users.school_id and
  // schools.user_id point at each other. Both must be insertable in one
  // transaction, in either order.
  await ok("school and its login insert together (deferred FK cycle)", async () => {
    await c.query(
      `INSERT INTO users (id, username, password_hash, role, full_name, school_id, email)
       VALUES ('usr_school1','ghss.kochi','x','school','GHSS Kochi','sch_1','head@ghss.example')`
    );
    await c.query(
      `INSERT INTO schools (id, user_id, name, district) VALUES ('sch_1','usr_school1','GHSS Kochi','Ernakulam')`
    );
    await c.query("SET CONSTRAINTS ALL IMMEDIATE");
  });

  await ok("class, teacher and student", async () => {
    await c.query(`INSERT INTO classes (id, school_id, name, level, academic_year)
                   VALUES ('cls_6b','sch_1','6B',6,'2026-27')`);
    await c.query(`INSERT INTO users (id, username, password_hash, role, full_name, school_id, email)
                   VALUES ('usr_t1','anitha.t','x','teacher','Anitha T','sch_1','anitha@ghss.example')`);
    await c.query(`INSERT INTO class_teachers (class_id, teacher_user_id) VALUES ('cls_6b','usr_t1')`);
    await c.query(`INSERT INTO users (id, username, password_hash, role, full_name, school_id, class_id)
                   VALUES ('usr_s1','kl6b023','x','student','Aparna Nair','sch_1','cls_6b')`);
    await c.query("SET CONSTRAINTS ALL IMMEDIATE");
  });

  await rejects("a student may not have an email", () =>
    c.query(`INSERT INTO users (id, username, password_hash, role, full_name, school_id, class_id, email)
             VALUES ('usr_s2','x2','x','student','X','sch_1','cls_6b','kid@example.com')`)
  );
  await rejects("a student must be in a class", () =>
    c.query(`INSERT INTO users (id, username, password_hash, role, full_name, school_id)
             VALUES ('usr_s3','x3','x','student','X','sch_1')`)
  );
  await rejects("a super admin may not belong to a school", () =>
    c.query(`INSERT INTO users (id, username, password_hash, role, full_name, school_id)
             VALUES ('usr_a1','root','x','super_admin','Root','sch_1')`)
  );
  await rejects("usernames are unique case-insensitively", () =>
    c.query(`INSERT INTO users (id, username, password_hash, role, full_name, school_id, class_id)
             VALUES ('usr_s4','KL6B023','x','student','Dup','sch_1','cls_6b')`)
  );
  await rejects("two schools may not share a name, whatever the casing", () =>
    c.query(`INSERT INTO users (id, username, password_hash, role, full_name, school_id)
               VALUES ('usr_school2','x','x','school','GHSS KOCHI','sch_2')`)
      .then(() => c.query(`INSERT INTO schools (id, user_id, name) VALUES ('sch_2','usr_school2','GHSS KOCHI')`))
      .then(() => c.query("SET CONSTRAINTS ALL IMMEDIATE"))
  );
  await rejects("class level must be 5-12", () =>
    c.query(`INSERT INTO classes (id, school_id, name, level, academic_year)
             VALUES ('cls_x','sch_1','4A',4,'2026-27')`)
  );

  console.log("\nContent — the shared-lesson model");
  await ok("Builder and Achiever share one lesson row", async () => {
    await c.query(`INSERT INTO courses (id, slug, status, position) VALUES
      ('crs_b','builder','published',1), ('crs_a','achiever','published',2)`);
    await c.query(`INSERT INTO course_levels (level, course_id) VALUES (8,'crs_b'),(9,'crs_b'),(11,'crs_a')`);
    await c.query(`INSERT INTO lessons (id, duration_min) VALUES ('lsn_shared',30), ('lsn_adv',30)`);
    // Same lesson, both courses, position 3 in each.
    await c.query(`INSERT INTO course_lessons (course_id, lesson_id, position) VALUES
      ('crs_b','lsn_shared',3), ('crs_a','lsn_shared',3)`);
    await c.query(`INSERT INTO course_lessons (course_id, lesson_id, position, is_advanced) VALUES
      ('crs_a','lsn_adv',9,true)`);
    const r = await c.query(
      `SELECT count(*)::int n FROM course_lessons WHERE lesson_id = 'lsn_shared'`
    );
    if (r.rows[0].n !== 2) throw new Error(`expected the lesson in 2 courses, got ${r.rows[0].n}`);
  });

  await rejects("one course may not have two lessons at the same position", () =>
    c.query(`INSERT INTO course_lessons (course_id, lesson_id, position) VALUES ('crs_b','lsn_adv',3)`)
  );
  await rejects("a lesson still used by a course cannot be deleted", () =>
    c.query(`DELETE FROM lessons WHERE id = 'lsn_shared'`)
  );

  await ok("bilingual titles, with English fallback when Malayalam is absent", async () => {
    await c.query(`INSERT INTO lesson_translations (lesson_id, locale, title, covers) VALUES
      ('lsn_shared','en','Your 24x7 Study Partner','NotebookLM: chapter PDF to summary, MCQs, flashcards.'),
      ('lsn_shared','ml','നിങ്ങളുടെ 24x7 പഠന പങ്കാളി','NotebookLM ഉപയോഗിച്ച്...'),
      ('lsn_adv','en','AI Agents','An agent researches colleges on its own.')`);
    const r = await c.query(
      `SELECT l.id, coalesce(ml.title, en.title) AS title, (ml.title IS NULL) AS fell_back
         FROM lessons l
         LEFT JOIN lesson_translations en ON en.lesson_id = l.id AND en.locale = 'en'
         LEFT JOIN lesson_translations ml ON ml.lesson_id = l.id AND ml.locale = 'ml'
        ORDER BY l.id`
    );
    const adv = r.rows.find((x) => x.id === "lsn_adv");
    if (!adv.fell_back || adv.title !== "AI Agents") throw new Error("English fallback did not apply");
  });

  console.log("\nAssets");
  await ok("six slots per lesson, and the view counts them", async () => {
    await c.query(`INSERT INTO videos (id, lesson_id, locale, status, storage, storage_key, has_poster)
      VALUES ('vid_en','lsn_shared','en','ready','r2','hls/vid_en',true),
             ('vid_ml','lsn_shared','ml','ready','r2','hls/vid_ml',true)`);
    await c.query(`INSERT INTO documents (id, lesson_id, kind, locale, title, filename, storage_key, storage)
      VALUES ('doc_1','lsn_shared','worksheet','en','Worksheet','w.pdf','pdfs/w_en.pdf','r2'),
             ('doc_2','lsn_shared','handout','en','Handout','h.pdf','pdfs/h_en.pdf','r2')`);
    const r = await c.query(
      `SELECT count(*)::int filled FROM lesson_assets WHERE lesson_id='lsn_shared' AND is_ready`
    );
    if (r.rows[0].filled !== 4) throw new Error(`expected 4 of 6 slots filled, got ${r.rows[0].filled}`);
  });

  await rejects("a lesson may not have two English worksheets", () =>
    c.query(`INSERT INTO documents (id, lesson_id, kind, locale, title, filename, storage_key, storage)
             VALUES ('doc_3','lsn_shared','worksheet','en','Dup','w2.pdf','pdfs/w2.pdf','r2')`)
  );
  await rejects("locale must be en or ml", () =>
    c.query(`INSERT INTO videos (id, lesson_id, locale, status) VALUES ('vid_x','lsn_shared','hi','pending')`)
  );

  await ok("a failed re-encode does not replace a working video", async () => {
    await c.query(`INSERT INTO videos (id, lesson_id, locale, status, error, created_at)
      VALUES ('vid_en2','lsn_shared','en','error','ffmpeg died', now() + interval '1 minute')`);
    const r = await c.query(
      `SELECT id FROM videos WHERE lesson_id='lsn_shared' AND locale='en' AND status='ready'
        ORDER BY created_at DESC LIMIT 1`
    );
    if (r.rows[0].id !== "vid_en") throw new Error("newest-ready lookup returned the broken encode");
  });

  await ok("one live encode job per video", async () => {
    await c.query(`INSERT INTO encode_jobs (id, video_id, status) VALUES ('job_1','vid_en','queued')`);
  });
  await rejects("a second queued job for the same video is refused", () =>
    c.query(`INSERT INTO encode_jobs (id, video_id, status) VALUES ('job_2','vid_en','running')`)
  );

  console.log("\nProgress and certificates");
  await ok("progress in Builder is separate from progress in Achiever", async () => {
    await c.query(`INSERT INTO lesson_progress (user_id, course_id, lesson_id, position_sec, furthest_sec, completed_at, completed_via)
      VALUES ('usr_s1','crs_b','lsn_shared',1800,1800, now(),'auto')`);
    await c.query(`INSERT INTO lesson_progress (user_id, course_id, lesson_id, position_sec, furthest_sec)
      VALUES ('usr_s1','crs_a','lsn_shared',0,0)`);
    const r = await c.query(
      `SELECT course_id, completed_at IS NOT NULL AS done FROM lesson_progress
        WHERE user_id='usr_s1' AND lesson_id='lsn_shared' ORDER BY course_id`
    );
    if (r.rows.length !== 2) throw new Error("expected two independent progress rows");
    if (r.rows[0].done === r.rows[1].done) throw new Error("the same lesson shared completion across courses");
  });

  await ok("rewatching moves position back without losing the high-water mark", async () => {
    await c.query(`UPDATE lesson_progress SET position_sec = 120
                    WHERE user_id='usr_s1' AND course_id='crs_b' AND lesson_id='lsn_shared'`);
    const r = await c.query(`SELECT position_sec, furthest_sec, completed_at FROM lesson_progress
                              WHERE user_id='usr_s1' AND course_id='crs_b' AND lesson_id='lsn_shared'`);
    const row = r.rows[0];
    if (row.furthest_sec !== 1800 || row.completed_at === null)
      throw new Error("scrubbing back lost the high-water mark or the completion");
  });

  await rejects("completed_at without completed_via is refused", () =>
    c.query(`INSERT INTO lesson_progress (user_id, course_id, lesson_id, completed_at)
             VALUES ('usr_s1','crs_b','lsn_adv', now())`)
  );

  await ok("certificate keeps the name it was issued with", async () => {
    await c.query(`INSERT INTO certificates_issued (id, user_id, course_id, verification_code, student_name, school_name)
      VALUES ('cert_1','usr_s1','crs_b','AV-7QK3-2M','Aparna Nair','GHSS Kochi')`);
    await c.query(`UPDATE users SET full_name = 'Aparna R Nair' WHERE id='usr_s1'`);
    const r = await c.query(`SELECT student_name FROM certificates_issued WHERE id='cert_1'`);
    if (r.rows[0].student_name !== "Aparna Nair")
      throw new Error("renaming the student changed an issued certificate");
  });

  await rejects("a certificate is issued once per course", () =>
    c.query(`INSERT INTO certificates_issued (id, user_id, course_id, verification_code, student_name, school_name)
             VALUES ('cert_2','usr_s1','crs_b','AV-OTHER','Aparna Nair','GHSS Kochi')`)
  );
  await rejects("a student with an issued certificate cannot be deleted", () =>
    c.query(`DELETE FROM users WHERE id='usr_s1'`)
  );

  console.log(`\n${pass} passed, ${fail} failed.`);
} finally {
  await c.query("ROLLBACK");
  await c.end();
}

process.exit(fail === 0 ? 0 : 1);
