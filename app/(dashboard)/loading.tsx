import { PageSkeleton, SectionSkeleton, Skeleton, SkeletonRows } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <PageSkeleton label="Loading page…">
      <Skeleton className="mb-8 h-9 w-44" />
      <SectionSkeleton>
        <SkeletonRows count={3} />
      </SectionSkeleton>
      <SectionSkeleton>
        <SkeletonRows count={3} />
      </SectionSkeleton>
    </PageSkeleton>
  );
}
