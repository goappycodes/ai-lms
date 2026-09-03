"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Skeleton, SnakeBar } from "@/components/Skeleton";

// --- Shapes (plain, no server imports) --------------------------------------
export const LOCALES = ["en", "ml"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_LABEL: Record<Locale, string> = { en: "EN", ml: "ML" };
const DOC_KINDS = ["worksheet", "handout"] as const;
type DocKind = (typeof DOC_KINDS)[number];

type Video = {
  id: string;
  locale: Locale;
  status: string;
  progress: number;
  stage: string | null;
  storage: string | null;
  master_url: string | null;
  renditions: string[] | null;
} | null;
type Doc = { id: string; kind: DocKind; locale: Locale; title: string; url: string };
type Lesson = {
  id: string;
  title: string;
  covers: string | null;
  tools: string | null;
  duration_min: number;
  position: number;
  is_advanced: boolean;
  translation_fallback: boolean;
  videos: Partial<Record<Locale, Video>>;
  documents: Doc[];
  assets_filled: number;
};
type Cert = {
  issuer: string;
  partner: string;
  signature_name: string | null;
  signature_title: string | null;
  enabled: boolean;
} | null;
export type Tree = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  audience: string | null;
  status: string;
  accent: string | null;
  lessons: Lesson[];
  certificate: Cert;
  assets_filled: number;
  assets_expected: number;
};

async function api(path: string, opts?: RequestInit) {
  const r = await fetch(path, opts);
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || r.statusText);
  }
  return r.status === 204 ? null : r.json();
}

// --- Video status pill ------------------------------------------------------
function VideoState({ v, job }: { v: Video; job?: { progress: number; stage: string; status: string } }) {
  if (job) {
    return (
      <div className="vstatus working">
        <div className="vbar">
          <i style={{ width: `${Math.round(job.progress * 100)}%` }} />
        </div>
        <span>{job.stage || "Processing…"}</span>
      </div>
    );
  }
  if (!v) return <span className="vstatus none">No video</span>;
  if (v.status === "ready") {
    const rungs = v.renditions?.join(" · ") ?? "";
    return (
      <span className="vstatus ready" title={`${v.storage?.toUpperCase()} · ${rungs}`}>
        ✓ Ready <em>{v.storage === "r2" ? "R2" : "local"}</em>
      </span>
    );
  }
  if (v.status === "error") return <span className="vstatus err" title={v.stage || ""}>Encode failed</span>;
  return <span className="vstatus working">{v.stage || v.status}</span>;
}

// --- Certificate panel ------------------------------------------------------
function CertPanel({ courseId, cert, onSaved }: { courseId: string; cert: Cert; onSaved: () => void }) {
  const [issuer, setIssuer] = useState(cert?.issuer ?? "NEXIS School of Business");
  const [partner, setPartner] = useState(cert?.partner ?? "Government of Kerala");
  const [sig, setSig] = useState(cert?.signature_name ?? "");
  const [enabled, setEnabled] = useState(cert?.enabled ?? true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/courses/${courseId}/certificate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issuer, partner, signature_name: sig || null, enabled }),
      });
      setMsg("Saved");
      onSaved();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cert-form">
      <div className="cert-grid">
        <label className="field"><span>Issuer</span><input value={issuer} onChange={(e) => setIssuer(e.target.value)} /></label>
        <label className="field"><span>Partner</span><input value={partner} onChange={(e) => setPartner(e.target.value)} /></label>
        <label className="field"><span>Signatory</span><input value={sig} onChange={(e) => setSig(e.target.value)} placeholder="Principal" /></label>
      </div>
      <label className="check-row">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Issue certificate on course completion
      </label>
      <div className="mini-actions">
        <button className="btn btn-primary btn-small" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save certificate"}</button>
        {msg && <span className="muted tiny">{msg}</span>}
      </div>
    </div>
  );
}

// --- Main editor ------------------------------------------------------------
export default function StudioEditor({ initial }: { initial: Tree }) {
  const [tree, setTree] = useState<Tree>(initial);
  const [lessonTitle, setLessonTitle] = useState("");
  const [jobs, setJobs] = useState<Record<string, { progress: number; stage: string; status: string }>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(0);
  const timers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const reload = useCallback(async () => {
    setTree(await api(`/api/courses/${initial.id}?tree=1`));
  }, [initial.id]);

  useEffect(() => {
    const t = timers.current;
    return () => Object.values(t).forEach(clearInterval);
  }, []);

  function guard<T>(fn: () => Promise<T>) {
    setBusy((b) => b + 1);
    return fn()
      .catch((e) => setErr((e as Error).message))
      .finally(() => setBusy((b) => b - 1));
  }

  async function addLesson() {
    const t = lessonTitle.trim();
    if (!t) return;
    await guard(async () => {
      await api(`/api/courses/${initial.id}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t }),
      });
      setLessonTitle("");
      await reload();
    });
  }

  function pollVideo(key: string, videoId: string) {
    clearInterval(timers.current[key]);
    timers.current[key] = setInterval(async () => {
      try {
        const v = await api(`/api/videos/${videoId}`);
        setJobs((j) => ({ ...j, [key]: { progress: v.progress, stage: v.stage || v.status, status: v.status } }));
        if (v.status === "ready" || v.status === "error") {
          clearInterval(timers.current[key]);
          setJobs((j) => {
            const n = { ...j };
            delete n[key];
            return n;
          });
          await reload();
        }
      } catch {
        clearInterval(timers.current[key]);
      }
    }, 1200);
  }

  // Jobs are keyed by lesson AND locale: the English and Malayalam videos for
  // one lesson can encode at the same time.
  async function uploadVideo(lessonId: string, locale: Locale, file: File) {
    const key = `${lessonId}:${locale}`;
    setErr(null);
    setJobs((j) => ({ ...j, [key]: { progress: 0, stage: "Uploading source…", status: "pending" } }));
    await guard(async () => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("locale", locale);
      const video = await api(`/api/lessons/${lessonId}/video`, { method: "POST", body: fd });
      pollVideo(key, video.id);
    });
  }

  async function uploadDoc(lessonId: string, kind: DocKind, locale: Locale, file: File) {
    await guard(async () => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      fd.append("locale", locale);
      await api(`/api/lessons/${lessonId}/documents`, { method: "POST", body: fd });
      await reload();
    });
  }

  async function delDoc(docId: string) {
    await guard(async () => {
      await api(`/api/documents/${docId}`, { method: "DELETE" });
      await reload();
    });
  }

  async function delLesson(lessonId: string) {
    await guard(async () => {
      await api(`/api/lessons/${lessonId}`, { method: "DELETE" });
      await reload();
    });
  }
  async function togglePublish() {
    await guard(async () => {
      await api(`/api/courses/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: tree.status === "published" ? "draft" : "published" }),
      });
      await reload();
    });
  }

  return (
    <div className="studio">
      {busy > 0 && <SnakeBar className="snake-top" />}
      <div className="studio-head">
        <div>
          <Link href="/admin/studio" className="crumb">← All courses</Link>
          <h1>{tree.title}</h1>
          <p className="muted">
            {tree.audience} · {tree.lessons.length} lessons ·{" "}
            <strong>
              {tree.assets_filled}/{tree.assets_expected}
            </strong>{" "}
            assets ready
          </p>
        </div>
        <div className="studio-head-actions">
          <span className={"pill " + (tree.status === "published" ? "live" : "draft")}>{tree.status}</span>
          <button className="btn btn-ghost btn-small" onClick={togglePublish}>
            {tree.status === "published" ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      {err && <p className="form-err banner">{err}</p>}

      {/* Lessons. Six slots each: video, worksheet and handout, in both
          languages. The counts are what make 96 assets trackable. */}
      {tree.lessons.map((ls) => (
        <div key={ls.id} className="lesson-item">
          <div className="lesson-row">
            <div className="lesson-main">
              <span className="lesson-title">
                {ls.position}. {ls.title}
                {ls.is_advanced && <em className="pill draft"> advanced</em>}
              </span>
              {ls.covers && <span className="lesson-sub">{ls.covers}</span>}
            </div>
            <span className={"vstatus " + (ls.assets_filled === 6 ? "ready" : "none")}>
              {ls.assets_filled}/6
            </span>
          </div>

          <div className="slot-grid">
            {LOCALES.map((loc) => (
              <div key={loc} className="slot-row">
                <span className="slot-lang">{LOCALE_LABEL[loc]}</span>

                <div className="slot">
                  <VideoState v={ls.videos[loc] ?? null} job={jobs[`${ls.id}:${loc}`]} />
                  <label className="btn btn-small btn-ghost file">
                    {ls.videos[loc] ? "Replace" : "Upload video"}
                    <input
                      type="file"
                      accept="video/*"
                      hidden
                      onChange={(e) =>
                        e.target.files?.[0] && uploadVideo(ls.id, loc, e.target.files[0])
                      }
                    />
                  </label>
                </div>

                {DOC_KINDS.map((kind) => {
                  const doc = ls.documents.find((d) => d.kind === kind && d.locale === loc);
                  return (
                    <div key={kind} className="slot">
                      {doc ? (
                        <span className="chip">
                          <a href={doc.url} target="_blank" rel="noreferrer">
                            {kind}
                          </a>
                          <button onClick={() => delDoc(doc.id)} aria-label={`Remove ${kind}`}>
                            ×
                          </button>
                        </span>
                      ) : (
                        <span className="vstatus none">No {kind}</span>
                      )}
                      <label className="btn btn-small btn-ghost file">
                        {doc ? "Replace" : `Upload ${kind}`}
                        <input
                          type="file"
                          accept="application/pdf"
                          hidden
                          onChange={(e) =>
                            e.target.files?.[0] && uploadDoc(ls.id, kind, loc, e.target.files[0])
                          }
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="lesson-actions">
            <button className="btn btn-small btn-ghost danger" onClick={() => delLesson(ls.id)}>
              Delete lesson
            </button>
          </div>
        </div>
      ))}

      <div className="mini-form add-chapter">
        <input
          placeholder="New lesson title"
          value={lessonTitle}
          onChange={(e) => setLessonTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addLesson()}
        />
        <button className="btn btn-primary btn-small" onClick={addLesson}>
          Add lesson
        </button>
      </div>

      {/* Certificate */}
      <h2 className="section-title">Certificate</h2>
      <CertPanel courseId={initial.id} cert={tree.certificate} onSaved={reload} />
    </div>
  );
}
