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
import crypto from "node:crypto";
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

// Every fixture id and slug is namespaced to this run. Without it the test
// collides with real data — seeded courses already own the slugs '${ref("builder")}' and
// '${ref("achiever")}' — and a single collision cascades into a dozen misleading
// failures further down.
const RUN = `smk${crypto.randomBytes(4).toString("hex")}`;
const ref = (name) => `${RUN}_${name}`;

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

// Asserts that a statement is REJECTED, *by the named constraint*.
//
// Checking only that "something threw" is close to useless: a broken fixture
// upstream makes every later insert fail on a missing foreign key, and the
// test reports a wall of green while proving nothing. The constraint name has
// to appear in the error.
async function rejects(name, expected, fn) {
  try {
    await c.query("SAVEPOINT sp");
    await fn();
    await c.query("ROLLBACK TO SAVEPOINT sp");
    console.log(`  ✗ ${name}\n      expected the database to reject this, it did not`);
    fail++;
  } catch (err) {
    await c.query("ROLLBACK TO SAVEPOINT sp");
    if (String(err.message).includes(expected)) {
      console.log(`  ✓ ${name}`);
      pass++;
    } else {
      console.log(`  ✗ ${name}\n      rejected, but by '${err.message}' — expected '${expected}'`);
      fail++;
    }
  }
}

await c.connect();
console.log(`Connected to ${env.SUPABASE_DB_HOST}\n`);

// Which pooler we are on is a capacity decision, not a preference, so it is
// asserted rather than left to whoever last edited .env.local.
//
// Measured against this project: the session pooler (5432) hands out a real
// Postgres connection per client and refuses after 15 — two serverless
// instances at the pool size we run. The transaction pooler (6543) allows 200
// and returns the connection after each statement.
console.log("Connection shape");
{
  const port = Number(env.SUPABASE_DB_PORT || 5432);
  const pooled = /pooler\.supabase\.com$/.test(env.SUPABASE_DB_HOST ?? "");
  if (!pooled) {
    console.log("  · not a Supabase pooler host, skipping the port check");
  } else if (port === 6543) {
    console.log("  ✓ using the transaction pooler (6543) — 200 client connections");
    pass++;
  } else {
    console.log(
      `  ✗ using port ${port}. The session pooler refuses after 15 clients;\n` +
        "      set SUPABASE_DB_PORT=6543 (see docs/PERFORMANCE.md, Phase 0)"
    );
    fail++;
  }
}
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
       VALUES ('${ref("usr_school1")}','${ref("ghss.kochi")}','x','school','${ref("GHSS Kochi")}','${ref("sch_1")}','${ref("head")}@ghss.example')`
    );
    await c.query(
      `INSERT INTO schools (id, user_id, name, district) VALUES ('${ref("sch_1")}','${ref("usr_school1")}','${ref("GHSS Kochi")}','Ernakulam')`
    );
    await c.query("SET CONSTRAINTS ALL IMMEDIATE");
    await c.query("SET CONSTRAINTS ALL DEFERRED");
  });

  await ok("class, teacher and student", async () => {
    await c.query(`INSERT INTO classes (id, school_id, name, level, academic_year)
                   VALUES ('${ref("cls_6b")}','${ref("sch_1")}','6B',6,'2026-27')`);
    await c.query(`INSERT INTO users (id, username, password_hash, role, full_name, school_id, email)
                   VALUES ('${ref("usr_t1")}','${ref("anitha.t")}','x','teacher','Anitha T','${ref("sch_1")}','${ref("anitha")}@ghss.example')`);
    await c.query(`INSERT INTO class_teachers (class_id, teacher_user_id) VALUES ('${ref("cls_6b")}','${ref("usr_t1")}')`);
    await c.query(`INSERT INTO users (id, username, password_hash, role, full_name, school_id, class_id)
                   VALUES ('${ref("usr_s1")}','${ref("kl6b023")}','x','student','Aparna Nair','${ref("sch_1")}','${ref("cls_6b")}')`);
    await c.query("SET CONSTRAINTS ALL IMMEDIATE");
    await c.query("SET CONSTRAINTS ALL DEFERRED");
  });

  await rejects("a student may not have an email", "users_student_shape", () =>
    c.query(`INSERT INTO users (id, username, password_hash, role, full_name, school_id, class_id, email)
             VALUES ('${ref("usr_s2")}','${ref("x2")}','x','student','X','${ref("sch_1")}','${ref("cls_6b")}','kid@example.com')`)
  );
  await rejects("a student must be in a class", "users_student_shape", () =>
    c.query(`INSERT INTO users (id, username, password_hash, role, full_name, school_id)
             VALUES ('${ref("usr_s3")}','${ref("x3")}','x','student','X','${ref("sch_1")}')`)
  );
  await rejects("a super admin may not belong to a school", "users_school_scope", () =>
    c.query(`INSERT INTO users (id, username, password_hash, role, full_name, school_id)
             VALUES ('${ref("usr_a1")}','${ref("root")}','x','super_admin','Root','${ref("sch_1")}')`)
  );
  await rejects("usernames are unique case-insensitively", "users_username_key", () =>
    c.query(`INSERT INTO users (id, username, password_hash, role, full_name, school_id, class_id)
             VALUES ('${ref("usr_s4")}','${ref("KL6B023").toUpperCase()}','x','student','Dup','${ref("sch_1")}','${ref("cls_6b")}')`)
  );
  await ok("a second school can be created", async () => {
    await c.query(
      `INSERT INTO users (id, username, password_hash, role, full_name, school_id, email)
       VALUES ('${ref("usr_school2")}','${ref("sch2user")}','x','school','${ref("Other School")}','${ref("sch_2")}','${ref("other")}@x.example')`
    );
    await c.query(
      `INSERT INTO schools (id, user_id, name) VALUES ('${ref("sch_2")}','${ref("usr_school2")}','${ref("Other School")}')`
    );
    await c.query("SET CONSTRAINTS ALL IMMEDIATE");
    await c.query("SET CONSTRAINTS ALL DEFERRED");
  });
  await rejects("two schools may not share a name, whatever the casing", "schools_name_key", () =>
    c.query(
      `UPDATE schools SET name = '${ref("GHSS Kochi").toUpperCase()}' WHERE id = '${ref("sch_2")}'`
    )
  );
  await rejects("class level must be 5-12", "classes_level_valid", () =>
    c.query(`INSERT INTO classes (id, school_id, name, level, academic_year)
             VALUES ('${ref("cls_x")}','${ref("sch_1")}','4A',4,'2026-27')`)
  );

  console.log("\nContent — the shared-lesson model");
  await ok("Builder and Achiever share one lesson row", async () => {
    await c.query(`INSERT INTO courses (id, slug, status, position) VALUES
      ('${ref("crs_b")}','${ref("builder")}','published',1), ('${ref("crs_a")}','${ref("achiever")}','published',2)`);
    await c.query(`INSERT INTO lessons (id, duration_min) VALUES ('${ref("lsn_shared")}',30), ('${ref("lsn_adv")}',30)`);
    // Same lesson, both courses, position 3 in each.
    await c.query(`INSERT INTO course_lessons (course_id, lesson_id, position) VALUES
      ('${ref("crs_b")}','${ref("lsn_shared")}',3), ('${ref("crs_a")}','${ref("lsn_shared")}',3)`);
    await c.query(`INSERT INTO course_lessons (course_id, lesson_id, position, is_advanced) VALUES
      ('${ref("crs_a")}','${ref("lsn_adv")}',9,true)`);
    const r = await c.query(
      `SELECT count(*)::int n FROM course_lessons WHERE lesson_id = '${ref("lsn_shared")}'`
    );
    if (r.rows[0].n !== 2) throw new Error(`expected the lesson in 2 courses, got ${r.rows[0].n}`);
  });

  await rejects("one course may not have two lessons at the same position", "course_lessons_position_key", () =>
    c.query(`INSERT INTO course_lessons (course_id, lesson_id, position) VALUES ('${ref("crs_b")}','${ref("lsn_adv")}',3)`)
  );
  await rejects("a lesson still used by a course cannot be deleted", "course_lessons_lesson_id_fkey", () =>
    c.query(`DELETE FROM lessons WHERE id = '${ref("lsn_shared")}'`)
  );

  await ok("bilingual titles, with English fallback when Malayalam is absent", async () => {
    await c.query(`INSERT INTO lesson_translations (lesson_id, locale, title, covers) VALUES
      ('${ref("lsn_shared")}','en','Your 24x7 Study Partner','NotebookLM: chapter PDF to summary, MCQs, flashcards.'),
      ('${ref("lsn_shared")}','ml','നിങ്ങളുടെ 24x7 പഠന പങ്കാളി','NotebookLM ഉപയോഗിച്ച്...'),
      ('${ref("lsn_adv")}','en','AI Agents','An agent researches colleges on its own.')`);
    const r = await c.query(
      `SELECT l.id, coalesce(ml.title, en.title) AS title, (ml.title IS NULL) AS fell_back
         FROM lessons l
         LEFT JOIN lesson_translations en ON en.lesson_id = l.id AND en.locale = 'en'
         LEFT JOIN lesson_translations ml ON ml.lesson_id = l.id AND ml.locale = 'ml'
        WHERE l.id LIKE '${RUN}%'
        ORDER BY l.id`
    );
    const adv = r.rows.find((x) => x.id === ref("lsn_adv"));
    if (!adv.fell_back || adv.title !== "AI Agents") throw new Error("English fallback did not apply");
  });

  console.log("\nAssets");
  await ok("six slots per lesson, and the view counts them", async () => {
    await c.query(`INSERT INTO videos (id, lesson_id, locale, status, storage, storage_key, has_poster)
      VALUES ('${ref("vid_en")}','${ref("lsn_shared")}','en','ready','r2','hls/vid_en',true),
             ('${ref("vid_ml")}','${ref("lsn_shared")}','ml','ready','r2','hls/vid_ml',true)`);
    await c.query(`INSERT INTO documents (id, lesson_id, kind, locale, title, filename, storage_key, storage)
      VALUES ('${ref("doc_1")}','${ref("lsn_shared")}','worksheet','en','Worksheet','w.pdf','pdfs/w_en.pdf','r2'),
             ('${ref("doc_2")}','${ref("lsn_shared")}','handout','en','Handout','h.pdf','pdfs/h_en.pdf','r2')`);
    const r = await c.query(
      `SELECT count(*)::int filled FROM lesson_assets WHERE lesson_id='${ref("lsn_shared")}' AND is_ready`
    );
    if (r.rows[0].filled !== 4) throw new Error(`expected 4 of 6 slots filled, got ${r.rows[0].filled}`);
  });

  await rejects("a lesson may not have two English worksheets", "documents_slot_key", () =>
    c.query(`INSERT INTO documents (id, lesson_id, kind, locale, title, filename, storage_key, storage)
             VALUES ('${ref("doc_3")}','${ref("lsn_shared")}','worksheet','en','Dup','w2.pdf','pdfs/w2.pdf','r2')`)
  );
  await rejects("locale must be en or ml", "videos_locale_valid", () =>
    c.query(`INSERT INTO videos (id, lesson_id, locale, status) VALUES ('${ref("vid_x")}','${ref("lsn_shared")}','hi','pending')`)
  );

  await ok("a failed re-encode does not replace a working video", async () => {
    await c.query(`INSERT INTO videos (id, lesson_id, locale, status, error, created_at)
      VALUES ('${ref("vid_en2")}','${ref("lsn_shared")}','en','error','ffmpeg died', now() + interval '1 minute')`);
    const r = await c.query(
      `SELECT id FROM videos WHERE lesson_id='${ref("lsn_shared")}' AND locale='en' AND status='ready'
        ORDER BY created_at DESC LIMIT 1`
    );
    if (r.rows[0]?.id !== ref("vid_en"))
      throw new Error("newest-ready lookup returned the broken encode");
  });

  await ok("one live encode job per video", async () => {
    await c.query(`INSERT INTO encode_jobs (id, video_id, status) VALUES ('${ref("job_1")}','${ref("vid_en")}','queued')`);
  });
  await rejects("a second queued job for the same video is refused", "encode_jobs_one_active_key", () =>
    c.query(`INSERT INTO encode_jobs (id, video_id, status) VALUES ('${ref("job_2")}','${ref("vid_en")}','running')`)
  );

  console.log("\nProgress and certificates");
  await ok("progress in Builder is separate from progress in Achiever", async () => {
    await c.query(`INSERT INTO lesson_progress (user_id, course_id, lesson_id, position_sec, furthest_sec, completed_at, completed_via)
      VALUES ('${ref("usr_s1")}','${ref("crs_b")}','${ref("lsn_shared")}',1800,1800, now(),'auto')`);
    await c.query(`INSERT INTO lesson_progress (user_id, course_id, lesson_id, position_sec, furthest_sec)
      VALUES ('${ref("usr_s1")}','${ref("crs_a")}','${ref("lsn_shared")}',0,0)`);
    const r = await c.query(
      `SELECT course_id, completed_at IS NOT NULL AS done FROM lesson_progress
        WHERE user_id='${ref("usr_s1")}' AND lesson_id='${ref("lsn_shared")}' ORDER BY course_id`
    );
    if (r.rows.length !== 2) throw new Error("expected two independent progress rows");
    if (r.rows[0].done === r.rows[1].done) throw new Error("the same lesson shared completion across courses");
  });

  await ok("rewatching moves position back without losing the high-water mark", async () => {
    await c.query(`UPDATE lesson_progress SET position_sec = 120
                    WHERE user_id='${ref("usr_s1")}' AND course_id='${ref("crs_b")}' AND lesson_id='${ref("lsn_shared")}'`);
    const r = await c.query(`SELECT position_sec, furthest_sec, completed_at FROM lesson_progress
                              WHERE user_id='${ref("usr_s1")}' AND course_id='${ref("crs_b")}' AND lesson_id='${ref("lsn_shared")}'`);
    const row = r.rows[0];
    if (row.furthest_sec !== 1800 || row.completed_at === null)
      throw new Error("scrubbing back lost the high-water mark or the completion");
  });

  await rejects("completed_at without completed_via is refused", "lesson_progress_completion_pair", () =>
    c.query(`INSERT INTO lesson_progress (user_id, course_id, lesson_id, completed_at)
             VALUES ('${ref("usr_s1")}','${ref("crs_b")}','${ref("lsn_adv")}', now())`)
  );

  await ok("certificate keeps the name it was issued with", async () => {
    await c.query(`INSERT INTO certificates_issued (id, user_id, course_id, verification_code, student_name, school_name)
      VALUES ('${ref("cert_1")}','${ref("usr_s1")}','${ref("crs_b")}','${ref("AV-7QK3-2M")}','Aparna Nair','${ref("GHSS Kochi")}')`);
    await c.query(`UPDATE users SET full_name = 'Aparna R Nair' WHERE id='${ref("usr_s1")}'`);
    const r = await c.query(`SELECT student_name FROM certificates_issued WHERE id='${ref("cert_1")}'`);
    if (r.rows[0].student_name !== "Aparna Nair")
      throw new Error("renaming the student changed an issued certificate");
  });

  await rejects("a certificate is issued once per course", "certificates_issued_once_key", () =>
    c.query(`INSERT INTO certificates_issued (id, user_id, course_id, verification_code, student_name, school_name)
             VALUES ('${ref("cert_2")}','${ref("usr_s1")}','${ref("crs_b")}','${ref("AV-OTHER")}','Aparna Nair','${ref("GHSS Kochi")}')`)
  );
  await rejects("a student with an issued certificate cannot be deleted", "certificates_issued_user_id_fkey", () =>
    c.query(`DELETE FROM users WHERE id='${ref("usr_s1")}'`)
  );

  console.log(`\n${pass} passed, ${fail} failed.`);
} finally {
  await c.query("ROLLBACK");
  await c.end();
}

process.exit(fail === 0 ? 0 : 1);
