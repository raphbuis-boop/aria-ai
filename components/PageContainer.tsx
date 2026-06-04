// PageContainer — standard page content wrapper.
//
// Responsibilities:
//   - Prevents horizontal overflow on any page
//   - Adds correct bottom clearance for the fixed BottomNav pill
//
// Bottom clearance math:
//   body padding-bottom: env(safe-area-inset-bottom) — absorbs home indicator
//   BottomNav pill bottom: calc(env(safe-area-inset-bottom) + 12px) from viewport
//   Pill height: ~68px  →  top of pill = ~80px from body bottom edge
//   pb-24 (96px) keeps all content above the pill with 16px breathing room.
//
// Phase 1: created but not yet applied to individual pages (Phase 2).
// Phase 2: each *-client.tsx drops its own outer padding div and wraps in this.

import { cn } from "@/lib/utils";

export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full max-w-full overflow-x-hidden pb-24", className)}>
      {children}
    </div>
  );
}
