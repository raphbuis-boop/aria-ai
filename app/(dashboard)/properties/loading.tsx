import { PageSkeleton, Skeleton, SkeletonCards } from "@/components/Skeleton";

export default function PropertiesLoading() {
  return (
    <PageSkeleton label="Loading properties…">
      <div className="mb-6 flex items-end justify-between">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>
      <Skeleton className="mb-6 h-12 w-full rounded-xl" />
      <SkeletonCards count={3} />
    </PageSkeleton>
  );
}
