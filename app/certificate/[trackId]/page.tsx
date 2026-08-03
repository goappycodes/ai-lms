import Link from "next/link";
import { notFound } from "next/navigation";
import TopNav from "@/components/TopNav";
import { getTrack } from "@/lib/data";
import { pct, student } from "@/lib/progress";

export default function CertificatePage({ params }: { params: { trackId: string } }) {
  const track = getTrack(params.trackId);
  if (!track) notFound();

  const p = pct(track.id, track.sessions.length);
  const complete = p >= 100;

  return (
    <>
      <TopNav />
      <main className="container narrow">
        <Link href={`/learn/${track.id}`} className="crumb">
          ← Back to course
        </Link>

        {complete ? (
          <div className="certificate">
            <div className="cert-border">
              <p className="cert-program">AI VEDA</p>
              <p className="cert-kicker">Certificate of Completion</p>
              <p className="cert-sub">This certifies that</p>
              <h1 className="cert-name">{student.name}</h1>
              <p className="cert-sub">
                has completed the AI Veda <strong>{track.name}</strong> track ({track.audience})
              </p>
              <div className="cert-foot">
                <div>
                  <span className="sig">NEXIS School of Business</span>
                  <small>Issuing body</small>
                </div>
                <div className="cert-seal">
                  <span className="mark-glyph">व</span>
                </div>
                <div>
                  <span className="sig">Government of Kerala</span>
                  <small>In partnership</small>
                </div>
              </div>
            </div>
            <div className="cert-actions">
              <a className="btn btn-primary" href="#">
                Download PDF (EN)
              </a>
              <a className="btn btn-ghost" href="#">
                Download PDF (ML)
              </a>
            </div>
          </div>
        ) : (
          <div className="panel center">
            <h1>Almost there</h1>
            <p className="muted">
              Your certificate unlocks when you complete all {track.sessions.length} sessions of the{" "}
              {track.name} track. You are {p}% through.
            </p>
            <Link className="btn btn-primary" href={`/learn/${track.id}`}>
              Continue learning
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
