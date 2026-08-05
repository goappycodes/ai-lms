import TopNav from "@/components/TopNav";
import { Skeleton, SnakeBar } from "@/components/Skeleton";

export default function Loading() {
  return (
    <>
      <TopNav />
      <main className="container">
        <SnakeBar className="snake-top" />
        <div className="page-head">
          <div>
            <Skeleton w={90} h={13} style={{ marginBottom: 10 }} />
            <Skeleton w={260} h={30} style={{ marginBottom: 8 }} />
            <Skeleton w={360} h={14} />
          </div>
        </div>
        <div className="studio-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="studio-card">
              <div className="studio-card-top" style={{ background: "var(--surface-2)" }}>
                <Skeleton w={120} h={22} />
              </div>
              <div className="studio-card-body">
                <Skeleton w="80%" h={14} style={{ marginBottom: 14 }} />
                <div className="studio-card-meta">
                  <Skeleton w={70} h={12} />
                  <Skeleton w={90} h={12} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
