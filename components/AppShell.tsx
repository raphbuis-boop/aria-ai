// AppShell — authenticated dashboard wrapper.
//
// Deliberately minimal. Renders only:
//   - Background automation tasks (invisible)
//   - Page fade animation shell
//   - Fixed bottom navigation
//
// Each page owns its own title, header area, and top spacing.
// There is no global website-style header.
//
// Safe-area contract (single source of truth):
//   body (globals.css) — padding-top: env(safe-area-inset-top)
//   BottomNav          — bottom: calc(env(safe-area-inset-bottom) + 12px)
//   Pages              — pb-28 via PageContainer (clears nav pill)
//   Nothing else touches safe-area insets.

import { AutomationRunner } from "@/components/AutomationRunner";
import { BottomNav } from "@/components/BottomNav";
import { PageShell } from "@/components/PageShell";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full max-w-full">
      <AutomationRunner />
      <PageShell>{children}</PageShell>
      <BottomNav />
    </div>
  );
}
