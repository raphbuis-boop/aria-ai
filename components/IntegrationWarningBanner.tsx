"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

type EnvHealth = {
  aiConfigured: boolean;
  emailConfigured: boolean;
  mlsConfigured: boolean;
};

/**
 * Shows a plain-English warning when a critical server integration is missing.
 * Without this, missing keys fail silently (e.g. AI drafting quietly falls
 * back to generic templates and nobody knows why).
 */
export function IntegrationWarningBanner() {
  const [health, setHealth] = useState<EnvHealth | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/health/env")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setHealth(d as EnvHealth);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!health) return null;

  const problems: string[] = [];
  if (!health.aiConfigured)
    problems.push("AI drafting is off — messages will use generic templates instead of your voice");
  if (!health.emailConfigured)
    problems.push("Email sending is off — reminder emails won't go out");
  if (problems.length === 0) return null;

  return (
    <div
      className="mb-5 flex items-start gap-3 rounded-[14px] p-4"
      style={{
        background: "rgba(245,158,11,0.10)",
        border: "0.5px solid rgba(245,158,11,0.35)",
      }}
    >
      <AlertTriangle size={18} style={{ color: "#F59E0B", flexShrink: 0, marginTop: 1 }} />
      <div>
        <p className="text-[13px] font-semibold" style={{ color: "#FBBF24" }}>
          Something needs attention
        </p>
        {problems.map((p) => (
          <p key={p} className="mt-1 text-[12px] leading-[1.5]" style={{ color: "#D6A23C" }}>
            {p}. Ask Raphael to check the app&apos;s settings.
          </p>
        ))}
      </div>
    </div>
  );
}
