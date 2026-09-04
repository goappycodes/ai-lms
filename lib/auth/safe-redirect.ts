/**
 * Resolves the `?next=` parameter on the login page to a path we are willing
 * to send someone to after they sign in.
 *
 * Pattern-matching the string is not enough. `//evil.com` is the obvious
 * attack, but `/\evil.com` is the same attack and passes a `startsWith("//")`
 * check: URL parsing normalises a backslash in the authority position, so both
 * resolve to a different origin. So does `/\/evil.com`.
 *
 * That matters here more than usual. A link like
 * `…/login?next=/\evil.com` sent to a child leads to a real sign-in, then a
 * redirect to a page that can imitate it and ask for the password again.
 *
 * Rather than enumerate the tricks, resolve the candidate and check where it
 * actually lands.
 */
export function safeRedirect(next: string | null | undefined, origin: string, fallback: string): string {
  if (!next) return fallback;
  try {
    const url = new URL(next, origin);
    if (url.origin !== new URL(origin).origin) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
