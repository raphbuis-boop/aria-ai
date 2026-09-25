import { PageSkeleton, Skeleton, SkeletonRows } from "@/components/Skeleton";

export default function ClientsLoading() {
  return (
    <PageSkeleton label="Loading clients…">
      <div className="mb-6 flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>
      <Skeleton className="mb-3 h-12 w-full rounded-xl" />
      <div className="mb-6 flex gap-2">
        {[16, 14, 16, 18].map((w, i) => (
          <Skeleton key={i} className="h-9 rounded-full" style={{ width: w * 4 }} />
        ))}
      </div>
      <SkeletonRows count={6} />
    </PageSkeleton>
  );
}
