"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SnakeSpinner } from "@/components/Skeleton";

export default function NewCourseForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, audience: audience || undefined, subtitle: subtitle || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      const course = await res.json();
      router.push(`/admin/studio/${course.id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        + New course
      </button>
    );
  }

  return (
    <form className="mini-card" onSubmit={submit}>
      <h3>New course</h3>
      <label className="field">
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Explorer" required />
      </label>
      <label className="field">
        <span>Audience</span>
        <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Classes 5–7" />
      </label>
      <label className="field">
        <span>Tagline</span>
        <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Wonder and play…" />
      </label>
      {err && <p className="form-err">{err}</p>}
      <div className="mini-actions">
        <button className="btn btn-primary" disabled={busy || title.length < 2}>
          {busy ? (
            <>
              <SnakeSpinner size={14} /> Creating…
            </>
          ) : (
            "Create"
          )}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
