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
  // Warm the connection so the first call does not carry pool setup.
  await time(`warmup.${Math.random().toString(36).slice(2, 8)}`);
  const real = await time("demo.superadmin");
  const ghost = await time(`nobody.${Math.random().toString(36).slice(2, 10)}`);
  const delta = Math.abs(real - ghost);
  console.log(`    real user ${real}ms · unknown user ${ghost}ms · difference ${delta}ms`);
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
}

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
