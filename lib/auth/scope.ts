import { getPool } from "@/lib/db/pg";
import type { SafeUser } from "@/lib/db/users";

/**
 * Who may act on which school, class or person.
 *
 * Role alone is not enough here. A school may add teachers — but only its own.
 * A teacher may add students — but only to a class they teach. Checking the
 * role in each route and then trusting the id in the URL is how one school
 * ends up editing another's roster, and it is the kind of hole that never
 * shows up in a happy-path test.
 *
 * So every provisioning route asks one of these instead, and the answer always
 * involves the actor's own school or class assignments, never just their role.
 *
 * The rules mirror §2 of the brief:
 *
 *   super_admin   everything
 *   school        anything inside its own school
 *   teacher       the classes they are assigned to, and students in them
 *   student       nothing
 */
export type Allow = { ok: true } | { ok: false; status: 403 | 404; error: string };

const ALLOWED: Allow = { ok: true };
const DENIED: Allow = { ok: false, status: 403, error: "Not allowed" };
const MISSING = (what: string): Allow => ({ ok: false, status: 404, error: `${what} not found` });

async function one<T>(sql: string, params: unknown[]): Promise<T | undefined> {
  const { rows } = await getPool().query(sql, params);
  return rows[0] as T | undefined;
}

/** May the actor administer this school as a whole? */
export function canManageSchool(actor: SafeUser, schoolId: string): Allow {
  if (actor.role === "super_admin") return ALLOWED;
  if (actor.role === "school" && actor.school_id === schoolId) return ALLOWED;
  return DENIED;
}

/**
 * Is this school still taking new people?
 *
 * Separate from authority on purpose. A teacher has no authority over their
 * school as a whole, but may still add a student to their own class — so the
 * routes that authorise through a class ask this on its own, while the
 * school-level ones get it bundled into canProvisionInSchool below.
 *
 * Anyone added to an archived school could not sign in — the gate reads the
 * school's status — so accepting the row would only look like it worked.
 */
export async function schoolIsOpen(schoolId: string): Promise<Allow> {
  const school = await one<{ status: string }>("SELECT status FROM schools WHERE id = $1", [
    schoolId,
  ]);
  if (!school) return MISSING("School");
  if (school.status === "archived") {
    return { ok: false, status: 403, error: "This school is archived. Restore it first." };
  }
  return ALLOWED;
}

/** May the actor create or edit classes, teachers and students in this school? */
export async function canProvisionInSchool(
  actor: SafeUser,
  schoolId: string
): Promise<Allow> {
  const allowed = canManageSchool(actor, schoolId);
  return allowed.ok ? schoolIsOpen(schoolId) : allowed;
}

/**
 * May the actor act on this class?
 *
 * Teachers are included, because adding a student to your own class is a
 * teacher's job. The check is against `class_teachers`, not against the
 * teacher's school, so a teacher cannot reach a class in their school that
 * they do not actually teach.
 */
export async function canManageClass(actor: SafeUser, classId: string): Promise<Allow> {
  if (actor.role === "super_admin") return ALLOWED;
  if (actor.role === "student") return DENIED;

  const row = await one<{ school_id: string; teaches: boolean }>(
    `SELECT c.school_id,
            EXISTS (SELECT 1 FROM class_teachers ct
                     WHERE ct.class_id = c.id AND ct.teacher_user_id = $2) AS teaches
       FROM classes c WHERE c.id = $1`,
    [classId, actor.id]
  );
  if (!row) return MISSING("Class");

  if (actor.role === "school") {
    return row.school_id === actor.school_id ? ALLOWED : DENIED;
  }
  // teacher
  return row.teaches ? ALLOWED : DENIED;
}

/**
 * May the actor act on this person — rename, disable, reset their password?
 *
 * Follows the same one-step-up shape as the reset chain (D-04): a teacher
 * reaches their own students, a school reaches its teachers and students, a
 * super admin reaches anyone. Nobody reaches sideways.
 */
export async function canManageUser(actor: SafeUser, targetUserId: string): Promise<Allow> {
  if (actor.role === "student") return DENIED;
  // Acting on yourself is not provisioning; it has its own routes.
  if (actor.id === targetUserId) return DENIED;

  const target = await one<{ role: string; school_id: string | null; class_id: string | null }>(
    "SELECT role, school_id, class_id FROM users WHERE id = $1",
    [targetUserId]
  );
  if (!target) return MISSING("User");

  if (actor.role === "super_admin") return ALLOWED;

  if (actor.role === "school") {
    if (target.school_id !== actor.school_id) return DENIED;
    // A school manages its teachers and students, not another school account.
    return target.role === "teacher" || target.role === "student" ? ALLOWED : DENIED;
  }

  // A teacher reaches only students, and only in a class they teach.
  if (target.role !== "student" || !target.class_id) return DENIED;
  const teaches = await one<{ ok: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM class_teachers
                     WHERE class_id = $1 AND teacher_user_id = $2) AS ok`,
    [target.class_id, actor.id]
  );
  return teaches?.ok ? ALLOWED : DENIED;
}

/**
 * The school an actor is working in, given an optional explicit id.
 *
 * A school account never has to name its own school, and must not be able to
 * name another. A super admin has no school, so it has to say which.
 */
export function resolveSchoolId(
  actor: SafeUser,
  requested?: string | null
): { ok: true; schoolId: string } | { ok: false; status: 400 | 403; error: string } {
  if (actor.role === "super_admin") {
    if (!requested) return { ok: false, status: 400, error: "schoolId is required" };
    return { ok: true, schoolId: requested };
  }
  if (actor.role !== "school" || !actor.school_id) {
    return { ok: false, status: 403, error: "Not allowed" };
  }
  if (requested && requested !== actor.school_id) {
    return { ok: false, status: 403, error: "Not allowed" };
  }
  return { ok: true, schoolId: actor.school_id };
}
