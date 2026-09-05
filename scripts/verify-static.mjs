// Which routes are prerendered, asserted against the build rather than hoped for.
//
//   NEXT_DIST_DIR=.next-verify next build && node scripts/verify-static.mjs
//
// /login is the only page every student loads and the only one all of them
// load, so at a hundred thousand students it is the most-requested thing we
// serve. Prerendered it costs the origin nothing. It is one `cookies()` call
// away from silently becoming a per-request render again, and nothing else in
// the suite would notice — hence this.
import fs from "node:fs";
import path from "node:path";

const dist = process.env.NEXT_DIST_DIR || ".next-verify";
const manifestPath = path.join(dist, "prerender-manifest.json");

let pass = 0;
let fail = 0;
const check = (name, got, want) => {
  if (got === want) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}\n      got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
  }
};

console.log(`Prerendering, from ${manifestPath}\n`);

if (!fs.existsSync(manifestPath)) {
  console.log(`  ✗ no build found at ${dist} — run the build first`);
  process.exit(1);
}
const routes = Object.keys(JSON.parse(fs.readFileSync(manifestPath, "utf8")).routes ?? {});

check("/login is prerendered, not rendered per request", routes.includes("/login"), true);
check(
  "...and the HTML really exists on disk",
  fs.existsSync(path.join(dist, "server/app/login.html")),
  true
);

// The form has to be in that HTML. It sits inside a Suspense boundary because
// it reads ?next=, and a client component that bails out of prerendering would
// leave the card empty until JavaScript arrives — on the slow phones this is
// all for, that is the whole page missing.
const html = fs.readFileSync(path.join(dist, "server/app/login.html"), "utf8");
for (const [what, pattern] of [
  ["the username field", /name="username"/],
  ["the password field", /name="password"/],
  ["the submit button", /type="submit"/],
  ["the footer", /site-footer/],
]) {
  check(`${what} is in the prerendered HTML`, pattern.test(html), true);
}

// Pages that must NOT be prerendered: every one of them renders something
// specific to the person asking, and a shared cache would hand one student
// another's page.
for (const perUser of ["/learning", "/school", "/teacher", "/admin", "/admin/schools", "/"]) {
  check(`${perUser} is not prerendered (it is per-user)`, routes.includes(perUser), false);
}

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
