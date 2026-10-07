import { PageSkeleton, SectionSkeleton, Skeleton, SkeletonRows } from "@/components/Skeleton";

export default function TodayLoading() {
  return (
    <PageSkeleton label="Loading Today…">
      <div className="mb-10 flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-52" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="size-11 rounded-full" />
          <Skeleton className="size-11 rounded-full" />
        </div>
      </div>
      <SectionSkeleton>
        <SkeletonRows count={2} />
      </SectionSkeleton>
      <SectionSkeleton>
        <SkeletonRows count={3} />
      </SectionSkeleton>
      <SectionSkeleton>
        <SkeletonRows count={2} avatar={false} />
      </SectionSkeleton>
    </PageSkeleton>
  );
}
