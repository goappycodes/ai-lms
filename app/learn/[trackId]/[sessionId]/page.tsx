import Link from "next/link";
import { notFound } from "next/navigation";
import TopNav from "@/components/TopNav";
import CurriculumSidebar from "@/components/CurriculumSidebar";
import VideoStage from "@/components/VideoStage";
import SessionResources from "@/components/SessionResources";
import { getTrack } from "@/lib/data";
import { requirePage } from "@/lib/auth/guard";

export default async function PlayerPage({
  params,
}: {
  params: { trackId: string; sessionId: string };
}) {
  await requirePage();

  const track = getTrack(params.trackId);
  if (!track) notFound();

  const idx = track.sessions.findIndex((s) => s.id === params.sessionId);
  if (idx === -1) notFound();

  const session = track.sessions[idx];
  const next = track.sessions[idx + 1] ?? null;

  return (
    <>
      <TopNav />
      <div className="player">
        <main className="player-main">
          <Link href="/learning" className="crumb">
            ← My Learning
          </Link>
          <VideoStage track={track} session={session} next={next} />
          <SessionResources session={session} />
        </main>
        <CurriculumSidebar track={track} currentId={session.id} />
      </div>
    </>
  );
}
