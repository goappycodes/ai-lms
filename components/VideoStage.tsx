"use client";

import Link from "next/link";
import { useState } from "react";
import { Session, Track } from "@/lib/types";

export default function VideoStage({
  track,
  session,
  next,
}: {
  track: Track;
  session: Session;
  next: Session | null;
}) {
  const [lang, setLang] = useState<"EN" | "ML">("EN");
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <div className="stage">
      <div className={"video" + (playing ? " is-playing" : "")}>
        {!playing ? (
          <button className="big-play" onClick={() => setPlaying(true)} aria-label="Play session">
            <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden>
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
          </button>
        ) : (
          <div className="playing-note">
            <div className="pulse" />
            <p>Now playing — {lang === "EN" ? "English" : "Malayalam"} audio</p>
            <small>HLS stream from Cloudflare R2 · 1080p→240p adaptive ladder (brief §7)</small>
          </div>
        )}

        <div className="video-overlay">
          <span className="badge">{session.advanced ? "Advanced" : track.name}</span>
          <h1>
            {session.n}. {session.title}
          </h1>
        </div>

        <div className="video-controls">
          <span className="scrubber">
            <i style={{ width: playing ? "35%" : "0%" }} />
          </span>
          <div className="lang-toggle small" aria-label="Audio language">
            <button className={lang === "EN" ? "on" : ""} onClick={() => setLang("EN")}>
              EN
            </button>
            <button className={lang === "ML" ? "on" : ""} onClick={() => setLang("ML")}>
              ML
            </button>
          </div>
        </div>
      </div>

      <div className="stage-actions">
        <button className={"btn " + (done ? "btn-ghost" : "btn-primary")} onClick={() => setDone(!done)}>
          {done ? "✓ Marked complete" : "Mark session complete"}
        </button>
        {next ? (
          <Link className="btn btn-ghost" href={`/learn/${track.id}/${next.id}`}>
            Next: {next.title} →
          </Link>
        ) : (
          <Link className="btn btn-ghost" href={`/certificate/${track.id}`}>
            Finish → Certificate
          </Link>
        )}
      </div>
    </div>
  );
}
