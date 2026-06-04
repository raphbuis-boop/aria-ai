"use client";

// PageShell — replays the page-enter fade on every route change.
//
// Previously this animation used transform: translateY(6px), which created a
// CSS containing block. Any fixed-positioned child (full-screen overlays, chat
// thread views, voice screen) was positioned relative to this shell instead of
// the viewport — causing broken layouts on /inbox and /voice.
//
// The fix: page-enter now uses opacity only (see globals.css). Opacity does NOT
// create a containing block, so fixed children are always viewport-relative.
// The /voice and /inbox bypass list has been removed — no longer needed.

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function PageShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("page-enter");
    void el.offsetWidth; // force reflow so the animation replays
    el.classList.add("page-enter");
  }, [pathname]);

  return (
    <div ref={ref} className="page-enter">
      {children}
    </div>
  );
}
