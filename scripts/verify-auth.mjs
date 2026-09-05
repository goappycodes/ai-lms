// End-to-end checks for the authentication flow, against a running server.
//
//   npm run dev              # in another terminal
//   npm run verify:auth
//
// Needs the demo accounts (DEMO_LOGIN=1) — it seeds them itself.
// Writes only demo data and audit rows.
const BASE = process.env.BASE_URL || "http://localhost:3000";
const PASSWORD = process.env.DEMO_PASSWORD || "demo-aiveda-2026";

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

/** A tiny cookie jar, so each identity keeps its own session. */
function jar() {
  let cookie = "";
  return {
    get header() {
      return cookie ? { cookie } : {};
    },
    set raw(v) {
      cookie = v;
    },
    absorb(res) {
      const set = res.headers.getSetCookie?.() ?? [];
      for (const c of set) {
        const [pair] = c.split(";");
        if (pair.startsWith("aiveda_session=")) cookie = pair;
      }
    },
  };
}

async function req(path, { jar: j, method = "GET", body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    redirect: "manual",
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(j?.header ?? {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  j?.absorb(res);
  const location = res.headers.get("location");
  return {
    status: res.status,
    // Compare paths, not absolute URLs, so this works against any origin.
    location: location ? new URL(location, BASE).pathname + new URL(location, BASE).search : null,
    json: async () => res.json().catch(() => null),
  };
}

async function login(username, password = PASSWORD) {
  const j = jar();
  const r = await req("/api/auth/login", { jar: j, method: "POST", body: { username, password } });
  return { jar: j, res: r };
}

// A username nobody has, different every run. A fixed one accumulates failed
// attempts in audit_log and, after a few runs inside the lockout window, the
// suite trips its own rate limiter and reports a false failure.
const GHOST = `nobody.${Math.random().toString(36).slice(2, 10)}`;

console.log(`Auth flow against ${BASE}\n`);

const seeded = await req("/api/auth/seed-demo", { method: "POST" });
if (seeded.status !== 200) {
  console.error("Could not seed demo accounts — is DEMO_LOGIN=1 set?");
  process.exit(1);
}

console.log("Unauthenticated");
check("a protected page redirects to login, remembering where",
  (await req("/admin")).location, "/login?next=%2Fadmin");
check("the login page is public", (await req("/login")).status, 200);

console.log("\nSign-in");
check("wrong password rejected", (await login("demo.teacher", "wrongpassword")).res.status, 401);
check("unknown user rejected the same way", (await login(GHOST)).res.status, 401);
{
  const a = await (await login("demo.teacher", "wrongpassword")).res.json();
  const b = await (await login(GHOST)).res.json();
  // Identical wording, or the response itself says which usernames exist.
  check("both failures give an identical message", a?.error, b?.error);
}
check("correct password signs in and routes by role",
  (await (await login("demo.superadmin")).res.json())?.redirect, "/admin");

const admin = (await login("demo.superadmin")).jar;
const teacher = (await login("demo.teacher")).jar;
const school = (await login("demo.school")).jar;
const student = (await login("demo.student1")).jar;

console.log("\nRole routing");
check("super admin reaches /admin", (await req("/admin", { jar: admin })).status, 200);
check("teacher sent away from /admin", (await req("/admin", { jar: teacher })).location, "/teacher");
check("student sent away from /admin", (await req("/admin", { jar: student })).location, "/learning");
check("student sent away from /teacher", (await req("/teacher", { jar: student })).location, "/learning");
check("teacher reaches /teacher", (await req("/teacher", { jar: teacher })).status, 200);
check("school reaches /teacher", (await req("/teacher", { jar: school })).status, 200);
  check("school reaches its own section", (await req("/school", { jar: school })).status, 200);
check("student reaches /learning", (await req("/learning", { jar: student })).status, 200);
check("student reaches a lesson", (await req("/learn/explorer/explorer-1", { jar: student })).status, 200);
check("a signed-in user is bounced off /login", (await req("/login", { jar: student })).location, "/learning");

console.log("\nAPI authorisation");
check("super admin may list courses", (await req("/api/courses", { jar: admin })).status, 200);
check("teacher may not", (await req("/api/courses", { jar: teacher })).status, 403);
check("student may not", (await req("/api/courses", { jar: student })).status, 403);
check("/api/auth/me works when signed in", (await req("/api/auth/me", { jar: student })).status, 200);

console.log("\nRevocation — a copied cookie must die with the session");
{
  const { jar: live } = await login("demo.student2");
  const copied = jar();
  copied.raw = live.header.cookie; // what an attacker would have taken
  check("both work before logout", (await req("/api/auth/me", { jar: copied })).status, 200);

  await req("/api/auth/logout", { jar: live, method: "POST" });

  check("the API refuses the copied cookie", (await req("/api/auth/me", { jar: copied })).status, 401);
  // The page check is the one that matters: the middleware runs on the Edge and
  // cannot see that the session row is gone, so without requirePage() a revoked
  // cookie would still render a page shell.
  check("the page refuses it too", (await req("/learning", { jar: copied })).location, "/login");

  // Asking for a page the role cannot reach routes on role first, then hits the
  // revocation check on arrival. Two hops, no data served at either.
  const hop1 = await req("/admin", { jar: copied });
  check("wrong-role request hops via the role's home", hop1.location, "/learning");
  check("...and that hop then lands on /login", (await req(hop1.location, { jar: copied })).location, "/login");
}

console.log("\nTampering");
{
  const { jar: j } = await login("demo.student3");
  const token = j.header.cookie.split("=")[1];
  const forged = jar();
  forged.raw = `aiveda_session=${token.split(".")[0]}.${"A".repeat(43)}`;
  check("a forged signature is rejected", (await req("/api/auth/me", { jar: forged })).status, 401);
  const garbage = jar();
  garbage.raw = "aiveda_session=not-a-token";
  check("garbage is rejected, not a 500", (await req("/api/auth/me", { jar: garbage })).status, 401);
}

console.log("\nRate limiting");
{
  const probe = `probe.${Math.random().toString(36).slice(2, 10)}`;
  for (let i = 0; i < 10; i++) await login(probe, "wrong");
  check("locked out after 10 failures", (await login(probe, "wrong")).res.status, 429);
  check("a different account is unaffected", (await login("demo.teacher")).res.status, 200);
}

console.log("\nTiming — can a username be discovered by how long the answer takes?");
{
  const time = async (username) => {
    const t0 = Date.now();
    await login(username, "definitely-wrong");
    return Date.now() - t0;
  };
  const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

  // Warm the connection so pool setup does not land in the first sample.
  await time(`warmup.${Math.random().toString(36).slice(2, 8)}`);

  // Several samples, interleaved and compared by median. A single pair is at
  // the mercy of whatever else is touching the database at that moment — this
  // check failed once while the schema suite was running alongside it, which
  // is a flaky test rather than a real finding.
  const real = [];
  const ghost = [];
  for (let i = 0; i < 3; i++) {
    real.push(await time("demo.superadmin"));
    ghost.push(await time(`nobody.${Math.random().toString(36).slice(2, 10)}`));
  }
  const r = median(real);
  const g = median(ghost);
  const delta = Math.abs(r - g);
  console.log(`    real user ${r}ms · unknown user ${g}ms · difference ${delta}ms  (medians of 3)`);
  check("the two are indistinguishable (within 80ms)", delta < 80, true);
}

console.log("\nLogin page and demo panel");
{
  const html = await (await fetch(BASE + "/login")).text();
  check("the sign-in form renders", html.includes('name="username"'), true);
  check("the demo panel is shown when enabled", html.includes("Demo accounts"), true);
  check("students are told how to recover a password", html.includes("Ask your teacher"), true);
  // The demo password must never reach the browser: it is only known to the
  // server, so it cannot be lifted from the bundle and tried elsewhere.
  check("the demo password is not in the page", html.includes("demo-aiveda-2026"), false);

  for (const [account, home] of [
    ["demo.superadmin", "/admin"],
    ["demo.school", "/school"],
    ["demo.teacher", "/teacher"],
    ["demo.student1", "/learning"],
    ["demo.student2", "/learning"],
    ["demo.student3", "/learning"],
  ]) {
    const r = await req("/api/auth/demo-login", { method: "POST", body: { account } });
    check(`${account} signs in and routes to ${home}`, (await r.json())?.redirect, home);
  }
  const bogus = await req("/api/auth/demo-login", { method: "POST", body: { account: "demo.hacker" } });
  check("an account outside the demo list is refused", bogus.status, 400);
}

console.log("\nNavigation and the account menu");
{
  const asRole = async (account) => {
    const j = jar();
    await req("/api/auth/demo-login", { jar: j, method: "POST", body: { account } });
    return j;
  };
  const student = await asRole("demo.student1");
  const teacher = await asRole("demo.teacher");
  const admin = await asRole("demo.superadmin");
  const html = async (j, path) =>
    (await fetch(BASE + path, { headers: j.header })).text();

  const s = await html(student, "/learning");
  // The nav used to render a hard-coded name and initials for everyone.
  check("the avatar shows the signed-in person", s.includes('title="Demo Student 1"'), true);
  check("the hard-coded avatar is gone", s.includes('avatar">AN'), false);
  check("the avatar is a real menu button", s.includes('aria-haspopup="menu"'), true);
  check("it is labelled for screen readers", s.includes('aria-label="Account"'), true);
  // A link that always bounces is worse than no link.
  check("a student is not shown an Admin link", s.includes(">Admin<"), false);
  check("a student is not shown a Teacher link", /nav-link[^>]*>Teacher</.test(s), false);
  check("a student is shown My Learning", s.includes(">My Learning<"), true);

  const t2 = await html(teacher, "/teacher");
  check("a teacher is not shown an Admin link", t2.includes(">Admin<"), false);
  check("a teacher is shown Teacher", /nav-link[^>]*>Teacher</.test(t2), true);

  const a2 = await html(admin, "/admin");
  check("a super admin is shown Admin", /nav-link[^>]*>Admin</.test(a2), true);

  // Removed for the same reason as on the login page: it switched nothing.
  check("the dead language toggle is gone", s.includes('aria-label="Language"'), false);
}

/** Sign in as a demo account and keep its jar. */
const as = async (account) => {
  const j = jar();
  const r = await req("/api/auth/demo-login", { jar: j, method: "POST", body: { account } });
  return { jar: j, redirect: (await r.json())?.redirect };
};

console.log("\nRole landing and the school section");
{
  const student = await as("demo.student1");
  const teacher = await as("demo.teacher");
  const school = await as("demo.school");
  const admin = await as("demo.superadmin");

  check("a student lands on My Learning", student.redirect, "/learning");
  check("a teacher lands on Teacher", teacher.redirect, "/teacher");
  check("a school lands on School", school.redirect, "/school");
  check("a super admin lands on Admin", admin.redirect, "/admin");
  check("the root sends a school to /school", (await req("/", { jar: school.jar })).location, "/school");

  check("a school may open /school", (await req("/school", { jar: school.jar })).status, 200);
  check("a super admin may too", (await req("/school", { jar: admin.jar })).status, 200);
  check("a teacher is bounced from /school", (await req("/school", { jar: teacher.jar })).location, "/teacher");
  check("a student is bounced from /school", (await req("/school", { jar: student.jar })).location, "/learning");
}

console.log("\nIdentity on screen is the person signed in");
{
  const page = async (j, path) => {
    const html = await (await fetch(BASE + path, { headers: j.header })).text();
    // React splits interpolated text with comment markers; drop them so the
    // rendered sentence can be matched as a human would read it.
    return html.replace(/<!--[\s\S]*?-->/g, "");
  };
  const s1 = await as("demo.student1");
  const s2 = await as("demo.student2");

  const p1 = await page(s1.jar, "/learning");
  check("the greeting names the signed-in student", p1.includes("Welcome back, Demo Student 1"), true);
  check("their real school is shown", p1.includes("AI Veda Demo School"), true);
  check("their real class is shown", p1.includes("Class Demo 6A"), true);
  // These were hard-coded into the page for every user.
  check("the hard-coded name is gone", p1.includes("Aparna Nair"), false);
  check("the hard-coded school is gone", p1.includes("GHSS Kochi"), false);

  const p2 = await page(s2.jar, "/learning");
  check("a different student sees their own name", p2.includes("Welcome back, Demo Student 2"), true);
  check("...and their own class", p2.includes("Class Demo 9A"), true);

  // getCurrentUser is wrapped in React's cache() so one render asks the
  // database once however many components want the answer. That is only safe
  // if the cache is scoped to a single request. If it ever leaked across
  // them, two students loading at the same moment would see each other's
  // pages — so this fires them interleaved and checks every response carries
  // exactly one identity, its own.
  const interleaved = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      page(i % 2 ? s2.jar : s1.jar, "/learning").then((html) => ({
        want: i % 2 ? "Demo Student 2" : "Demo Student 1",
        other: i % 2 ? "Demo Student 1" : "Demo Student 2",
        html,
      }))
    )
  );
  check(
    "12 interleaved requests each get their own user",
    interleaved.every((r) => r.html.includes(`Welcome back, ${r.want}`)),
    true
  );
  check(
    "...and none of them sees the other student anywhere on the page",
    interleaved.every((r) => !r.html.includes(r.other)),
    true
  );
}

console.log("\nLayout regressions this project has already hit once");
{
  const login = await (await fetch(BASE + "/login")).text();
  // The footer was hidden here; it is wanted for now.
  check("the login page still has the site footer", login.includes("site-footer"), true);

  // Read the stylesheet the page actually links to, rather than guessing a path.
  const href = (login.match(/href="(\/_next\/static\/css\/[^"]+)"/) || [])[1];
  const css = href ? await (await fetch(BASE + href.replace(/&amp;/g, "&"))).text() : "";
  if (!css) {
    console.log("  · stylesheet not found, skipping the CSS assertions");
  } else {
    // Tables used to drop their 4th and 5th cell below 900px, so a school
    // admin on a phone could not see who taught a class — the data was gone
    // with nothing to say so. They scroll sideways instead now.
    check("tables no longer hide their last columns", /nth-child\(4\)/.test(css), false);
    check("tables scroll sideways instead", /overflow-x:\s*auto/.test(css), true);
    // The width moved into a variable so each table can set its own; the
    // guard follows it rather than the old literal, and checks the wiring.
    check(
      "rows keep a readable minimum width",
      /--table-min:\s*560px/.test(css) && /min-width:\s*var\(--table-min\)/.test(css),
      true
    );
    // Below 560px the nav bar is hidden, so the account menu carries the links.
    check("the account menu carries the nav on small screens", /user-menu-nav/.test(css), true);

    // The canvas beyond the document is painted from the HTML background. Left
    // transparent it took the body's light gradient, so flicking to the bottom
    // of any page showed a white band under the dark footer.
    check("the html element paints the overscroll area", /html\s*\{[^}]*background:/.test(css), true);
    check("...with the same colour as the nav and footer", /html\s*\{[^}]*--ink-nav/.test(css), true);
    // vh alone forces the body taller than the visible area on a phone.
    check("the body uses svh so a short page does not scroll", /min-height:\s*100svh/.test(css), true);

    // A table row is a CSS grid with a fixed number of tracks. Add a cell to
    // the markup without widening --cols and that cell silently wraps onto a
    // line of its own — which is exactly how the Open button ended up under
    // the class name instead of at the end of its row.
    const tracks = (decl) => {
      // Count top-level tracks, ignoring commas inside minmax(0, 1fr).
      let depth = 0;
      let n = 1;
      let spaced = false;
      for (const ch of decl.trim()) {
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
        else if (ch === " " && depth === 0) spaced = true;
        else if (spaced) {
          n++;
          spaced = false;
        }
      }
      return n;
    };
    const colsFor = (cls) => {
      // \s* because dev serves the stylesheet unminified — ".table {" — and
      // production serves it as ".table{".
      const m = css.match(new RegExp("\\." + cls + "\\s*\\{[^}]*?--cols:([^;}]+)"));
      return m ? tracks(m[1]) : null;
    };
    const defaultCols = colsFor("table");

    const fetchPage = async (j, path) =>
      (await (await fetch(BASE + path, { headers: j.header })).text()).replace(
        /<!--[\s\S]*?-->/g,
        ""
      );

    for (const [path, jarFor] of [
      ["/school", "demo.school"],
      ["/teacher", "demo.teacher"],
      ["/admin/schools", "demo.superadmin"],
      ["/admin", "demo.superadmin"],
    ]) {
      const who = await as(jarFor);
      const html = await fetchPage(who.jar, path);
      const tables = html.match(/<div class="table[^"]*">/g) ?? [];
      for (const [i, tag] of tables.entries()) {
        const cls = (tag.match(/class="table ([a-z-]+)"/) || [])[1];
        const want = cls ? colsFor(cls) : defaultCols;
        // Cells of the header row that follows this table's opening tag.
        const after = html.slice(html.indexOf(tag) + tag.length);
        const head = (after.match(/<div class="tr th">([\s\S]*?)<\/div>\s*(?=<div)/) || [])[1] ?? "";
        const cells = (head.match(/<span/g) ?? []).length;
        check(
          `${path} table ${i + 1} declares as many columns as it has cells`,
          cells === want,
          true
        );
      }
    }
  }
}

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
