import { fmtDateTime } from "@/lib/utils";

export function ShowingCard({
  clientName,
  address,
  showing_date,
  ai_summary,
  next_action,
}: {
  clientName: string;
  address: string | null;
  showing_date: string | null;
  ai_summary: string | null;
  next_action: string | null;
}) {
  return (
    <div className="rounded-[14px] border border-border-card bg-bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border-card bg-bg-deep px-2 py-0.5 text-[11px] text-text-secondary">
          {clientName}
        </span>
        <span className="text-[11px] text-text-dim">
          {fmtDateTime(showing_date)}
        </span>
      </div>
      <div className="mt-2 text-[14px] font-medium text-text-primary">
        {address}
      </div>
      {ai_summary ? (
        <p className="mt-2 text-[13px] text-text-secondary">{ai_summary}</p>
      ) : null}
      {next_action ? (
        <p className="mt-2 text-[12px] text-accent-blue">Next: {next_action}</p>
      ) : null}
    </div>
  );
}
