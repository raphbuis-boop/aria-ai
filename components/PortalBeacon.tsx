"use client";

import { useEffect } from "react";

// Fires a one-per-session "portal_open" engagement event when a client opens
// the personalized portal an agent sent them. This is the first real behavioral
// signal feeding lead heat (BUILD.md P1). Silent and fail-soft — it renders
// nothing and never throws.
export function PortalBeacon({ token }: { token: string }) {
  useEffect(() => {
    if (!token) return;
    try {
      const key = `aa_portal_open_${token}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage unavailable — still log the open below.
    }
    fetch("/api/engagement/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, event_type: "portal_open" }),
    }).catch(() => {
      /* never break the portal */
    });
  }, [token]);

  return null;
}
