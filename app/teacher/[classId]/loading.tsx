import { LoadingShell, PageHeadSkeleton, StatsSkeleton, TableSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <LoadingShell>
      <PageHeadSkeleton crumb action />
      <StatsSkeleton n={2} />
      <TableSkeleton rows={4} cols={5} />
    </LoadingShell>
  );
}
