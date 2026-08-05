"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

// --- Shapes (plain, no server imports) --------------------------------------
type Video = {
  id: string;
  status: string;
  progress: number;
  stage: string | null;
  storage: string | null;
  master_url: string | null;
  renditions: string | null;
} | null;
type Pdf = { id: string; title: string; url: string; storage: string };
type Lesson = {
  id: string;
  title: string;
  takeaway: string | null;
  tools: string | null;
  duration_min: number;
  video: Video;
  pdfs: Pdf[];
  quizCount: number;
};
type Chapter = { id: string; title: string; lessons: Lesson[] };
type Cert = {
  title: string;
  issuer: string;
  partner: string;
  signature_name: string | null;
  signature_title: string | null;
  enabled: number;
} | null;
export type Tree = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  audience: string | null;
  status: string;
  accent: string | null;
  chapters: Chapter[];
  certificate: Cert;
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
    const rungs = v.renditions ? (JSON.parse(v.renditions) as string[]).join(" · ") : "";
    return (
      <span className="vstatus ready" title={`${v.storage?.toUpperCase()} · ${rungs}`}>
        ✓ Ready <em>{v.storage === "r2" ? "R2" : "local"}</em>
      </span>
    );
  }
  if (v.status === "error") return <span className="vstatus err" title={v.stage || ""}>Encode failed</span>;
  return <span className="vstatus working">{v.stage || v.status}</span>;
}

// --- Quiz panel -------------------------------------------------------------
type QQ = { prompt: string; options: string[]; correctIndex: number };
function QuizPanel({ lessonId, onSaved }: { lessonId: string; onSaved: () => void }) {
  const [questions, setQuestions] = useState<QQ[]>([]);
  const [passPct, setPassPct] = useState(70);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api(`/api/lessons/${lessonId}/quiz`).then((q) => {
      if (q) {
        setPassPct(q.pass_pct);
        setQuestions(q.questions.map((x: { prompt: string; options: string[]; correct_index: number }) => ({ prompt: x.prompt, options: x.options, correctIndex: x.correct_index })));
      }
      setLoaded(true);
    });
  }, [lessonId]);

  function addQ() {
    setQuestions((qs) => [...qs, { prompt: "", options: ["", ""], correctIndex: 0 }]);
  }
  function update(i: number, patch: Partial<QQ>) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }
  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/lessons/${lessonId}/quiz`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passPct, questions }),
      });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <div className="quiz-editor muted">Loading quiz…</div>;
  return (
    <div className="quiz-editor">
      <div className="quiz-top">
        <label className="inline-field">
          Pass %
          <input type="number" min={0} max={100} value={passPct} onChange={(e) => setPassPct(Number(e.target.value))} />
        </label>
        <button className="btn btn-small btn-ghost" onClick={addQ}>+ Question</button>
      </div>
      {questions.map((q, i) => (
        <div key={i} className="q-row">
          <input
            className="q-prompt"
            placeholder={`Question ${i + 1}`}
            value={q.prompt}
            onChange={(e) => update(i, { prompt: e.target.value })}
          />
          {q.options.map((opt, oi) => (
            <label key={oi} className="opt-row">
              <input
                type="radio"
                name={`correct-${i}`}
                checked={q.correctIndex === oi}
                onChange={() => update(i, { correctIndex: oi })}
              />
              <input
                placeholder={`Option ${oi + 1}`}
                value={opt}
                onChange={(e) => update(i, { options: q.options.map((o, x) => (x === oi ? e.target.value : o)) })}
              />
              {q.options.length > 2 && (
                <button className="x" onClick={() => update(i, { options: q.options.filter((_, x) => x !== oi), correctIndex: 0 })}>×</button>
              )}
            </label>
          ))}
          <div className="q-actions">
            <button className="btn btn-small btn-ghost" onClick={() => update(i, { options: [...q.options, ""] })}>+ Option</button>
            <button className="btn btn-small btn-ghost" onClick={() => setQuestions((qs) => qs.filter((_, x) => x !== i))}>Remove question</button>
          </div>
        </div>
      ))}
      {err && <p className="form-err">{err}</p>}
      <button className="btn btn-primary btn-small" onClick={save} disabled={busy || questions.length === 0}>
        {busy ? "Saving…" : `Save quiz (${questions.length})`}
      </button>
    </div>
  );
}

// --- Certificate panel ------------------------------------------------------
function CertPanel({ courseId, cert, onSaved }: { courseId: string; cert: Cert; onSaved: () => void }) {
  const [title, setTitle] = useState(cert?.title ?? "Certificate of Completion");
  const [issuer, setIssuer] = useState(cert?.issuer ?? "NEXIS School of Business");
  const [partner, setPartner] = useState(cert?.partner ?? "Government of Kerala");
  const [sig, setSig] = useState(cert?.signature_name ?? "");
  const [enabled, setEnabled] = useState((cert?.enabled ?? 1) === 1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/courses/${courseId}/certificate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, issuer, partner, signature_name: sig || null, enabled: enabled ? 1 : 0 }),
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
        <label className="field"><span>Certificate title</span><input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
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
  const [chapterTitle, setChapterTitle] = useState("");
  const [lessonTitle, setLessonTitle] = useState<Record<string, string>>({});
  const [jobs, setJobs] = useState<Record<string, { progress: number; stage: string; status: string }>>({});
  const [openQuiz, setOpenQuiz] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const reload = useCallback(async () => {
    setTree(await api(`/api/courses/${initial.id}?tree=1`));
  }, [initial.id]);

  useEffect(() => {
    const t = timers.current;
    return () => Object.values(t).forEach(clearInterval);
  }, []);

  function guard<T>(fn: () => Promise<T>) {
    return fn().catch((e) => setErr((e as Error).message));
  }

  async function addChapter() {
    if (chapterTitle.trim().length < 1) return;
    await guard(async () => {
      await api(`/api/courses/${initial.id}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: chapterTitle.trim() }),
      });
      setChapterTitle("");
      await reload();
    });
  }

  async function addLesson(chapterId: string) {
    const t = (lessonTitle[chapterId] || "").trim();
    if (!t) return;
    await guard(async () => {
      await api(`/api/chapters/${chapterId}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t }),
      });
      setLessonTitle((m) => ({ ...m, [chapterId]: "" }));
      await reload();
    });
  }

  function pollVideo(lessonId: string, videoId: string) {
    clearInterval(timers.current[lessonId]);
    timers.current[lessonId] = setInterval(async () => {
      try {
        const v = await api(`/api/videos/${videoId}`);
        setJobs((j) => ({ ...j, [lessonId]: { progress: v.progress, stage: v.stage || v.status, status: v.status } }));
        if (v.status === "ready" || v.status === "error") {
          clearInterval(timers.current[lessonId]);
          setJobs((j) => {
            const n = { ...j };
            delete n[lessonId];
            return n;
          });
          await reload();
        }
      } catch {
        clearInterval(timers.current[lessonId]);
      }
    }, 1200);
  }

  async function uploadVideo(lessonId: string, file: File) {
    setErr(null);
    setJobs((j) => ({ ...j, [lessonId]: { progress: 0, stage: "Uploading source…", status: "pending" } }));
    await guard(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const video = await api(`/api/lessons/${lessonId}/video`, { method: "POST", body: fd });
      pollVideo(lessonId, video.id);
    });
  }

  async function uploadPdf(lessonId: string, file: File) {
    await guard(async () => {
      const fd = new FormData();
      fd.append("file", file);
      await api(`/api/lessons/${lessonId}/pdfs`, { method: "POST", body: fd });
      await reload();
    });
  }

  async function delPdf(pdfId: string) {
    await guard(async () => {
      await api(`/api/pdfs/${pdfId}`, { method: "DELETE" });
      await reload();
    });
  }

  async function delLesson(lessonId: string) {
    await guard(async () => {
      await api(`/api/lessons/${lessonId}`, { method: "DELETE" });
      await reload();
    });
  }
  async function delChapter(chapterId: string) {
    await guard(async () => {
      await api(`/api/chapters/${chapterId}`, { method: "DELETE" });
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
      <div className="studio-head">
        <div>
          <Link href="/admin/studio" className="crumb">← All courses</Link>
          <h1>{tree.title}</h1>
          <p className="muted">
            {tree.audience} · {tree.chapters.length} chapters ·{" "}
            {tree.chapters.reduce((n, c) => n + c.lessons.length, 0)} lessons
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

      {/* Chapters + lessons */}
      {tree.chapters.map((ch, ci) => (
        <section key={ch.id} className="chapter-block">
          <div className="chapter-title-row">
            <h2>
              <span className="phase-index">Chapter {ci + 1}</span> {ch.title}
            </h2>
            <button className="btn btn-small btn-ghost danger" onClick={() => delChapter(ch.id)}>Delete</button>
          </div>

          {ch.lessons.map((ls, li) => (
            <div key={ls.id} className="lesson-item">
              <div className="lesson-row">
                <div className="lesson-main">
                  <span className="lesson-title">
                    {ci + 1}.{li + 1} &nbsp;{ls.title}
                  </span>
                  {ls.takeaway && <span className="lesson-sub">{ls.takeaway}</span>}
                </div>
                <VideoState v={ls.video} job={jobs[ls.id]} />
              </div>

              <div className="lesson-actions">
                <label className="btn btn-small btn-ghost file">
                  {ls.video ? "Replace video" : "Upload video"}
                  <input
                    type="file"
                    accept="video/*"
                    hidden
                    onChange={(e) => e.target.files?.[0] && uploadVideo(ls.id, e.target.files[0])}
                  />
                </label>
                <label className="btn btn-small btn-ghost file">
                  + PDF
                  <input
                    type="file"
                    accept="application/pdf"
                    hidden
                    onChange={(e) => e.target.files?.[0] && uploadPdf(ls.id, e.target.files[0])}
                  />
                </label>
                <button
                  className="btn btn-small btn-ghost"
                  onClick={() => setOpenQuiz(openQuiz === ls.id ? null : ls.id)}
                >
                  Quiz {ls.quizCount ? `(${ls.quizCount})` : ""}
                </button>
                <button className="btn btn-small btn-ghost danger" onClick={() => delLesson(ls.id)}>Delete</button>
              </div>

              {ls.pdfs.length > 0 && (
                <div className="pdf-chips">
                  {ls.pdfs.map((p) => (
                    <span key={p.id} className="chip">
                      <a href={p.url} target="_blank" rel="noreferrer">{p.title}</a>
                      <button onClick={() => delPdf(p.id)}>×</button>
                    </span>
                  ))}
                </div>
              )}

              {openQuiz === ls.id && <QuizPanel lessonId={ls.id} onSaved={reload} />}
            </div>
          ))}

          <div className="mini-form">
            <input
              placeholder="New lesson title"
              value={lessonTitle[ch.id] || ""}
              onChange={(e) => setLessonTitle((m) => ({ ...m, [ch.id]: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && addLesson(ch.id)}
            />
            <button className="btn btn-small btn-primary" onClick={() => addLesson(ch.id)}>Add lesson</button>
          </div>
        </section>
      ))}

      <div className="mini-form add-chapter">
        <input
          placeholder="New chapter title (e.g. Get Started)"
          value={chapterTitle}
          onChange={(e) => setChapterTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addChapter()}
        />
        <button className="btn btn-primary btn-small" onClick={addChapter}>Add chapter</button>
      </div>

      {/* Certificate */}
      <h2 className="section-title">Certificate</h2>
      <CertPanel courseId={initial.id} cert={tree.certificate} onSaved={reload} />
    </div>
  );
}
