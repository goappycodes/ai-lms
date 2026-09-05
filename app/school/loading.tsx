import {
  LoadingShell,
  PageHeadSkeleton,
  StatsSkeleton,
  SectionHeadSkeleton,
  TableSkeleton,
} from "@/components/Skeleton";

export default function Loading() {
  return (
    <LoadingShell>
      <PageHeadSkeleton />
      <StatsSkeleton n={3} />
      <SectionHeadSkeleton />
      <TableSkeleton rows={3} cols={6} className="table-classes" />
      <SectionHeadSkeleton />
      <TableSkeleton rows={2} cols={4} className="table-teachers" />
    </LoadingShell>
  );
}
