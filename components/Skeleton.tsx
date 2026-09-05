// Shimmer skeleton primitives. Use for content that loads from the DB.
export function Skeleton({
  w,
  h = 14,
  r = 8,
  className = "",
  style,
}: {
  w?: number | string;
  h?: number | string;
  r?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`skel ${className}`}
      style={{ width: w, height: h, borderRadius: r, display: "block", ...style }}
      aria-hidden
    />
  );
}

// An indeterminate "snake" bar — a segment that slithers across a track.
export function SnakeBar({ className = "" }: { className?: string }) {
  return (
    <div className={`snake ${className}`} role="progressbar" aria-label="Loading">
      <i />
    </div>
  );
}

// A compact snake spinner (rotating arc) for buttons / inline use.
export function SnakeSpinner({ size = 16 }: { size?: number }) {
  return <span className="snake-spin" style={{ width: size, height: size }} aria-label="Loading" />;
}

// ---------------------------------------------------------------------------
// Composite shells for loading.tsx.
//
// Shaped like the page they stand in for — a table skeleton carries the real
// column count, the stat row the real card count — because a placeholder that
// does not match makes the layout jump when content arrives, which reads as
// slower than having shown nothing.
// ---------------------------------------------------------------------------

/**
 * The top bar, drawn without asking who is signed in.
 *
 * Deliberately not the real <TopNav />: that is an async server component, and
 * a Suspense fallback that has to await a database round trip is not a loading
 * state — it arrives at the same time as the page it was meant to cover. The
 * brand needs no data so it is drawn for real; only the links and the avatar,
 * which depend on the user, are placeholders.
 */
export function NavSkeleton() {
  return (
    <header className="topnav" aria-hidden>
      <div className="topnav-inner">
        <span className="brand">
          <span className="brand-mark">
            <span className="mark-glyph">व</span>
          </span>
          <span className="brand-name">AI Veda</span>
        </span>
        <div className="skel-nav">
          <Skeleton w={74} h={12} />
          <Skeleton w={56} h={12} />
          <Skeleton w={62} h={12} />
        </div>
        <div className="topnav-right">
          <Skeleton w={34} h={34} r={999} />
        </div>
      </div>
    </header>
  );
}

/** Title, subtitle, and optionally the action button that sits opposite. */
export function PageHeadSkeleton({
  crumb = false,
  action = false,
}: {
  crumb?: boolean;
  action?: boolean;
}) {
  return (
    <div className="page-head">
      <div>
        {crumb && <Skeleton w={92} h={13} style={{ marginBottom: 10 }} />}
        <Skeleton w={240} h={30} style={{ marginBottom: 8 }} />
        <Skeleton w={180} h={14} />
      </div>
      {action && <Skeleton w={130} h={40} r={999} />}
    </div>
  );
}

export function StatsSkeleton({ n = 3 }: { n?: number }) {
  return (
    <div className="stat-row">
      {Array.from({ length: n }).map((_, i) => (
        <div className="stat" key={i}>
          <Skeleton w={46} h={30} style={{ marginBottom: 8 }} />
          <Skeleton w={70} h={12} />
        </div>
      ))}
    </div>
  );
}

export function SectionHeadSkeleton() {
  return (
    <div className="section-head">
      <Skeleton w={104} h={21} />
      <Skeleton w={106} h={34} r={999} />
    </div>
  );
}

/** Same column count as the table it replaces, so nothing shifts on arrival. */
export function TableSkeleton({
  rows = 3,
  cols = 5,
  className = "",
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div className={`table ${className}`}>
      <div className="tr th">
        {Array.from({ length: cols }).map((_, i) => (
          <span key={i}>
            <Skeleton w={i === 0 ? 62 : 46} h={10} />
          </span>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div className="tr" key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <span key={c}>
              <Skeleton w={c === 0 ? "72%" : c === cols - 1 ? 56 : "48%"} h={13} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/** The course cards on My Learning. */
export function CardsSkeleton({ n = 3 }: { n?: number }) {
  return (
    <div className="track-grid">
      {Array.from({ length: n }).map((_, i) => (
        <div className="skel-card" key={i}>
          <Skeleton w="100%" h={110} r={12} style={{ marginBottom: 16 }} />
          <Skeleton w="62%" h={20} style={{ marginBottom: 10 }} />
          <Skeleton w="92%" h={13} style={{ marginBottom: 7 }} />
          <Skeleton w="45%" h={13} />
        </div>
      ))}
    </div>
  );
}

/**
 * The frame every loading screen shares: the nav, the crimson progress bar,
 * and one announcement for a screen reader rather than one per grey box.
 */
export function LoadingShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavSkeleton />
      <main className="container" role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">Loading</span>
        <SnakeBar className="snake-top" />
        {children}
      </main>
    </>
  );
}
