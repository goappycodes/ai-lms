import { cache } from "react";
import { getPool } from "./pg";

// Reads that turn a session into the facts a screen needs: which school, which
// class, which course. All of these exist in the database now, so nothing here
// is mock — unlike progress, which does not have real rows yet.
async function all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await getPool().query(sql, params);
  return rows as T[];
}
async function one<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const { rows } = await getPool().query(sql, params);
  return rows[0] as T | undefined;
}

export interface UserContext {
  school_name: string | null;
  school_district: string | null;
  class_name: string | null;
  class_level: number | null;
  /** The course this student's class level maps to, via course_levels. */
  course_slug: string | null;
}

/**
 * School, class and course for one person, in a single query.
 *
 * The course is derived rather than stored: `classes.level` maps through
 * `course_levels`, so a class-9 student sees Builder without anyone having to
 * enrol them, and the mapping cannot drift out of step with the class.
 */
export function getUserContext(userId: string): Promise<UserContext | undefined> {
  return one<UserContext>(
    `SELECT s.name       AS school_name,
            s.district   AS school_district,
            c.name       AS class_name,
            c.level      AS class_level,
            co.slug      AS course_slug
       FROM users u
       LEFT JOIN schools s       ON s.id  = u.school_id
       LEFT JOIN classes c       ON c.id  = u.class_id
       LEFT JOIN course_levels l ON l.level = c.level
       LEFT JOIN courses co      ON co.id = l.course_id
      WHERE u.id = $1`,
    [userId]
  );
}

export interface TeacherClass {
  id: string;
  name: string;
  level: number;
  academic_year: string;
  course_slug: string | null;
  student_count: number;
}

/** The classes one teacher is assigned to, with how many students are in each. */
export function getTeacherClasses(teacherUserId: string): Promise<TeacherClass[]> {
  return all<TeacherClass>(
    `SELECT c.id, c.name, c.level, c.academic_year,
            co.slug AS course_slug,
            (SELECT count(*)::int FROM users st
              WHERE st.class_id = c.id AND st.role = 'student' AND st.status = 'active') AS student_count
       FROM class_teachers ct
       JOIN classes c            ON c.id = ct.class_id
       LEFT JOIN course_levels l ON l.level = c.level
       LEFT JOIN courses co      ON co.id = l.course_id
      WHERE ct.teacher_user_id = $1
      ORDER BY c.level, c.name`,
    [teacherUserId]
  );
}

export interface SchoolOverview {
  id: string;
  name: string;
  district: string | null;
  code: string | null;
  status: "active" | "archived";
  class_count: number;
  teacher_count: number;
  student_count: number;
}

/**
 * Deduplicated per render: /school asks for the heading and SchoolDashboard
 * asks again for the counts, and /admin/schools/[id] does the same. Both are
 * reasonable on their own; together they were two identical round trips.
 */
export const getSchoolOverview = cache((schoolId: string): Promise<SchoolOverview | undefined> => {
  return one<SchoolOverview>(
    `SELECT s.id, s.name, s.district, s.code, s.status,
            (SELECT count(*)::int FROM classes c WHERE c.school_id = s.id) AS class_count,
            (SELECT count(*)::int FROM users u
              WHERE u.school_id = s.id AND u.role = 'teacher' AND u.status = 'active') AS teacher_count,
            (SELECT count(*)::int FROM users u
              WHERE u.school_id = s.id AND u.role = 'student' AND u.status = 'active') AS student_count
       FROM schools s WHERE s.id = $1`,
    [schoolId]
  );
});

export interface SchoolClass extends TeacherClass {
  teacher_names: string[];
}

/** Every class in a school, with its teachers and student count. */
export function getSchoolClasses(schoolId: string): Promise<SchoolClass[]> {
  return all<SchoolClass>(
    `SELECT c.id, c.name, c.level, c.academic_year,
            co.slug AS course_slug,
            (SELECT count(*)::int FROM users st
              WHERE st.class_id = c.id AND st.role = 'student' AND st.status = 'active') AS student_count,
            COALESCE(
              (SELECT array_agg(t.full_name ORDER BY t.full_name)
                 FROM class_teachers ct JOIN users t ON t.id = ct.teacher_user_id
                WHERE ct.class_id = c.id),
              '{}') AS teacher_names
       FROM classes c
       LEFT JOIN course_levels l ON l.level = c.level
       LEFT JOIN courses co      ON co.id = l.course_id
      WHERE c.school_id = $1
      ORDER BY c.level, c.name`,
    [schoolId]
  );
}

export interface SchoolTeacher {
  id: string;
  full_name: string;
  username: string;
  email: string | null;
  last_login_at: string | null;
  class_count: number;
}

export function getSchoolTeachers(schoolId: string): Promise<SchoolTeacher[]> {
  return all<SchoolTeacher>(
    `SELECT u.id, u.full_name, u.username, u.email, u.last_login_at,
            (SELECT count(*)::int FROM class_teachers ct WHERE ct.teacher_user_id = u.id) AS class_count
       FROM users u
      WHERE u.school_id = $1 AND u.role = 'teacher' AND u.status = 'active'
      ORDER BY u.full_name`,
    [schoolId]
  );
}
