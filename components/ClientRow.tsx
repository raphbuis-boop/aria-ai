"use client";

import { fmtMoney, initials, relTime } from "@/lib/utils";
import Link from "next/link";

export type ClientRowData = {
  id: string;
  name: string;
  status: string | null;
  town: string | null;
  budget_max: number | null;
  lead_score: number | null;
  last_engagement_at: string | null;
  automation_active?: boolean;
};

const statusColors: Record<string, string> = {
  new: "bg-[rgba(59,130,246,0.15)] text-accent-blue",
  contacted: "bg-[rgba(59,130,246,0.15)] text-accent-blue",
  showing: "bg-[rgba(245,158,11,0.15)] text-accent-amber",
  offer: "bg-[rgba(139,92,246,0.15)] text-accent-purple",
  under_contract: "bg-[rgba(139,92,246,0.15)] text-accent-purple",
  closed: "bg-[rgba(16,185,129,0.15)] text-accent-green",
  dead: "bg-bg-deep text-text-dim",
};

export function ClientRow({ c }: { c: ClientRowData }) {
  const score = c.lead_score ?? 0;
  return (
    <Link
      href={`/clients/${c.id}`}
      className="flex items-center gap-3 rounded-[14px] border border-border-card bg-bg-card px-3 py-3"
    >
      <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border-card bg-bg-deep text-[12px] font-medium text-accent-blue">
        {initials(c.name)}
        {c.automation_active ? (
          <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent-green" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium text-text-primary">
            {c.name}
          </span>
          <span
            className={`rounded-[6px] px-2 py-0.5 text-[10px] font-medium ${
              statusColors[c.status ?? "new"] ?? statusColors.new
            }`}
          >
            {(c.status ?? "new").replace("_", " ")}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-dim">
          <span>{c.town ?? "—"}</span>
          <span>
            {c.budget_max != null ? `Up to ${fmtMoney(c.budget_max)}` : "—"}
          </span>
          <span>{relTime(c.last_engagement_at)}</span>
        </div>
      </div>
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${
              i < score ? "bg-accent-blue" : "bg-bg-deep"
            }`}
          />
        ))}
      </div>
    </Link>
  );
}
