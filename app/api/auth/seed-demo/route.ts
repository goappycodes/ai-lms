import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/pg";
import { hashPassword } from "@/lib/auth/password";
import { id } from "@/lib/ids";
import { demoLoginEnabled } from "@/lib/auth/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Creates the six demo accounts behind the login panel (D-16): a super admin,
 * a school, a teacher and three students — one per course, so every course is
 * reachable without setting anything up first.
 *
 * Gated on DEMO_LOGIN. A one-click super admin on a public site is a complete
 * takeover of every school and student record, so this refuses to run unless
 * the flag is explicitly on. P6-09 checks it is off before launch.
 *
 * Idempotent: re-running resets the demo passwords and changes nothing else.
 */
const DEMO_SCHOOL = "AI Veda Demo School";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "demo-aiveda-2026";

const CLASSES = {
  explorer: { level: 6, name: "Demo 6A" },
  builder: { level: 9, name: "Demo 9A" },
  achiever: { level: 11, name: "Demo 11A" },
} as const;

export async function POST() {
  if (!demoLoginEnabled()) {
    return NextResponse.json(
      { error: "Demo accounts are disabled. Set DEMO_LOGIN=1 to enable them." },
      { status: 403 }
    );
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const hash = await hashPassword(DEMO_PASSWORD);

    // The school and its login reference each other (D-14), so both go in
    // before the deferred foreign keys are checked.
    const existing = await client.query<{ id: string; user_id: string }>(
      "SELECT id, user_id FROM schools WHERE is_demo = true LIMIT 1"
    );
    let schoolId: string;
    let schoolUserId: string;

    if (existing.rows.length) {
      ({ id: schoolId, user_id: schoolUserId } = existing.rows[0]);
    } else {
      schoolId = id("sch");
      schoolUserId = id("usr");
      await client.query(
        `INSERT INTO users (id, username, password_hash, role, full_name, email, school_id)
         VALUES ($1,'demo.school',$2,'school',$3,'school@demo.aiveda.invalid',$4)`,
        [schoolUserId, hash, DEMO_SCHOOL, schoolId]
      );
      await client.query(
        `INSERT INTO schools (id, user_id, name, district, is_demo) VALUES ($1,$2,$3,'Demo',true)`,
        [schoolId, schoolUserId, DEMO_SCHOOL]
      );
      await client.query("SET CONSTRAINTS ALL IMMEDIATE");
      // IMMEDIATE lasts for the rest of the transaction, so it has to be put
      // back or every later insert loses the deferral it depends on.
      await client.query("SET CONSTRAINTS ALL DEFERRED");
    }

    // One class per course, so each demo student lands somewhere different.
    const classIds: Record<string, string> = {};
    for (const [key, c] of Object.entries(CLASSES)) {
      const found = await client.query<{ id: string }>(
        "SELECT id FROM classes WHERE school_id = $1 AND lower(name) = lower($2)",
        [schoolId, c.name]
      );
      if (found.rows.length) {
        classIds[key] = found.rows[0].id;
      } else {
        const cid = id("cls");
        await client.query(
          `INSERT INTO classes (id, school_id, name, level, academic_year)
           VALUES ($1,$2,$3,$4,'2026-27')`,
          [cid, schoolId, c.name, c.level]
        );
        classIds[key] = cid;
      }
    }

    const people = [
      { username: "demo.superadmin", role: "super_admin", fullName: "Demo Super Admin", email: "super@demo.aiveda.invalid", classId: null, schoolId: null },
      { username: "demo.teacher", role: "teacher", fullName: "Demo Teacher", email: "teacher@demo.aiveda.invalid", classId: null, schoolId },
      { username: "demo.student1", role: "student", fullName: "Demo Student 1", email: null, classId: classIds.explorer, schoolId },
      { username: "demo.student2", role: "student", fullName: "Demo Student 2", email: null, classId: classIds.builder, schoolId },
      { username: "demo.student3", role: "student", fullName: "Demo Student 3", email: null, classId: classIds.achiever, schoolId },
    ];

    for (const p of people) {
      await client.query(
        `INSERT INTO users (id, username, password_hash, role, full_name, email, school_id, class_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
        [id("usr"), p.username, hash, p.role, p.fullName, p.email, p.schoolId, p.classId]
      );
      // Re-running resets the password — that is what a demo account is for.
      await client.query(
        "UPDATE users SET password_hash = $1, status = 'active', updated_at = now() WHERE lower(username) = $2",
        [hash, p.username]
      );
    }
    await client.query("UPDATE users SET password_hash = $1, status = 'active' WHERE id = $2", [
      hash,
      schoolUserId,
    ]);

    // The demo teacher teaches all three demo classes.
    for (const cid of Object.values(classIds)) {
      await client.query(
        `INSERT INTO class_teachers (class_id, teacher_user_id)
         SELECT $1, id FROM users WHERE lower(username) = 'demo.teacher'
         ON CONFLICT DO NOTHING`,
        [cid]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({
      ok: true,
      school: DEMO_SCHOOL,
      password: DEMO_PASSWORD,
      accounts: people.map((p) => p.username).concat("demo.school").sort(),
    });
  } catch (e) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  } finally {
    client.release();
  }
}
