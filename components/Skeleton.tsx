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
