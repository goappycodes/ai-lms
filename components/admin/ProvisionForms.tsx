"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Credentials from "./Credentials";
import Modal from "@/components/ui/Modal";
import { t } from "@/lib/i18n/strings";

/**
 * The provisioning forms. One client component rather than four, because they
 * share the same four states — closed, submitting, credentials to show once,
 * error — and duplicating that across files is how three of them end up
 * behaving slightly differently.
 *
 * Each is a trigger button that opens a modal. The form deliberately does not
 * render in the page: the triggers sit in flex headers, so a form rendered in
 * place of its button gets wedged into whatever slot the button occupied.
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
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created>(null);

  /** Returns whether it succeeded, so the caller knows to clear its fields. */
  async function run(fn: () => Promise<{ username: string; password: string } | null>) {
    setBusy(true);
    setError(null);
    try {
      const result = await fn();
      setOpen(false);
      // A new account hands back a password; a class is not an account.
      if (result) setCreated(result);
      else router.refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return {
    open,
    busy,
    error,
    created,
    run,
    show: () => {
      setError(null);
      setOpen(true);
    },
    // Closing mid-request would strand the spinner, so it waits.
    close: () => !busy && setOpen(false),
    done: () => {
      setCreated(null);
      router.refresh();
    },
  };
}

/** Shared trailer: the error, then the buttons. */
function Actions({
  busy,
  error,
  submitLabel,
  busyLabel,
  onCancel,
}: {
  busy: boolean;
  error: string | null;
  submitLabel: string;
  busyLabel: string;
  onCancel: () => void;
}) {
  return (
    <>
      {error && (
        <p className="form-err" role="alert">
          {error}
        </p>
      )}
      <div className="provision-actions">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? busyLabel : submitLabel}
        </button>
        <button className="btn btn-ghost" type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </>
  );
}

/** The one place a password is ever visible, so it cannot be dismissed away. */
function CredentialsModal({
  created,
  onDone,
}: {
  created: NonNullable<Created>;
  onDone: () => void;
}) {
  return (
    <Modal title={t("provision.created")} onClose={onDone} dismissible={false} tone="warn">
      <Credentials {...created} onDone={onDone} />
    </Modal>
  );
}

// ---------------------------------------------------------------- school ----
export function AddSchoolForm() {
  const { open, busy, error, created, run, show, close, done } = useProvision();
  const [name, setName] = useState("");
  const [district, setDistrict] = useState("");
  const [username, setUsername] = useState("");

  return (
    <>
      <button className="btn btn-primary" onClick={show}>
        Add a school
      </button>

      {open && (
        <Modal title="Add a school" onClose={close} dismissible={!busy}>
          <form
            className="provision-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run(async () => {
                const r = await post("/api/schools", {
                  name: name.trim(),
                  district: district.trim() || undefined,
                  username: username.trim(),
                });
                return r.login;
              });
              if (ok) {
                setName("");
                setDistrict("");
                setUsername("");
              }
            }}
          >
            <p className="provision-note">
              Creating a school also creates the login it signs in with — one account, one
              school.
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
                data-autofocus
                disabled={busy}
              />
            </label>
            <label className="field">
              <span>District</span>
              <input
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                disabled={busy}
              />
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
            <Actions
              busy={busy}
              error={error}
              submitLabel="Create school"
              busyLabel="Creating…"
              onCancel={close}
            />
          </form>
        </Modal>
      )}

      {created && <CredentialsModal created={created} onDone={done} />}
    </>
  );
}

// --------------------------------------------------------------- teacher ----
export function AddTeacherForm({ schoolId }: { schoolId?: string }) {
  const { open, busy, error, created, run, show, close, done } = useProvision();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");

  return (
    <>
      <button className="btn btn-small btn-primary" onClick={show}>
        Add teacher
      </button>

      {open && (
        <Modal title="Add a teacher" onClose={close} dismissible={!busy}>
          <form
            className="provision-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run(() =>
                post("/api/teachers", {
                  schoolId,
                  fullName: fullName.trim(),
                  username: username.trim(),
                })
              );
              if (ok) {
                setFullName("");
                setUsername("");
              }
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
                data-autofocus
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
            <Actions
              busy={busy}
              error={error}
              submitLabel="Create teacher"
              busyLabel="Creating…"
              onCancel={close}
            />
          </form>
        </Modal>
      )}

      {created && <CredentialsModal created={created} onDone={done} />}
    </>
  );
}

// ----------------------------------------------------------------- class ----
export function AddClassForm({ schoolId, year }: { schoolId?: string; year: string }) {
  const { open, busy, error, run, show, close } = useProvision();
  const [name, setName] = useState("");
  const [level, setLevel] = useState(6);

  return (
    <>
      <button className="btn btn-small btn-primary" onClick={show}>
        Add class
      </button>

      {open && (
        <Modal title="Add a class" onClose={close} dismissible={!busy}>
          <form
            className="provision-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run(async () => {
                await post("/api/classes", {
                  schoolId,
                  name: name.trim(),
                  level,
                  academicYear: year,
                });
                return null; // no credentials — a class is not an account
              });
              if (ok) setName("");
            }}
          >
            <p className="provision-note">
              The course follows from the class level: 5–7 Explorer, 8–10 Builder, 11–12
              Achiever.
            </p>
            <label className="field">
              <span>Class name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="6B"
                required
                data-autofocus
                disabled={busy}
              />
            </label>
            <label className="field">
              <span>Class level</span>
              <select
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                disabled={busy}
              >
                {[5, 6, 7, 8, 9, 10, 11, 12].map((l) => (
                  <option key={l} value={l}>
                    Class {l} · {l <= 7 ? "Explorer" : l <= 10 ? "Builder" : "Achiever"}
                  </option>
                ))}
              </select>
            </label>
            <Actions
              busy={busy}
              error={error}
              submitLabel="Create class"
              busyLabel="Creating…"
              onCancel={close}
            />
          </form>
        </Modal>
      )}
    </>
  );
}

// --------------------------------------------------------------- student ----
export function AddStudentForm({ classId, prefix }: { classId: string; prefix?: string }) {
  const { open, busy, error, created, run, show, close, done } = useProvision();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");

  return (
    <>
      <button className="btn btn-small btn-primary" onClick={show}>
        Add student
      </button>

      {open && (
        <Modal title="Add a student" onClose={close} dismissible={!busy}>
          <form
            className="provision-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run(() =>
                post(`/api/classes/${classId}/students`, {
                  fullName: fullName.trim(),
                  username: username.trim(),
                })
              );
              if (ok) {
                setFullName("");
                setUsername("");
              }
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
                data-autofocus
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
              <span className="field-hint">
                Students sign in with this. They never get an email.
              </span>
            </label>
            <Actions
              busy={busy}
              error={error}
              submitLabel="Create student"
              busyLabel="Creating…"
              onCancel={close}
            />
          </form>
        </Modal>
      )}

      {created && <CredentialsModal created={created} onDone={done} />}
    </>
  );
}
