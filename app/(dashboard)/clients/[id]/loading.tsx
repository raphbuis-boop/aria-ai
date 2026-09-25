import { PageSkeleton, SectionSkeleton, Skeleton, SkeletonRows } from "@/components/Skeleton";

export default function ClientLoading() {
  return (
    <PageSkeleton label="Loading client…">
      <Skeleton className="mb-6 size-10 rounded-full" />
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-2 h-3 w-40" />
      <div className="mt-5 flex gap-2">
        <Skeleton className="h-9 w-28 rounded-full" />
        <Skeleton className="h-9 w-36 rounded-full" />
      </div>
      <Skeleton className="mb-10 mt-8 h-48 w-full rounded-2xl" />
      <SectionSkeleton>
        <SkeletonRows count={3} avatar={false} />
      </SectionSkeleton>
    </PageSkeleton>
  );
}
