"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Credentials from "./Credentials";

/**
 * The provisioning forms. One client component rather than four, because they
 * share the same three states — submitting, credentials to show once, error —
 * and duplicating that across files is how three of them end up behaving
 * slightly differently.
 */

type Created = { username: string; password: string } | null;

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "Something went wrong. Please try again.");
  return data;
}

/** Turns "Anitha Menon" into "anitha.menon" as a starting point. */
function suggestUsername(fullName: string, prefix = ""): string {
  const slug = fullName
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    // Malayalam and other non-Latin names leave nothing usable, so the field
    // stays empty and whoever is provisioning types something they can dictate.
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .join(".");
  return slug ? `${prefix}${slug}` : "";
}

function useProvision() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created>(null);

  async function run(fn: () => Promise<{ username: string; password: string } | null>) {
    setBusy(true);
    setError(null);
    try {
      const result = await fn();
      if (result) setCreated(result);
      else router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function done() {
    setCreated(null);
    router.refresh();
  }

  return { busy, error, created, run, done, setError };
}

// ---------------------------------------------------------------- school ----
export function AddSchoolForm() {
  const { busy, error, created, run, done } = useProvision();
  const [name, setName] = useState("");
  const [district, setDistrict] = useState("");
  const [username, setUsername] = useState("");
  const [open, setOpen] = useState(false);

  if (created) return <Credentials {...created} onDone={done} />;

  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        Add a school
      </button>
    );
  }

  return (
    <form
      className="provision-form"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          const r = await post("/api/schools", {
            name: name.trim(),
            district: district.trim() || undefined,
            username: username.trim(),
          });
          return r.login;
        });
      }}
    >
      <p className="provision-note">
        Creating a school also creates the login it signs in with — one account,
        one school.
      </p>
      <label className="field">
        <span>School name</span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!username) setUsername(suggestUsername(e.target.value));
          }}
          onBlur={() => !username && setUsername(suggestUsername(name))}
          required
          disabled={busy}
        />
      </label>
      <label className="field">
        <span>District</span>
        <input value={district} onChange={(e) => setDistrict(e.target.value)} disabled={busy} />
      </label>
      <label className="field">
        <span>Sign-in username</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          disabled={busy}
        />
      </label>
      {error && <p className="form-err">{error}</p>}
      <div className="provision-actions">
        <button className="btn btn-primary btn-small" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create school"}
        </button>
        <button
          className="btn btn-ghost btn-small"
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// --------------------------------------------------------------- teacher ----
export function AddTeacherForm({ schoolId }: { schoolId?: string }) {
  const { busy, error, created, run, done } = useProvision();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [open, setOpen] = useState(false);

  if (created) return <Credentials {...created} onDone={done} />;
  if (!open) {
    return (
      <button className="btn btn-small btn-primary" onClick={() => setOpen(true)}>
        Add teacher
      </button>
    );
  }

  return (
    <form
      className="provision-form"
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          post("/api/teachers", {
            schoolId,
            fullName: fullName.trim(),
            username: username.trim(),
          })
        );
      }}
    >
      <label className="field">
        <span>Full name</span>
        <input
          value={fullName}
          onChange={(e) => {
            setFullName(e.target.value);
            if (!username) setUsername(suggestUsername(e.target.value));
          }}
          onBlur={() => !username && setUsername(suggestUsername(fullName))}
          required
          disabled={busy}
        />
      </label>
      <label className="field">
        <span>Username</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          disabled={busy}
        />
      </label>
      {error && <p className="form-err">{error}</p>}
      <div className="provision-actions">
        <button className="btn btn-primary btn-small" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create teacher"}
        </button>
        <button className="btn btn-ghost btn-small" type="button" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ----------------------------------------------------------------- class ----
export function AddClassForm({ schoolId, year }: { schoolId?: string; year: string }) {
  const { busy, error, run } = useProvision();
  const [name, setName] = useState("");
  const [level, setLevel] = useState(6);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="btn btn-small btn-primary" onClick={() => setOpen(true)}>
        Add class
      </button>
    );
  }

  return (
    <form
      className="provision-form"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await post("/api/classes", {
            schoolId,
            name: name.trim(),
            level,
            academicYear: year,
          });
          setName("");
          setOpen(false);
          return null; // no credentials — a class is not an account
        });
      }}
    >
      <p className="provision-note">
        The course follows from the class level: 5–7 Explorer, 8–10 Builder, 11–12 Achiever.
      </p>
      <label className="field">
        <span>Class name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="6B"
          required
          disabled={busy}
        />
      </label>
      <label className="field">
        <span>Class level</span>
        <select value={level} onChange={(e) => setLevel(Number(e.target.value))} disabled={busy}>
          {[5, 6, 7, 8, 9, 10, 11, 12].map((l) => (
            <option key={l} value={l}>
              Class {l} · {l <= 7 ? "Explorer" : l <= 10 ? "Builder" : "Achiever"}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="form-err">{error}</p>}
      <div className="provision-actions">
        <button className="btn btn-primary btn-small" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create class"}
        </button>
        <button className="btn btn-ghost btn-small" type="button" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// --------------------------------------------------------------- student ----
export function AddStudentForm({ classId, prefix }: { classId: string; prefix?: string }) {
  const { busy, error, created, run, done } = useProvision();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [open, setOpen] = useState(false);

  if (created) return <Credentials {...created} onDone={done} />;
  if (!open) {
    return (
      <button className="btn btn-small btn-ghost" onClick={() => setOpen(true)}>
        Add student
      </button>
    );
  }

  return (
    <form
      className="provision-form"
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          post(`/api/classes/${classId}/students`, {
            fullName: fullName.trim(),
            username: username.trim(),
          })
        );
      }}
    >
      <label className="field">
        <span>Full name</span>
        <input
          value={fullName}
          onChange={(e) => {
            setFullName(e.target.value);
            if (!username) setUsername(suggestUsername(e.target.value, prefix));
          }}
          onBlur={() => !username && setUsername(suggestUsername(fullName, prefix))}
          required
          disabled={busy}
        />
      </label>
      <label className="field">
        <span>Username</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          disabled={busy}
        />
        <span className="field-hint">Students sign in with this. They never get an email.</span>
      </label>
      {error && <p className="form-err">{error}</p>}
      <div className="provision-actions">
        <button className="btn btn-primary btn-small" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create student"}
        </button>
        <button className="btn btn-ghost btn-small" type="button" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
