import { createHash, randomBytes } from "node:crypto";
import { getPool } from "./pg";
import { id } from "@/lib/ids";
import type { Role } from "@/lib/auth/token";

// Users, sessions and the audit trail. Node runtime only — the Edge middleware
// never reaches this file.
async function all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await getPool().query(sql, params);
  return rows as T[];
}
async function one<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const { rows } = await getPool().query(sql, params);
  return rows[0] as T | undefined;
}
async function run(sql: string, params: unknown[] = []): Promise<number> {
  const { rowCount } = await getPool().query(sql, params);
  return rowCount ?? 0;
}

export interface User {
  id: string;
  username: string;
  password_hash: string;
  role: Role;
  full_name: string;
  email: string | null;
  school_id: string | null;
  class_id: string | null;
  status: "active" | "disabled";
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

/** What the app passes around. Never carries the password hash. */
export type SafeUser = Omit<User, "password_hash">;

export function toSafeUser(u: User): SafeUser {
  const { password_hash: _ignored, ...rest } = u;
  return rest;
}

// ----------------------------------------------------------------- users ----
export function findUserByUsername(username: string): Promise<User | undefined> {
  return one<User>("SELECT * FROM users WHERE lower(username) = lower($1)", [username]);
}
export function findUserById(uid: string): Promise<User | undefined> {
  return one<User>("SELECT * FROM users WHERE id = $1", [uid]);
}

export async function createUser(input: {
  username: string;
  passwordHash: string;
  role: Role;
  fullName: string;
  email?: string | null;
  schoolId?: string | null;
  classId?: string | null;
  mustChangePassword?: boolean;
}): Promise<User> {
  const uid = id("usr");
  await run(
    `INSERT INTO users (id, username, password_hash, role, full_name, email, school_id, class_id, must_change_password)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      uid,
      input.username,
      input.passwordHash,
      input.role,
      input.fullName,
      input.email ?? null,
      input.schoolId ?? null,
      input.classId ?? null,
      input.mustChangePassword ?? false,
    ]
  );
  return (await findUserById(uid))!;
}

export function touchLastLogin(uid: string): Promise<number> {
  return run("UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1", [uid]);
}

export function setPasswordHash(
  uid: string,
  passwordHash: string,
  mustChange: boolean
): Promise<number> {
  return run(
    "UPDATE users SET password_hash = $1, must_change_password = $2, updated_at = now() WHERE id = $3",
    [passwordHash, mustChange, uid]
  );
}

// -------------------------------------------------------------- sessions ----
const SESSION_DAYS = 30;

/**
 * The cookie carries a random token; the table stores only its hash.
 *
 * A leaked database backup then hands over no usable sessions — the same
 * reasoning as not storing plaintext passwords, applied to the thing that
 * bypasses passwords entirely.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SessionRow {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

export async function createSession(
  userId: string,
  days = SESSION_DAYS
): Promise<{ sessionId: string; token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const sessionId = hashToken(token);
  const expiresAt = new Date(Date.now() + days * 86_400_000);
  await run("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1,$2,$3)", [
    sessionId,
    userId,
    expiresAt.toISOString(),
  ]);
  return { sessionId, token, expiresAt };
}

/** The session row if it exists and has not expired. */
export function getLiveSession(sessionId: string): Promise<SessionRow | undefined> {
  return one<SessionRow>("SELECT * FROM sessions WHERE id = $1 AND expires_at > now()", [
    sessionId,
  ]);
}

export function destroySession(sessionId: string): Promise<number> {
  return run("DELETE FROM sessions WHERE id = $1", [sessionId]);
}

/** Used when a password changes: every other device is signed out. */
export function destroyAllSessionsFor(userId: string): Promise<number> {
  return run("DELETE FROM sessions WHERE user_id = $1", [userId]);
}

export function purgeExpiredSessions(): Promise<number> {
  return run("DELETE FROM sessions WHERE expires_at <= now()");
}

// ----------------------------------------------------------------- audit ----
export async function audit(input: {
  actorUserId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  detail?: Record<string, unknown> | null;
}): Promise<void> {
  await run(
    `INSERT INTO audit_log (id, actor_user_id, action, target_type, target_id, detail)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      id("aud"),
      input.actorUserId ?? null,
      input.action,
      input.targetType ?? null,
      input.targetId ?? null,
      input.detail ? JSON.stringify(input.detail) : null,
    ]
  );
}

// --------------------------------------------------------- rate limiting ----
export const LOGIN_WINDOW_MINUTES = 15;
export const LOGIN_MAX_FAILURES = 10;

/**
 * Counts failed sign-ins that matter right now: inside the time window, and
 * since this account last signed in successfully.
 *
 * Read from `audit_log` rather than an in-memory counter because serverless
 * has no single process to hold one — an attacker spread across instances
 * would never trip it. Failures are audited anyway, so this costs one indexed
 * read on a path that is rare by design.
 *
 * The `last_login_at` bound is what clears a lockout, and it is deliberately
 * NOT done by deleting the failed-attempt rows. An audit log you delete from
 * is not an audit log: erasing failures on success would let someone who
 * eventually guessed a password wipe the evidence of guessing. Unknown
 * usernames have no row, so `-infinity` leaves just the time window.
 */
export async function recentLoginFailures(username: string): Promise<number> {
  const r = await one<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM audit_log a
      WHERE a.action = 'auth.login_failed'
        AND a.target_type = 'username'
        AND a.target_id = lower($1)
        AND a.created_at > now() - ($2 || ' minutes')::interval
        AND a.created_at > COALESCE(
              (SELECT u.last_login_at FROM users u WHERE lower(u.username) = lower($1)),
              '-infinity'::timestamptz)`,
    [username, String(LOGIN_WINDOW_MINUTES)]
  );
  return r?.n ?? 0;
}

export function listUsersBySchool(schoolId: string, role?: Role): Promise<SafeUser[]> {
  return role
    ? all<SafeUser>(
        `SELECT id, username, role, full_name, email, school_id, class_id, status,
                must_change_password, last_login_at, created_at, updated_at
           FROM users WHERE school_id = $1 AND role = $2 ORDER BY full_name`,
        [schoolId, role]
      )
    : all<SafeUser>(
        `SELECT id, username, role, full_name, email, school_id, class_id, status,
                must_change_password, last_login_at, created_at, updated_at
           FROM users WHERE school_id = $1 ORDER BY role, full_name`,
        [schoolId]
      );
}
