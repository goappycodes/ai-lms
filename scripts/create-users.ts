// Creates a real school with real staff and students, the way the product
// will: a school account, teachers under it, classes, and students in those
// classes.
//
//   npm run users:create              create the sample school
//   npm run users:create -- --list    show who exists, no changes
//   npm run users:create -- --clean   remove the sample school and its people
//
// Distinct from the demo accounts (P2-08), which exist only for the one-click
// login panel and live in a school flagged is_demo. These are ordinary rows,
// so they exercise the same constraints a real roster import will hit.
import { getPool } from "../lib/db/pg.ts";
import { hashPassword, generateTempPassword } from "../lib/auth/password.ts";
import { id } from "../lib/ids.ts";

const SCHOOL = "GHSS Kadavanthra";
const DISTRICT = "Ernakulam";
const YEAR = "2026-27";

/** Every account gets its own password, printed once, as a real reset would. */
const created: { role: string; username: string; password: string; note: string }[] = [];

const args = process.argv.slice(2);
const mode = args.includes("--clean") ? "clean" : args.includes("--list") ? "list" : "create";

const pool = getPool();

async function list() {
  const { rows } = await pool.query(
    `SELECT u.role, u.username, u.full_name, s.name AS school, c.name AS class, u.last_login_at
       FROM users u
       LEFT JOIN schools s ON s.id = u.school_id
       LEFT JOIN classes c ON c.id = u.class_id
      ORDER BY s.name NULLS FIRST,
               CASE u.role WHEN 'super_admin' THEN 0 WHEN 'school' THEN 1 WHEN 'teacher' THEN 2 ELSE 3 END,
               u.username`
  );
  if (!rows.length) return console.log("No users yet.");
  console.log(`${rows.length} users\n`);
  for (const r of rows) {
    const where = [r.school, r.class].filter(Boolean).join(" · ") || "—";
    const seen = r.last_login_at ? new Date(r.last_login_at).toISOString().slice(0, 16).replace("T", " ") : "never";
    console.log(`  ${r.role.padEnd(12)} ${r.username.padEnd(24)} ${String(where).padEnd(34)} last seen ${seen}`);
  }
}

async function clean() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ id: string; user_id: string }>(
      "SELECT id, user_id FROM schools WHERE lower(name) = lower($1)",
      [SCHOOL]
    );
    if (!rows.length) {
      console.log("Nothing to clean.");
      await client.query("ROLLBACK");
      return;
    }
    const { id: schoolId, user_id: schoolUserId } = rows[0];
    // Order matters: progress and sessions cascade from users, but classes are
    // ON DELETE RESTRICT precisely so a class with students cannot vanish
    // quietly — students go first.
    await client.query("DELETE FROM users WHERE school_id = $1 AND role = 'student'", [schoolId]);
    await client.query("DELETE FROM users WHERE school_id = $1 AND role = 'teacher'", [schoolId]);
    await client.query("DELETE FROM classes WHERE school_id = $1", [schoolId]);
    await client.query("DELETE FROM schools WHERE id = $1", [schoolId]);
    await client.query("DELETE FROM users WHERE id = $1", [schoolUserId]);
    await client.query("COMMIT");
    console.log(`Removed ${SCHOOL} and everyone in it.`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function create() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query("SELECT id FROM schools WHERE lower(name) = lower($1)", [SCHOOL]);
    if (existing.rows.length) {
      console.log(`${SCHOOL} already exists. Use --clean first, or --list to see who is in it.`);
      await client.query("ROLLBACK");
      return;
    }

    // --- the school, which is itself a login (D-14) -------------------------
    const schoolId = id("sch");
    const schoolUserId = id("usr");
    const schoolPw = generateTempPassword();
    await client.query(
      `INSERT INTO users (id, username, password_hash, role, full_name, email, school_id, must_change_password)
       VALUES ($1,$2,$3,'school',$4,$5,$6,true)`,
      [schoolUserId, "ghss.kadavanthra", await hashPassword(schoolPw), SCHOOL, "office@ghss-kadavanthra.example", schoolId]
    );
    await client.query(
      `INSERT INTO schools (id, user_id, name, district, code) VALUES ($1,$2,$3,$4,$5)`,
      [schoolId, schoolUserId, SCHOOL, DISTRICT, "KL-ERN-0142"]
    );
    // The school and its login reference each other, so the deferred foreign
    // keys are only checkable once both rows exist.
    await client.query("SET CONSTRAINTS ALL IMMEDIATE");
    await client.query("SET CONSTRAINTS ALL DEFERRED");
    created.push({ role: "school", username: "ghss.kadavanthra", password: schoolPw, note: SCHOOL });

    // --- classes, one per course band --------------------------------------
    const classSpec = [
      { name: "6B", level: 6, course: "Explorer" },
      { name: "9A", level: 9, course: "Builder" },
      { name: "11C", level: 11, course: "Achiever" },
    ];
    const classIds: Record<string, string> = {};
    for (const c of classSpec) {
      const cid = id("cls");
      await client.query(
        `INSERT INTO classes (id, school_id, name, level, academic_year) VALUES ($1,$2,$3,$4,$5)`,
        [cid, schoolId, c.name, c.level, YEAR]
      );
      classIds[c.name] = cid;
    }

    // --- teachers -----------------------------------------------------------
    const teacherSpec = [
      { username: "anitha.menon", name: "Anitha Menon", classes: ["6B"] },
      { username: "rajesh.pillai", name: "Rajesh Pillai", classes: ["9A", "11C"] },
    ];
    for (const t of teacherSpec) {
      const uid = id("usr");
      const pw = generateTempPassword();
      await client.query(
        `INSERT INTO users (id, username, password_hash, role, full_name, email, school_id, must_change_password)
         VALUES ($1,$2,$3,'teacher',$4,$5,$6,true)`,
        [uid, t.username, await hashPassword(pw), t.name, `${t.username}@ghss-kadavanthra.example`, schoolId]
      );
      for (const cname of t.classes) {
        await client.query(
          "INSERT INTO class_teachers (class_id, teacher_user_id) VALUES ($1,$2)",
          [classIds[cname], uid]
        );
      }
      created.push({ role: "teacher", username: t.username, password: pw, note: t.classes.join(", ") });
    }

    // --- students -----------------------------------------------------------
    // Usernames follow the pattern a roster import will generate: school code,
    // class, roll number. No email, ever (D-03).
    const studentSpec = [
      { roll: "023", name: "Aparna Nair", cls: "6B" },
      { roll: "024", name: "Devika Suresh", cls: "6B" },
      { roll: "011", name: "Arjun Krishnan", cls: "9A" },
      { roll: "007", name: "Fathima Rasheed", cls: "11C" },
    ];
    for (const s of studentSpec) {
      const username = `kl0142-${s.cls.toLowerCase()}-${s.roll}`;
      const pw = generateTempPassword();
      await client.query(
        `INSERT INTO users (id, username, password_hash, role, full_name, school_id, class_id, must_change_password)
         VALUES ($1,$2,$3,'student',$4,$5,$6,true)`,
        [id("usr"), username, await hashPassword(pw), s.name, schoolId, classIds[s.cls]]
      );
      created.push({ role: "student", username, password: pw, note: `${s.name} · ${s.cls}` });
    }

    // --- a second super admin, outside any school ---------------------------
    const adminPw = generateTempPassword();
    await client.query(
      `INSERT INTO users (id, username, password_hash, role, full_name, email, must_change_password)
       VALUES ($1,'nexis.admin',$2,'super_admin','NEXIS Administrator','admin@nexis.example',true)`,
      [id("usr"), await hashPassword(adminPw)]
    );
    created.push({ role: "super_admin", username: "nexis.admin", password: adminPw, note: "no school" });

    await client.query("COMMIT");

    console.log(`Created ${SCHOOL} (${DISTRICT}) with ${created.length} accounts.\n`);
    console.log("  role         username                  password        who");
    console.log("  " + "-".repeat(76));
    for (const c of created) {
      console.log(`  ${c.role.padEnd(12)} ${c.username.padEnd(25)} ${c.password.padEnd(15)} ${c.note}`);
    }
    console.log("\nEvery account starts with must_change_password set, as a teacher-issued");
    console.log("password should. Passwords are shown once — they are not recoverable.");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

try {
  if (mode === "list") await list();
  else if (mode === "clean") await clean();
  else await create();
} finally {
  await pool.end();
}
