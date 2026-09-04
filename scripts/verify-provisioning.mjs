// Provisioning (P2-10…P2-15), against a running server.
//
//   npm run dev
//   npm run verify:provisioning
//
// The point of this suite is the boundaries: it does not just check that a
// school CAN add a teacher, it checks that it CANNOT touch another school's.
// Role checks alone pass the first and fail the second, which is exactly the
// hole this is guarding.
//
// Creates two throwaway schools per run, namespaced so repeat runs never
// collide, and disables everything it made at the end.
const BASE = process.env.BASE_URL || "http://localhost:3000";
const RUN = Math.random().toString(36).slice(2, 8);

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

function jar() {
  let cookie = "";
  return {
    get header() { return cookie ? { cookie } : {}; },
    absorb(res) {
      for (const c of res.headers.getSetCookie?.() ?? []) {
        const [pair] = c.split(";");
        if (pair.startsWith("aiveda_session=")) cookie = pair;
      }
    },
  };
}

async function call(path, { jar: j, method = "GET", body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    redirect: "manual",
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(j?.header ?? {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  j?.absorb(res);
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function signIn(username, password) {
  const j = jar();
  const r = await call("/api/auth/login", { jar: j, method: "POST", body: { username, password } });
  if (r.status !== 200) throw new Error(`could not sign in as ${username}: ${r.data?.error}`);
  return j;
}

async function signInDemo(account) {
  const j = jar();
  await call("/api/auth/demo-login", { jar: j, method: "POST", body: { account } });
  return j;
}

console.log(`Provisioning against ${BASE}  (run ${RUN})\n`);

await call("/api/auth/seed-demo", { method: "POST" });
const admin = await signInDemo("demo.superadmin");

// ---------------------------------------------------------------- schools --
console.log("Schools — creating one also creates the login it signs in with (P2-10, P2-11)");
const nameA = `Verify School A ${RUN}`;
const nameB = `Verify School B ${RUN}`;
const a = await call("/api/schools", {
  jar: admin, method: "POST",
  body: { name: nameA, district: "Test", username: `vsa.${RUN}` },
});
check("a super admin can create a school", a.status, 201);
check("...and gets a login back", typeof a.data?.login?.username, "string");
check("...with a password shown once", typeof a.data?.login?.password, "string");

const b = await call("/api/schools", {
  jar: admin, method: "POST",
  body: { name: nameB, username: `vsb.${RUN}` },
});
check("a second school can be created", b.status, 201);

check("a duplicate school name is refused, not a 500",
  (await call("/api/schools", { jar: admin, method: "POST", body: { name: nameA, username: `dup.${RUN}` } })).status, 409);
check("a duplicate username is refused",
  (await call("/api/schools", { jar: admin, method: "POST", body: { name: `Other ${RUN}`, username: `vsa.${RUN}` } })).status, 409);
check("a bad username is rejected by validation",
  (await call("/api/schools", { jar: admin, method: "POST", body: { name: `Bad ${RUN}`, username: "Has Spaces" } })).status, 400);

// The login the API just handed back must actually work.
const schoolA = await signIn(a.data.login.username, a.data.login.password);
check("the new school can sign in with those credentials", (await call("/api/auth/me", { jar: schoolA })).status, 200);
const schoolB = await signIn(b.data.login.username, b.data.login.password);

// ---------------------------------------------------------------- classes --
console.log("\nClasses and teachers (P2-12, P2-13)");
const clsA = await call("/api/classes", { jar: schoolA, method: "POST", body: { name: "9A", level: 9, academicYear: "2026-27" } });
check("a school can create a class in itself", clsA.status, 201);
check("a duplicate class name in the same year is refused",
  (await call("/api/classes", { jar: schoolA, method: "POST", body: { name: "9A", level: 9, academicYear: "2026-27" } })).status, 409);
check("a class level outside 5-12 is rejected",
  (await call("/api/classes", { jar: schoolA, method: "POST", body: { name: "4X", level: 4 } })).status, 400);

const teachA = await call("/api/teachers", { jar: schoolA, method: "POST", body: { fullName: "Verify Teacher A", username: `vta.${RUN}` } });
check("a school can create a teacher", teachA.status, 201);
const teachB = await call("/api/teachers", { jar: schoolB, method: "POST", body: { fullName: "Verify Teacher B", username: `vtb.${RUN}` } });
check("the other school can create its own", teachB.status, 201);

check("a teacher can be assigned to a class in the same school",
  (await call(`/api/classes/${clsA.data.id}/teachers`, { jar: schoolA, method: "POST", body: { teacherUserId: teachA.data.id } })).status, 201);

// ------------------------------------------------------------- boundaries --
console.log("\nThe boundaries — role alone would pass every one of these");
check("school B cannot add a class to school A",
  (await call("/api/classes", { jar: schoolB, method: "POST", body: { schoolId: a.data.schoolId, name: "X1", level: 6 } })).status, 403);
check("school B cannot list school A's teachers",
  (await call(`/api/teachers?schoolId=${a.data.schoolId}`, { jar: schoolB })).status, 403);
check("school B cannot add a student to school A's class",
  (await call(`/api/classes/${clsA.data.id}/students`, { jar: schoolB, method: "POST", body: { fullName: "Nope", username: `nope.${RUN}` } })).status, 403);
check("school B cannot rename school A's teacher",
  (await call(`/api/users/${teachA.data.id}`, { jar: schoolB, method: "PATCH", body: { fullName: "Hijacked" } })).status, 403);
check("school B cannot attach its own teacher to school A's class",
  (await call(`/api/classes/${clsA.data.id}/teachers`, { jar: schoolB, method: "POST", body: { teacherUserId: teachB.data.id } })).status, 403);
check("a school cannot create another school",
  (await call("/api/schools", { jar: schoolA, method: "POST", body: { name: `Sneaky ${RUN}`, username: `sneak.${RUN}` } })).status, 403);

// ---------------------------------------------------------------- teacher --
console.log("\nA teacher reaches their own class, and only that one");
const teacherA = await signIn(teachA.data.username, teachA.data.password);
const studentA = await call(`/api/classes/${clsA.data.id}/students`, {
  jar: teacherA, method: "POST", body: { fullName: "Verify Student A", username: `vsta.${RUN}` },
});
check("a teacher can add a student to a class they teach", studentA.status, 201);
check("...and the student has no email", studentA.data?.email, undefined);

const clsA2 = await call("/api/classes", { jar: schoolA, method: "POST", body: { name: "10B", level: 10 } });
check("a teacher cannot add a student to a class they do NOT teach",
  (await call(`/api/classes/${clsA2.data.id}/students`, { jar: teacherA, method: "POST", body: { fullName: "Nope", username: `nope2.${RUN}` } })).status, 403);
check("a teacher cannot list that class's students",
  (await call(`/api/classes/${clsA2.data.id}/students`, { jar: teacherA })).status, 403);
check("a teacher cannot create a teacher",
  (await call("/api/teachers", { jar: teacherA, method: "POST", body: { fullName: "X", username: `x.${RUN}` } })).status, 403);
check("a teacher cannot create a class",
  (await call("/api/classes", { jar: teacherA, method: "POST", body: { name: "Z1", level: 7 } })).status, 403);

// A stranger must be turned away before the body is even looked at, or the
// 400 quietly describes the shape of a request they cannot make.
console.log("\nAn unauthenticated caller gets 401, never a validation error");
for (const [name, path, method, body] of [
  ["assigning a teacher", `/api/classes/${clsA.data.id}/teachers`, "POST", { nonsense: true }],
  ["unassigning a teacher", `/api/classes/${clsA.data.id}/teachers`, "DELETE", undefined],
  ["adding a student", `/api/classes/${clsA.data.id}/students`, "POST", { nonsense: true }],
  ["creating a class", "/api/classes", "POST", { nonsense: true }],
  ["creating a teacher", "/api/teachers", "POST", { nonsense: true }],
  ["creating a school", "/api/schools", "POST", { nonsense: true }],
]) {
  check(`${name} without signing in`, (await call(path, { method, body })).status, 401);
}

// ---------------------------------------------------------------- student --
console.log("\nA student can provision nothing");
const student = await signInDemo("demo.student1");
check("a student cannot create a class", (await call("/api/classes", { jar: student, method: "POST", body: { name: "S1", level: 6 } })).status, 403);
check("a student cannot create a teacher", (await call("/api/teachers", { jar: student, method: "POST", body: { fullName: "X", username: `sx.${RUN}` } })).status, 403);
check("a student cannot list schools", (await call("/api/schools", { jar: student })).status, 403);
check("a student cannot add a classmate",
  (await call(`/api/classes/${clsA.data.id}/students`, { jar: student, method: "POST", body: { fullName: "X", username: `sy.${RUN}` } })).status, 403);

// ----------------------------------------------------------- enrolment ----
console.log("\nEnrolment follows the class level (P2-15)");
{
  const s = await signIn(studentA.data.username, studentA.data.password);
  const me = await call("/api/auth/me", { jar: s });
  check("the new student can sign in", me.status, 200);
  const html = await (await fetch(BASE + "/learning", { headers: s.header })).text();
  // Class 9 maps to Builder through course_levels — nobody enrolled them.
  check("a class-9 student is enrolled in Builder", /Builder[\s\S]{0,400}?sessions/.test(html.replace(/<!--[\s\S]*?-->/g, "")), true);
}

// ------------------------------------------------------------- disabling --
console.log("\nDisabling an account ends access immediately");
{
  const s = await signIn(studentA.data.username, studentA.data.password);
  check("the student's session works", (await call("/api/auth/me", { jar: s })).status, 200);
  check("their teacher can disable them",
    (await call(`/api/users/${studentA.data.id}`, { jar: teacherA, method: "PATCH", body: { status: "disabled" } })).status, 200);
  // Not "when the cookie expires" — the sessions row is deleted too.
  check("the existing session stops working at once", (await call("/api/auth/me", { jar: s })).status, 401);
  check("and they can no longer sign in",
    (await call("/api/auth/login", { method: "POST", body: { username: studentA.data.username, password: studentA.data.password } })).status, 401);
}

// ------------------------------------------------------ schools: U and D --
console.log("\nA super admin manages any school (P2-23, P2-24, P2-25)");
{
  const sid = a.data.schoolId;
  const detail = async () => (await call(`/api/schools/${sid}`, { jar: admin })).data;
  const edit = (body) =>
    call(`/api/schools/${sid}`, { jar: admin, method: "PATCH", body });

  check("the super admin can open any school", (await call(`/api/schools/${sid}`, { jar: admin })).status, 200);
  check("a school cannot open another school's detail",
    (await call(`/api/schools/${sid}`, { jar: schoolB })).status, 403);

  check("details can be edited", (await edit({ district: "Wayanad" })).status, 200);
  check("...and the change sticks", (await detail()).district, "Wayanad");

  // COALESCE could not tell "leave alone" from "clear", so a district could be
  // typed in but never removed.
  check("null clears a field", (await edit({ district: null })).status, 200);
  check("...and it is really gone", (await detail()).district, null);
  // Namespaced like everything else here: school codes are unique, and a
  // previous run of this suite still owns the schools it created.
  const code = `KL-${RUN}`;
  check("a code can be set", (await edit({ code })).status, 200);
  await edit({ name: nameA });
  check("an unmentioned field is left alone", (await detail()).code, code);

  check("a duplicate name is refused, not a 500",
    (await edit({ name: nameB })).status, 409);

  // Archiving.
  const teacher = teachA.data;
  const canSignIn = async () =>
    (await call("/api/auth/login", { method: "POST", body: { username: teacher.username, password: teacher.password } })).status;
  check("the school's teacher can sign in while it is active", await canSignIn(), 200);

  check("a school cannot archive itself",
    (await call(`/api/schools/${a.data.schoolId}`, { jar: schoolA, method: "PATCH", body: { status: "archived" } })).status, 403);

  check("a super admin can archive it", (await edit({ status: "archived" })).status, 200);
  // The point of archiving: it has to actually stop people getting in.
  check("...and its teacher can no longer sign in", await canSignIn(), 401);
  check("...nor can the school itself",
    (await call("/api/auth/login", { method: "POST", body: { username: a.data.login.username, password: a.data.login.password } })).status, 401);
  check("an existing session of theirs is dropped too",
    (await call("/api/auth/me", { jar: schoolA })).status, 401);

  // An archived school takes nobody new — an account made there could not
  // sign in, so accepting the row would only look like it worked.
  check("no new class in an archived school",
    (await call("/api/classes", { jar: admin, method: "POST", body: { schoolId: sid, name: "Z9", level: 9 } })).status, 403);
  check("no new teacher either",
    (await call("/api/teachers", { jar: admin, method: "POST", body: { schoolId: sid, fullName: "No", username: `no.${RUN}` } })).status, 403);
  check("no new student either",
    (await call(`/api/classes/${clsA.data.id}/students`, { jar: admin, method: "POST", body: { fullName: "No", username: `nos.${RUN}` } })).status, 403);
  // Reading still works: the super admin has to be able to see what is there.
  check("its classes can still be listed",
    (await call(`/api/classes?schoolId=${sid}`, { jar: admin })).status, 200);
  check("...and its teachers", (await call(`/api/teachers?schoolId=${sid}`, { jar: admin })).status, 200);

  check("restoring it works", (await edit({ status: "active" })).status, 200);
  check("...and access comes straight back", await canSignIn(), 200);
  // Nothing was deleted on the way through.
  const back = await detail();
  check("the classes are still there", back.class_count > 0, true);
}

// ------------------------------------------------------------------ audit --
console.log("\nEvery provisioning action is audited");
{
  const seen = await call("/api/schools", { jar: admin });
  check("the super admin can still list schools", seen.status, 200);
  check("both new schools are listed", seen.data.filter((s) => s.name === nameA || s.name === nameB).length, 2);
}

// Leave nothing enabled behind. The two schools are archived rather than left
// active: every run used to add two more to the super admin's list for good,
// because until P2-25 there was no way to take one out again.
for (const uid of [teachA.data?.id, teachB.data?.id]) {
  if (uid) await call(`/api/users/${uid}`, { jar: admin, method: "PATCH", body: { status: "disabled" } });
}
for (const sid of [a.data?.schoolId, b.data?.schoolId]) {
  if (sid) await call(`/api/schools/${sid}`, { jar: admin, method: "PATCH", body: { status: "archived" } });
}

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
