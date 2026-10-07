import { PageSkeleton, Skeleton, SkeletonRows } from "@/components/Skeleton";

export default function InboxLoading() {
  return (
    <PageSkeleton label="Loading follow-ups…">
      <div className="mb-6 flex items-end justify-between">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>
      <SkeletonRows count={5} />
    </PageSkeleton>
  );
}
