import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// promisify() resolves to scrypt's three-argument overload and drops the
// options parameter, so the cost settings would be silently ignored. Wrapped
// by hand to keep them.
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, key) =>
      err ? reject(err) : resolve(key as Buffer)
    );
  });
}

/**
 * Password hashing on Node's built-in scrypt.
 *
 * docs/SCHEMA.md said Argon2id, which is the better algorithm on paper. Both
 * the `argon2` and `bcrypt` packages need a native build, which does not
 * survive Vercel's serverless bundling without work, and `bcryptjs` is slow
 * pure JS that silently truncates passwords at 72 bytes.
 *
 * scrypt is memory-hard, in the standard library, needs no dependency at all
 * (D-12), and behaves identically on the encoder machine and on Vercel. The
 * stored format is versioned, so moving to Argon2id later is a matter of
 * verifying the old prefix and rehashing on next sign-in.
 */

// N=2^15 with r=8 costs 32 MB and ~110 ms per hash on this machine.
//
// OWASP suggests more, but that guidance assumes a long-lived server. Each
// concurrent sign-in holds its 32 MB inside a serverless function, so a higher
// cost trades a marginal security gain for login failures during a whole class
// signing in at once. 110 ms is comfortably slow enough against offline
// cracking while leaving headroom.
const PARAMS = { N: 2 ** 15, r: 8, p: 1 } as const;
const MAXMEM = 128 * 1024 * 1024; // Node's 32 MB default is below what N=2^15 needs.
const KEY_LEN = 64;
const SALT_LEN = 16;

/** `scrypt$N$r$p$salt$key`, all base64url. The prefix is the version. */
export async function hashPassword(password: string): Promise<string> {
  assertUsable(password);
  const salt = randomBytes(SALT_LEN);
  const key = await scryptAsync(password.normalize("NFKC"), salt, KEY_LEN, {
    ...PARAMS,
    maxmem: MAXMEM,
  });
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

/**
 * Verifies a password against a stored hash. Never throws on a malformed
 * hash — a corrupt row must read as "wrong password", not as a 500 that tells
 * an attacker the account exists.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, n, r, p, saltB64, keyB64] = stored.split("$");
    if (scheme !== "scrypt") return false;

    const salt = Buffer.from(saltB64, "base64url");
    const expected = Buffer.from(keyB64, "base64url");
    if (!salt.length || !expected.length) return false;

    const actual = await scryptAsync(password.normalize("NFKC"), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: MAXMEM,
    });

    // Constant time: a length check first, because timingSafeEqual throws on
    // mismatched lengths and that throw would itself be a timing signal.
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * True when a stored hash was made with weaker parameters than we now use.
 * Call after a successful sign-in and rehash if so — that is how cost gets
 * raised without forcing anyone to reset a password.
 */
export function needsRehash(stored: string): boolean {
  const [scheme, n, r, p] = stored.split("$");
  if (scheme !== "scrypt") return true;
  return Number(n) < PARAMS.N || Number(r) < PARAMS.r || Number(p) < PARAMS.p;
}

// Deliberately excludes 0/O, 1/l/I and similar. A teacher reads temporary
// passwords aloud to a child (D-04); a character that cannot be told apart
// when spoken or written turns one reset into three.
const SAY_SAFE = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * A temporary password for the reset chain. Grouped for dictation:
 * `kfp7-mq3x-9wtn`.
 */
export function generateTempPassword(groups = 3, size = 4): string {
  const bytes = randomBytes(groups * size);
  const chars = Array.from(bytes, (b) => SAY_SAFE[b % SAY_SAFE.length]);
  return Array.from({ length: groups }, (_, i) =>
    chars.slice(i * size, (i + 1) * size).join("")
  ).join("-");
}

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

function assertUsable(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  // scrypt has no bcrypt-style truncation, but an unbounded password is a cheap
  // way to make the server do 32 MB of work per request.
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password must be at most ${MAX_PASSWORD_LENGTH} characters.`);
  }
}
