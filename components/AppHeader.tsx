"use client";

import { NotificationBell } from "@/components/NotificationPanel";

export function AppHeader() {
  return (
    <header
      className="sticky top-0 z-[60] flex items-center justify-end px-4 backdrop-blur-sm"
      style={{
        background: "rgba(10,10,10,0.92)",
        paddingTop: "0.5rem",
        paddingBottom: "0.375rem",
        minHeight: "44px",
      }}
    >
      <NotificationBell />
    </header>
  );
}
