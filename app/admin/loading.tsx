import { LoadingShell, PageHeadSkeleton, StatsSkeleton, TableSkeleton } from "@/components/Skeleton";
import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <LoadingShell>
      <PageHeadSkeleton action />
      <Skeleton w={150} h={21} style={{ margin: "44px 0 18px" }} />
      <StatsSkeleton n={3} />
      <Skeleton w={150} h={21} style={{ margin: "44px 0 18px" }} />
      <TableSkeleton rows={3} cols={5} />
    </LoadingShell>
  );
}
