import { LoadingShell, PageHeadSkeleton, CardsSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <LoadingShell>
      <PageHeadSkeleton />
      <CardsSkeleton n={3} />
    </LoadingShell>
  );
}
