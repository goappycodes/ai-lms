// Checks the password helpers behave as claimed. No database, no network.
//   npm run verify:password
//
// Node 24 strips types itself, so this runs the real module rather than a
// compiled copy of it.
import {
  hashPassword,
  verifyPassword,
  needsRehash,
  generateTempPassword,
} from "../lib/auth/password.ts";

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean) =>
  ok ? (pass++, console.log(`  ✓ ${name}`)) : (fail++, console.log(`  ✗ ${name}`));

const h = await hashPassword("correct horse battery");
check("hash is versioned and self-describing", h.startsWith("scrypt$32768$8$1$") && h.split("$").length === 6);
check("correct password verifies", await verifyPassword("correct horse battery", h));
check("wrong password rejected", !(await verifyPassword("correct horse batteryy", h)));
check("empty password rejected", !(await verifyPassword("", h)));

const h2 = await hashPassword("correct horse battery");
check("same password hashes differently (unique salt)", h !== h2);
check("the second hash also verifies", await verifyPassword("correct horse battery", h2));

check(
  "unicode normalises consistently",
  await verifyPassword("café latte".normalize("NFD"), await hashPassword("café latte".normalize("NFC")))
);
check("malayalam password works", await verifyPassword("പാസ്‌വേഡ്1234", await hashPassword("പാസ്‌വേഡ്1234")));

// A corrupt row must read as "wrong password", never as a 500 that tells an
// attacker the account exists.
for (const bad of ["", "notascrypt", "scrypt$$$$", "scrypt$32768$8$1$$", "bcrypt$x$y$z$a$b", "scrypt$a$b$c$d$e"]) {
  check(`malformed hash '${(bad || "(empty)").slice(0, 16)}' returns false rather than throwing`,
    (await verifyPassword("x", bad)) === false);
}

const refused = async (pw: string) => {
  try {
    await hashPassword(pw);
    return false;
  } catch {
    return true;
  }
};
check("short password refused at hash time", await refused("short"));
check("absurdly long password refused", await refused("a".repeat(5000)));

check("current parameters do not need rehash", !needsRehash(h));
check("weaker parameters flagged for rehash", needsRehash("scrypt$16384$8$1$c2FsdA$a2V5"));
check("a foreign scheme is flagged for rehash", needsRehash("argon2id$v=19$m=65536"));

const temps = Array.from({ length: 500 }, () => generateTempPassword());
check("temp password is grouped for dictation", /^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/.test(temps[0]));
check("temp passwords avoid look-alike and sound-alike characters", !/[01ilo]/.test(temps.join("")));
check("temp passwords unique across 500 draws", new Set(temps).size === 500);
check("temp password is long enough to hash", (await hashPassword(temps[0])).startsWith("scrypt$"));

const t0 = Date.now();
await verifyPassword("correct horse battery", h);
const ms = Date.now() - t0;
check(`verify costs ${ms}ms — slow against cracking, fast enough for a class signing in at once`, ms > 40 && ms < 400);

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
