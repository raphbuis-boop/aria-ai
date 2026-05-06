"use client";

import { NotificationBell } from "@/components/NotificationPanel";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-[60] flex h-12 items-center justify-end px-4 bg-[#0a0a0f]/90 backdrop-blur-sm">
      <NotificationBell />
    </header>
  );
}
