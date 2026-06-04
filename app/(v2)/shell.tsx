"use client";

import * as React from "react";
import { BottomNav } from "@/components/v2/BottomNav";
import type { NavDestination } from "@/components/v2/BottomNav";

/**
 * Five-destination nav:  Today · Inbox · Ask (center FAB) · Pipeline · Search
 *
 * Icons are inline SVGs (no extra dependency).
 * Real icons (lucide-react) will replace these in Phase 2 once the visual
 * direction is locked.
 */

const TodayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M3 8h14" stroke="currentColor" strokeWidth="1.5" />
    <path d="M7 2v2M13 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const InboxIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M3 6a1 1 0 011-1h12a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V6z" stroke="currentColor" strokeWidth="1.5" />
    <path d="M3 8l7 4 7-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const AskIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path d="M11 5v12M5 11h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const PipelineIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M3 14h4V8H3v6zM8 14h4V5H8v9zM13 14h4v-4h-4v4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="9" cy="9" r="5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M13 13l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const NAV_DESTINATIONS: NavDestination[] = [
  { key: "today", href: "/v2/today", label: "Today", icon: <TodayIcon /> },
  { key: "inbox", href: "/v2/inbox", label: "Inbox", icon: <InboxIcon /> },
  { key: "ask", href: "/v2/ask", label: "Ask", icon: <AskIcon />, isFab: true },
  { key: "pipeline", href: "/v2/pipeline", label: "Pipeline", icon: <PipelineIcon /> },
  { key: "search", href: "/v2/search", label: "Search", icon: <SearchIcon /> },
];

export function V2Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#0A0A0A]">
      {/* Page content — bottom nav height (60px) + safe area */}
      <main className="pb-[calc(60px+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <BottomNav destinations={NAV_DESTINATIONS} />
    </div>
  );
}
