import { LoadingShell, PageHeadSkeleton, StatsSkeleton, TableSkeleton } from "@/components/Skeleton";
import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <LoadingShell>
      <PageHeadSkeleton />
      <StatsSkeleton n={2} />
      <Skeleton w={104} h={21} style={{ margin: "44px 0 18px" }} />
      <TableSkeleton rows={3} cols={5} className="table-teacher-classes" />
    </LoadingShell>
  );
}
