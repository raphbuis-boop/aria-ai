import { PageSkeleton, Skeleton, SkeletonRows } from "@/components/Skeleton";

export default function ShowingsLoading() {
  return (
    <PageSkeleton label="Loading showings…">
      <div className="mb-6 flex items-end justify-between">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>
      <SkeletonRows count={5} />
    </PageSkeleton>
  );
}
