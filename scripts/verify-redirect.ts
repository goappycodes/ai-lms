// The login page's ?next= handling. Pure function, no server needed.
//   npm run verify:redirect
import { safeRedirect } from "../lib/auth/safe-redirect.ts";

const ORIGIN = "https://aiveda.example";
const FALLBACK = "/learning";
let pass = 0;
let fail = 0;
const check = (name: string, got: string, want: string) =>
  got === want ? (pass++, console.log(`  ✓ ${name}`)) : (fail++, console.log(`  ✗ ${name}\n      got ${got}, expected ${want}`));

console.log("Paths we should follow");
check("a plain path", safeRedirect("/admin", ORIGIN, FALLBACK), "/admin");
check("a path with a query", safeRedirect("/learn/explorer?x=1", ORIGIN, FALLBACK), "/learn/explorer?x=1");
check("a nested path", safeRedirect("/admin/studio/crs_1", ORIGIN, FALLBACK), "/admin/studio/crs_1");
check("our own absolute URL, reduced to its path", safeRedirect(`${ORIGIN}/teacher`, ORIGIN, FALLBACK), "/teacher");

console.log("\nAttempts to leave the site — every one must fall back");
for (const attack of [
  "//evil.com",
  "/\\evil.com",          // backslash normalises to a slash in the authority
  "/\\/evil.com",
  "https://evil.com",
  "http://evil.com/steal",
  "//evil.com/login?next=/admin",
  "\\\\evil.com",
  "javascript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  " //evil.com",
]) {
  check(`rejects ${JSON.stringify(attack)}`, safeRedirect(attack, ORIGIN, FALLBACK), FALLBACK);
}

console.log("\nMissing or unusable values");
check("null", safeRedirect(null, ORIGIN, FALLBACK), FALLBACK);
check("undefined", safeRedirect(undefined, ORIGIN, FALLBACK), FALLBACK);
check("empty string", safeRedirect("", ORIGIN, FALLBACK), FALLBACK);

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
