// AppShell — single structural wrapper for all authenticated dashboard pages.
//
// Replaces the ad-hoc div in app/(dashboard)/layout.tsx.
// Contains all persistent chrome: header, page animation shell, bottom nav.
//
// Layout contract:
//   - Outer div: min-h-[100dvh] w-full max-w-full overflow-x-hidden
//     This is the one place that enforces no-horizontal-overflow globally.
//   - pb-24: baseline bottom clearance for the BottomNav pill.
//     Individual pages may increase this but should not go below 96px.
//   - Body owns padding-top: env(safe-area-inset-top) (globals.css).
//     Nothing inside AppShell touches safe-area-inset-top.
//   - BottomNav owns bottom: calc(env(safe-area-inset-bottom) + 12px).
//     Nothing inside AppShell touches safe-area-inset-bottom.

import { AutomationRunner } from "@/components/AutomationRunner";
import { MobileHeader } from "@/components/MobileHeader";
import { BottomNav } from "@/components/BottomNav";
import { PageShell } from "@/components/PageShell";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full max-w-full overflow-x-hidden pb-24">
      {/* Background automation tasks — no UI */}
      <AutomationRunner />
      {/* Sticky top header — reads pathname internally */}
      <MobileHeader />
      {/* Fade animation wrapper on every route change */}
      <PageShell>{children}</PageShell>
      {/* Fixed floating pill nav */}
      <BottomNav />
    </div>
  );
}
