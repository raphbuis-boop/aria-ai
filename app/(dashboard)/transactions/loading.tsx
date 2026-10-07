import { PageSkeleton, Skeleton, SkeletonRows } from "@/components/Skeleton";

export default function TransactionsLoading() {
  return (
    <PageSkeleton label="Loading transactions…">
      <div className="mb-6 flex items-end justify-between">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>
      <SkeletonRows count={5} />
    </PageSkeleton>
  );
}
