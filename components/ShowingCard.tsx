import { fmtDateTime } from "@/lib/utils";

const statusStyle: Record<string, string> = {
  scheduled: "bg-accent-blue/15 text-accent-blue",
  completed: "bg-accent-green/15 text-accent-green",
  cancelled: "bg-text-dim/20 text-text-dim",
};

export function ShowingCard({
  clientName,
  address,
  showing_date,
  status,
  notes,
  ai_summary,
  next_action,
}: {
  clientName: string;
  address: string | null;
  showing_date: string | null;
  status?: string | null;
  notes?: string | null;
  ai_summary: string | null;
  next_action: string | null;
}) {
  const st = status ?? "scheduled";
  return (
    <div className="rounded-[14px] border border-border-card bg-bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border-card bg-bg-deep px-2 py-0.5 text-[11px] text-text-secondary">
          {clientName}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${statusStyle[st] ?? statusStyle.scheduled}`}
        >
          {st}
        </span>
        <span className="text-[11px] text-text-dim">
          {fmtDateTime(showing_date)}
        </span>
      </div>
      <div className="mt-2 text-[14px] font-medium text-text-primary">
        {address}
      </div>
      {notes ? (
        <p className="mt-2 text-[12px] text-text-muted">{notes}</p>
      ) : null}
      {ai_summary ? (
        <p className="mt-2 text-[13px] text-text-secondary">{ai_summary}</p>
      ) : null}
      {next_action ? (
        <p className="mt-2 text-[12px] text-accent-blue">Next: {next_action}</p>
      ) : null}
    </div>
  );
}
