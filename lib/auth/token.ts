/**
 * The session cookie: a small signed payload, verifiable without a database.
 *
 * Next.js middleware runs on the Edge runtime, where `pg` does not exist. If
 * the cookie carried only an opaque session id, every page load would need a
 * database round trip before it could even decide where to send someone —
 * exactly the per-request query D-13 exists to avoid.
 *
 * So the cookie carries the few facts routing needs (who, what role, until
 * when) signed with HMAC-SHA256, and the middleware verifies that signature at
 * the edge with no I/O at all.
 *
 * The signature proves the payload has not been tampered with. It does NOT
 * prove the session is still valid — a signed-out or revoked session still has
 * a valid signature until it expires. Revocation is checked against the
 * `sessions` table in the Node layer, on every request that does real work.
 * See lib/auth/current.ts.
 *
 * Web Crypto only, so this one module works in both runtimes.
 */

export type Role = "super_admin" | "school" | "teacher" | "student";

export interface SessionClaims {
  /** Session id — the primary key of the `sessions` row. */
  sid: string;
  /** User id. */
  uid: string;
  role: Role;
  /** Expiry, seconds since epoch. */
  exp: number;
}

export const SESSION_COOKIE = "aiveda_session";

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(pad);
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    // Loud, not silent. A default secret would mean anyone who reads this
    // repository can mint a super-admin cookie.
    throw new Error(
      "SESSION_SECRET is not set (or is too short). Generate one with: openssl rand -base64 32"
    );
  }
  return s;
}

let keyPromise: Promise<CryptoKey> | null = null;
function hmacKey(): Promise<CryptoKey> {
  // Cached per runtime instance: importKey is not free and this runs on every
  // request that carries a cookie.
  keyPromise ??= crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  return keyPromise;
}

/** `<payload>.<signature>`, both base64url. */
export async function signSession(claims: SessionClaims): Promise<string> {
  const payload = b64urlEncode(enc.encode(JSON.stringify(claims)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(payload));
  return `${payload}.${b64urlEncode(new Uint8Array(sig))}`;
}

/**
 * Returns the claims when the signature is valid and the token has not
 * expired, otherwise null. Never throws on malformed input: a mangled cookie
 * is a signed-out visitor, not a server error.
 */
export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;

    // crypto.subtle.verify is constant-time, so a forged signature cannot be
    // narrowed down by timing the response.
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      b64urlDecode(sig),
      enc.encode(payload)
    );
    if (!ok) return null;

    const claims = JSON.parse(dec.decode(b64urlDecode(payload))) as SessionClaims;
    if (!claims?.sid || !claims?.uid || !claims?.role) return null;
    if (typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}
