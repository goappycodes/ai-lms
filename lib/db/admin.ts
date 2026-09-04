import { getPool } from "./pg";
import { id } from "@/lib/ids";
import { generateTempPassword, hashPassword } from "@/lib/auth/password";

/**
 * Provisioning writes: schools, teachers, classes, students.
 *
 * Everything that creates a person returns the temporary password once, in
 * memory, and never stores it. Only the hash is written, so a password that is
 * not read from the screen at that moment is gone — which is the same promise
 * the reset chain makes (D-04).
 */

export interface Provisioned {
  id: string;
  username: string;
  /** Shown once, then unrecoverable. */
  password: string;
}

/** A duplicate username or school name is a normal mistake, not a 500. */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

function isUnique(e: unknown, constraint: string): boolean {
  return e instanceof Error && /duplicate key/.test(e.message) && e.message.includes(constraint);
}

/**
 * A school and the login that IS that school (D-14), in one transaction.
 *
 * The two rows reference each other, so neither can be inserted first under
 * immediate constraints. The foreign keys are deferrable; `SET CONSTRAINTS ALL
 * IMMEDIATE` forces the check once both exist, and is put straight back to
 * DEFERRED — it applies for the rest of the transaction, so leaving it on would
 * break any later insert that relies on the deferral.
 */
export async function createSchoolWithLogin(input: {
  name: string;
  district?: string | null;
  code?: string | null;
  username: string;
  email?: string | null;
}): Promise<{ schoolId: string; login: Provisioned }> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    const schoolId = id("sch");
    const userId = id("usr");
    const password = generateTempPassword();
    const hash = await hashPassword(password);

    await client.query(
      `INSERT INTO users (id, username, password_hash, role, full_name, email, school_id, must_change_password)
       VALUES ($1,$2,$3,'school',$4,$5,$6,true)`,
      [userId, input.username, hash, input.name, input.email ?? null, schoolId]
    );
    await client.query(
      `INSERT INTO schools (id, user_id, name, district, code) VALUES ($1,$2,$3,$4,$5)`,
      [schoolId, userId, input.name, input.district ?? null, input.code ?? null]
    );
    await client.query("SET CONSTRAINTS ALL IMMEDIATE");
    await client.query("SET CONSTRAINTS ALL DEFERRED");

    await client.query("COMMIT");
    return { schoolId, login: { id: userId, username: input.username, password } };
  } catch (e) {
    await client.query("ROLLBACK");
    if (isUnique(e, "users_username_key")) {
      throw new ConflictError("That username is already taken.");
    }
    if (isUnique(e, "schools_name_key")) {
      throw new ConflictError("A school with that name already exists.");
    }
    if (isUnique(e, "schools_code_key")) {
      throw new ConflictError("A school with that code already exists.");
    }
    throw e;
  } finally {
    client.release();
  }
}

export async function createTeacher(input: {
  schoolId: string;
  fullName: string;
  username: string;
  email?: string | null;
  classIds?: string[];
}): Promise<Provisioned> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const userId = id("usr");
    const password = generateTempPassword();
    const hash = await hashPassword(password);

    await client.query(
      `INSERT INTO users (id, username, password_hash, role, full_name, email, school_id, must_change_password)
       VALUES ($1,$2,$3,'teacher',$4,$5,$6,true)`,
      [userId, input.username, hash, input.fullName, input.email ?? null, input.schoolId]
    );

    // Only classes in this school — a class id from elsewhere is silently
    // ignored rather than quietly linking a teacher across schools.
    for (const classId of input.classIds ?? []) {
      await client.query(
        `INSERT INTO class_teachers (class_id, teacher_user_id)
         SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM classes WHERE id = $1 AND school_id = $3)
         ON CONFLICT DO NOTHING`,
        [classId, userId, input.schoolId]
      );
    }

    await client.query("COMMIT");
    return { id: userId, username: input.username, password };
  } catch (e) {
    await client.query("ROLLBACK");
    if (isUnique(e, "users_username_key")) throw new ConflictError("That username is already taken.");
    if (isUnique(e, "users_email_key")) throw new ConflictError("That email is already in use.");
    throw e;
  } finally {
    client.release();
  }
}

export async function createStudent(input: {
  schoolId: string;
  classId: string;
  fullName: string;
  username: string;
}): Promise<Provisioned> {
  const userId = id("usr");
  const password = generateTempPassword();
  const hash = await hashPassword(password);
  try {
    // No email, ever — the schema enforces it too (D-03). Students recover
    // through their teacher, not an inbox.
    await getPool().query(
      `INSERT INTO users (id, username, password_hash, role, full_name, school_id, class_id, must_change_password)
       VALUES ($1,$2,$3,'student',$4,$5,$6,true)`,
      [userId, input.username, hash, input.fullName, input.schoolId, input.classId]
    );
    return { id: userId, username: input.username, password };
  } catch (e) {
    if (isUnique(e, "users_username_key")) throw new ConflictError("That username is already taken.");
    throw e;
  }
}

export async function createClass(input: {
  schoolId: string;
  name: string;
  level: number;
  academicYear: string;
}): Promise<{ id: string }> {
  const classId = id("cls");
  try {
    await getPool().query(
      `INSERT INTO classes (id, school_id, name, level, academic_year) VALUES ($1,$2,$3,$4,$5)`,
      [classId, input.schoolId, input.name, input.level, input.academicYear]
    );
    return { id: classId };
  } catch (e) {
    if (isUnique(e, "classes_name_key")) {
      throw new ConflictError(`This school already has a class called ${input.name} this year.`);
    }
    if (e instanceof Error && /classes_level_valid/.test(e.message)) {
      throw new ConflictError("Class level must be between 5 and 12.");
    }
    throw e;
  }
}

/** Assign a teacher to a class. Both must belong to the same school. */
export async function assignTeacher(classId: string, teacherUserId: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `INSERT INTO class_teachers (class_id, teacher_user_id)
     SELECT c.id, u.id
       FROM classes c JOIN users u ON u.id = $2
      WHERE c.id = $1 AND u.role = 'teacher' AND u.school_id = c.school_id
     ON CONFLICT DO NOTHING`,
    [classId, teacherUserId]
  );
  return (rowCount ?? 0) > 0;
}

export async function unassignTeacher(classId: string, teacherUserId: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    "DELETE FROM class_teachers WHERE class_id = $1 AND teacher_user_id = $2",
    [classId, teacherUserId]
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Disable or re-enable an account.
 *
 * Deliberately not a delete: progress, audit rows and issued certificates all
 * point at the person, and the schema refuses to remove someone who holds a
 * certificate. Disabling ends their access immediately — getCurrentUser
 * rejects a non-active user on the next request — while keeping the record.
 */
export async function setUserStatus(
  userId: string,
  status: "active" | "disabled"
): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const { rowCount } = await client.query(
      "UPDATE users SET status = $1, updated_at = now() WHERE id = $2",
      [status, userId]
    );
    if (status === "disabled") {
      // Ending access means ending it now, not when the cookie expires.
      await client.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    }
    await client.query("COMMIT");
    return (rowCount ?? 0) > 0;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** Rename a person. Usernames are not editable — they are how people sign in. */
export async function renameUser(userId: string, fullName: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    "UPDATE users SET full_name = $1, updated_at = now() WHERE id = $2",
    [fullName, userId]
  );
  return (rowCount ?? 0) > 0;
}

export interface ClassStudent {
  id: string;
  full_name: string;
  username: string;
  status: "active" | "disabled";
  last_login_at: string | null;
}

export function listClassStudents(classId: string): Promise<ClassStudent[]> {
  return getPool()
    .query(
      `SELECT id, full_name, username, status, last_login_at
         FROM users WHERE class_id = $1 AND role = 'student'
        ORDER BY full_name`,
      [classId]
    )
    .then((r) => r.rows as ClassStudent[]);
}

/**
 * Change a school's name, district or code.
 *
 * The SET list is built from the keys actually present, because COALESCE
 * cannot tell "leave this alone" from "clear this": passing null to
 * `COALESCE($1, district)` keeps the old value, so a district could be typed
 * in but never removed.
 */
export async function updateSchool(
  schoolId: string,
  patch: { name?: string; district?: string | null; code?: string | null }
): Promise<boolean> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const key of ["name", "district", "code"] as const) {
    if (patch[key] !== undefined) {
      values.push(patch[key]);
      sets.push(`${key} = $${values.length}`);
    }
  }
  if (!sets.length) return true; // nothing asked for is not a failure
  values.push(schoolId);
  try {
    const { rowCount } = await getPool().query(
      `UPDATE schools SET ${sets.join(", ")}, updated_at = now() WHERE id = $${values.length}`,
      values
    );
    return (rowCount ?? 0) > 0;
  } catch (e) {
    if (isUnique(e, "schools_name_key")) {
      throw new ConflictError("A school with that name already exists.");
    }
    if (isUnique(e, "schools_code_key")) {
      throw new ConflictError("A school with that code already exists.");
    }
    throw e;
  }
}

/**
 * Archive a school, or bring it back.
 *
 * Deliberately not a delete: classes reference the school with ON DELETE
 * RESTRICT, and behind them sit students, progress and issued certificates.
 *
 * Nobody's account is touched. Access is refused at the gate by reading the
 * school's status (see `accountUsable`), so restoring is exact — there is no
 * set of accounts to un-disable, and someone disabled before the school was
 * archived stays disabled after it comes back.
 */
export async function setSchoolStatus(
  schoolId: string,
  status: "active" | "archived"
): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const { rowCount } = await client.query(
      "UPDATE schools SET status = $1, updated_at = now() WHERE id = $2",
      [status, schoolId]
    );
    if (status === "archived") {
      // Ending access means ending it now, not when the cookies expire.
      await client.query(
        "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE school_id = $1)",
        [schoolId]
      );
    }
    await client.query("COMMIT");
    return (rowCount ?? 0) > 0;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export interface SchoolRow {
  id: string;
  name: string;
  district: string | null;
  code: string | null;
  is_demo: boolean;
  status: "active" | "archived";
  username: string;
  class_count: number;
  teacher_count: number;
  student_count: number;
}

/** Every school with its counts — the super admin's list. One query. */
export function listSchools(): Promise<SchoolRow[]> {
  return getPool()
    .query(
      `SELECT s.id, s.name, s.district, s.code, s.is_demo, s.status, u.username,
              (SELECT count(*)::int FROM classes c WHERE c.school_id = s.id) AS class_count,
              (SELECT count(*)::int FROM users t
                WHERE t.school_id = s.id AND t.role = 'teacher' AND t.status = 'active') AS teacher_count,
              (SELECT count(*)::int FROM users st
                WHERE st.school_id = s.id AND st.role = 'student' AND st.status = 'active') AS student_count
         FROM schools s JOIN users u ON u.id = s.user_id
        ORDER BY s.status, s.is_demo, s.name`
    )
    .then((r) => r.rows as SchoolRow[]);
}
