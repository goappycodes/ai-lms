import { NavSkeleton, Skeleton, SnakeBar } from "@/components/Skeleton";

/**
 * The lesson screen: video on the left, curriculum on the right.
 *
 * Shaped like the real player so the video frame does not jump into place
 * once it arrives — on a phone that jump moves everything below it.
 */
export default function Loading() {
  return (
    <>
      <NavSkeleton />
      <div className="player" role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">Loading</span>
        <main className="player-main">
          <SnakeBar className="snake-top" />
          <Skeleton w={110} h={13} style={{ marginBottom: 18 }} />
          <Skeleton w="100%" h={0} style={{ aspectRatio: "16 / 9", height: "auto" }} r={14} />
          <Skeleton w="55%" h={26} style={{ margin: "22px 0 10px" }} />
          <Skeleton w="80%" h={14} style={{ marginBottom: 26 }} />
          <div className="skel-resources">
            <Skeleton w="100%" h={62} r={12} />
            <Skeleton w="100%" h={62} r={12} />
          </div>
        </main>
        <aside className="curriculum" aria-hidden>
          <Skeleton w={130} h={18} style={{ marginBottom: 18 }} />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} w="100%" h={46} r={10} style={{ marginBottom: 10 }} />
          ))}
        </aside>
      </div>
    </>
  );
}
