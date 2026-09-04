"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";

/**
 * The super admin's controls on a single school: edit its details, archive it,
 * bring it back.
 *
 * A school never sees these. Editing its own name is one thing, but archiving
 * itself off the platform is not something an account should be able to do to
 * itself, so the API refuses it for anyone but a super admin and this
 * component is only rendered there.
 */

interface School {
  id: string;
  name: string;
  district: string | null;
  code: string | null;
  status: "active" | "archived";
}

async function patch(id: string, body: unknown) {
  const res = await fetch(`/api/schools/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "Something went wrong. Please try again.");
  return data;
}

export default function SchoolControls({ school }: { school: School }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(school.name);
  const [district, setDistrict] = useState(school.district ?? "");
  const [code, setCode] = useState(school.code ?? "");

  const archived = school.status === "archived";

  async function run(body: unknown, done: () => void) {
    setBusy(true);
    setError(null);
    try {
      await patch(school.id, body);
      done();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head-actions">
        <button className="btn btn-small btn-ghost" onClick={() => setEditing(true)}>
          Edit details
        </button>
        <button
          className={"btn btn-small " + (archived ? "btn-primary" : "btn-ghost")}
          onClick={() => (archived ? run({ status: "active" }, () => {}) : setConfirming(true))}
          disabled={busy}
        >
          {archived ? "Restore school" : "Archive"}
        </button>
      </div>

      {editing && (
        <Modal title="Edit school" onClose={() => !busy && setEditing(false)} dismissible={!busy}>
          <form
            className="provision-form"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                {
                  name: name.trim(),
                  // Empty means clear it, which is why null and undefined are
                  // not the same thing all the way down to the SQL.
                  district: district.trim() || null,
                  code: code.trim() || null,
                },
                () => setEditing(false)
              );
            }}
          >
            <label className="field">
              <span>School name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
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
              <span className="field-hint">Leave empty to remove it.</span>
            </label>
            <label className="field">
              <span>Code</span>
              <input value={code} onChange={(e) => setCode(e.target.value)} disabled={busy} />
            </label>
            {error && (
              <p className="form-err" role="alert">
                {error}
              </p>
            )}
            <div className="provision-actions">
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setEditing(false)}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {confirming && (
        <Modal
          title="Archive this school?"
          onClose={() => !busy && setConfirming(false)}
          dismissible={!busy}
          tone="warn"
        >
          <div className="provision-form">
            <p className="provision-note">
              <strong>{school.name}</strong> will stop appearing in the active list, and nobody
              at the school — not its teachers, not its students — will be able to sign in.
            </p>
            <p className="provision-note">
              Nothing is deleted. Classes, progress and any certificates already issued stay
              exactly as they are, and restoring the school gives everyone their access back.
            </p>
            {error && (
              <p className="form-err" role="alert">
                {error}
              </p>
            )}
            <div className="provision-actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => run({ status: "archived" }, () => setConfirming(false))}
                disabled={busy}
              >
                {busy ? "Archiving…" : "Archive school"}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setConfirming(false)}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
