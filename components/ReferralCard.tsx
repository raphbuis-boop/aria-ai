"use client";

import { fmtMoney } from "@/lib/utils";

const statusClass: Record<string, string> = {
  pending: "bg-[rgba(245,158,11,0.15)] text-accent-amber",
  accepted: "bg-[rgba(16,185,129,0.15)] text-accent-green",
  declined: "bg-bg-deep text-text-dim",
  closed: "bg-[rgba(59,130,246,0.15)] text-accent-blue",
};

export function ReferralCard({
  client_name,
  town,
  budget_max,
  status,
  meta,
  actions,
}: {
  client_name: string | null;
  town: string | null;
  budget_max: number | null;
  status: string | null;
  meta?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-[14px] border border-border-card bg-bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[15px] font-medium text-text-primary">
            {client_name}
          </div>
          <div className="text-[12px] text-text-dim">
            {town} ·{" "}
            {budget_max != null ? `Up to ${fmtMoney(budget_max)}` : "—"}
          </div>
          {meta ? <div className="mt-1 text-[11px] text-text-muted">{meta}</div> : null}
        </div>
        <span
          className={`rounded-[8px] px-2 py-1 text-[10px] font-medium capitalize ${
            statusClass[status ?? "pending"] ?? statusClass.pending
          }`}
        >
          {status}
        </span>
      </div>
      {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
