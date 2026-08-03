import { redirect } from "next/navigation";
import { getTrack } from "@/lib/data";
import { currentSession } from "@/lib/progress";

// Opening a track jumps to the resume point (or session 1).
export default function TrackIndex({ params }: { params: { trackId: string } }) {
  const track = getTrack(params.trackId);
  if (!track) redirect("/learning");

  const n = currentSession[track.id] ?? 1;
  const s = track.sessions.find((x) => x.n === n) ?? track.sessions[0];
  redirect(`/learn/${track.id}/${s.id}`);
}
