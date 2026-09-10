"use client";

import { useEffect, useRef } from "react";

export function AutomationRunner() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    // NOTE: /api/seed (demo contact injection) is intentionally NOT called
    // here. It used to fire on every app mount, which would inject fake demo
    // contacts into a brand-new real account the first time it loaded.
    // Trigger it explicitly (e.g. from a demo button) if demo data is wanted.
    void fetch("/api/automation/run", { method: "POST" });
  }, []);

  return null;
}
