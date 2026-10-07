import { cn } from "@/lib/utils";

/** A single placeholder block. Size it with className (h-4 w-32, etc.). */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden="true" style={style} className={cn("rounded-md bg-secondary motion-safe:animate-pulse", className)} />;
}

/** Announces loading to screen readers; children are the visual skeleton. */
export function SkeletonRegion({ label = "Loading…", className, children }: { label?: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Rows shaped like the app's list rows: avatar, two text lines, trailing meta. */
export function SkeletonRows({ count = 4, avatar = true }: { count?: number; avatar?: boolean }) {
  return (
    <div aria-hidden="true" className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          {avatar ? <Skeleton className="size-10 shrink-0 rounded-full" /> : null}
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className={cn("h-3", i % 2 ? "w-1/3" : "w-1/2")} />
          </div>
          <Skeleton className="h-3 w-10" />
        </div>
      ))}
    </div>
  );
}

/** Property/listing card: photo block over three text lines. */
export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="grid grid-cols-1 gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-3.5">
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="mt-3 h-4 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/2" />
          <Skeleton className="mt-2 h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Page frame matching the dashboard pages: title, optional subtitle, sections. */
export function PageSkeleton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <SkeletonRegion label={label} className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-5 pb-32 pt-10 sm:px-8">{children}</div>
    </SkeletonRegion>
  );
}

export function SectionSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <Skeleton className="mb-3 h-3 w-24" />
      {children}
    </div>
  );
}
