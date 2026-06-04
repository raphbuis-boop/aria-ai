import { Surface } from "@/components/v2/Surface";

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[6px] bg-[#1C1D21] ${className ?? ""}`}
    />
  );
}

export default function TodayLoading() {
  return (
    <div className="px-4 pt-12 pb-6 space-y-5 max-w-lg mx-auto">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Shimmer className="h-3 w-24" />
          <Shimmer className="h-7 w-48" />
        </div>
        <Shimmer className="size-9 rounded-full" />
      </div>

      {/* Brief card */}
      <Surface variant="raised" className="p-4 space-y-2 border-[#4F5BFF]/30">
        <Shimmer className="h-3 w-16" />
        <Shimmer className="h-4 w-full" />
        <Shimmer className="h-4 w-4/5" />
      </Surface>

      {/* Section label */}
      <Shimmer className="h-2.5 w-28" />

      {/* Action items */}
      {[1, 2, 3].map((i) => (
        <Surface key={i} variant="surface" className="p-4 flex items-center gap-3">
          <Shimmer className="size-2 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Shimmer className="h-3.5 w-32" />
            <Shimmer className="h-3 w-48" />
          </div>
          <Shimmer className="h-8 w-20 rounded-[9px]" />
        </Surface>
      ))}

      {/* Pipeline section label */}
      <Shimmer className="h-2.5 w-20 mt-2" />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Surface key={i} variant="surface" className="p-3 space-y-2">
            <Shimmer className="h-7 w-16" />
            <Shimmer className="h-2.5 w-24" />
          </Surface>
        ))}
      </div>
    </div>
  );
}
