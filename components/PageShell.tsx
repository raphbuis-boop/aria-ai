"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Wraps page content and replays the page-enter animation on every route change.
 * This gives tab switches the native "slide up + fade in" feel without a router library.
 */
export function PageShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Force re-animation by removing and re-adding the class
    el.classList.remove("page-enter");
    // Trigger reflow
    void el.offsetWidth;
    el.classList.add("page-enter");
  }, [pathname]);

  return (
    <div ref={ref} className="page-enter">
      {children}
    </div>
  );
}
