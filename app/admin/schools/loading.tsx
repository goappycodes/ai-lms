import { LoadingShell, PageHeadSkeleton, TableSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <LoadingShell>
      <PageHeadSkeleton crumb action />
      <TableSkeleton rows={5} cols={6} className="table-schools" />
    </LoadingShell>
  );
}
