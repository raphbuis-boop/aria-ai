"use client";

import { useEffect, useRef } from "react";

export function AutomationRunner() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void fetch("/api/seed", { method: "POST" });
    void fetch("/api/automation/run", { method: "POST" });
  }, []);

  return null;
}
