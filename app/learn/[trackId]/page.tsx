import { redirect } from "next/navigation";
import { getTrack } from "@/lib/data";
import { currentSession } from "@/lib/progress";
import { requirePage } from "@/lib/auth/guard";

// Opening a track jumps to the resume point (or session 1).
export default async function TrackIndex({ params }: { params: { trackId: string } }) {
  await requirePage();

  const track = getTrack(params.trackId);
  if (!track) redirect("/learning");

  const n = currentSession[track.id] ?? 1;
  const s = track.sessions.find((x) => x.n === n) ?? track.sessions[0];
  redirect(`/learn/${track.id}/${s.id}`);
}
