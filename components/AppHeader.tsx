"use client";

import { NotificationBell } from "@/components/NotificationPanel";

export function AppHeader() {
  return (
    <header
      className="sticky top-0 z-[60] flex items-center justify-end px-4 bg-[#080910]/90 backdrop-blur-sm"
      style={{
        paddingTop: "max(0.5rem, env(safe-area-inset-top))",
        paddingBottom: "0.375rem",
        minHeight: "calc(env(safe-area-inset-top) + 36px)",
      }}
    >
      <NotificationBell />
    </header>
  );
}
