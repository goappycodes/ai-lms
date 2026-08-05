import TopNav from "@/components/TopNav";
import { Skeleton, SnakeBar } from "@/components/Skeleton";

export default function Loading() {
  return (
    <>
      <TopNav />
      <main className="container">
        <SnakeBar className="snake-top" />
        <div className="studio-head">
          <div>
            <Skeleton w={90} h={13} style={{ marginBottom: 10 }} />
            <Skeleton w={220} h={30} style={{ marginBottom: 8 }} />
            <Skeleton w={300} h={14} />
          </div>
        </div>

        {Array.from({ length: 2 }).map((_, ci) => (
          <section key={ci} className="chapter-block">
            <div className="chapter-title-row">
              <Skeleton w={200} h={20} />
            </div>
            {Array.from({ length: 3 }).map((_, li) => (
              <div key={li} className="lesson-item">
                <div className="lesson-row">
                  <div className="lesson-main" style={{ gap: 8 }}>
                    <Skeleton w={260} h={15} />
                    <Skeleton w={340} h={12} />
                  </div>
                  <Skeleton w={110} h={20} r={999} />
                </div>
                <div className="lesson-actions">
                  <Skeleton w={110} h={30} r={10} />
                  <Skeleton w={70} h={30} r={10} />
                  <Skeleton w={80} h={30} r={10} />
                </div>
              </div>
            ))}
          </section>
        ))}
      </main>
    </>
  );
}
