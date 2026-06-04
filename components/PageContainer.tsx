// PageContainer — standard page content wrapper.
//
// Use this on every page's outermost content div.
// It handles:
//   - No horizontal overflow
//   - Bottom clearance above the fixed BottomNav pill
//
// Bottom clearance math:
//   body has padding-bottom: env(safe-area-inset-bottom)
//   BottomNav pill: bottom = env(safe-area-inset-bottom) + 16px, height ~68px
//   Top of pill ~84px above body bottom → pb-28 (112px) gives ~28px breathing room.
//
// Phase 2: each *-client.tsx wraps its outermost div in this instead of
// inventing per-page pb-[130px] / pb-24 / min-h-screen hacks.

import { cn } from "@/lib/utils";

export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full max-w-full overflow-x-hidden pb-28", className)}>
      {children}
    </div>
  );
}
