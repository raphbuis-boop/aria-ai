import { fmtDateTime } from "@/lib/utils";
import Link from "next/link";
import { ShieldAlert, ShieldCheck } from "lucide-react";

const statusStyle: Record<string, string> = {
  scheduled: "bg-primary/10 text-primary",
  completed: "bg-primary/15 text-primary",
  cancelled: "bg-secondary text-muted-foreground",
};

export function ShowingCard({
  clientId,
  clientName,
  address,
  showing_date,
  status,
  notes,
  ai_summary,
  next_action,
  bbaSigned,
  upcoming,
}: {
  clientId?: string | null;
  clientName: string;
  address: string | null;
  showing_date: string | null;
  status?: string | null;
  notes?: string | null;
  ai_summary: string | null;
  next_action: string | null;
  bbaSigned?: boolean;
  upcoming?: boolean;
}) {
  const st = status ?? "scheduled";
  const showBbaBlock =
    bbaSigned !== undefined && (upcoming || st === "scheduled");
  return (
    <div className="rounded-[14px] border border-border bg-card p-4 pr-10">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border bg-secondary px-2 py-0.5 font-display text-[11px] text-muted-foreground">
          {clientName}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 font-display text-[10px] font-medium capitalize ${statusStyle[st] ?? statusStyle.scheduled}`}
        >
          {st}
        </span>
        <span className="font-display text-[11px] text-muted-foreground/60">
          {fmtDateTime(showing_date)}
        </span>
      </div>
      <div className="mt-2 font-display text-[14px] font-medium text-foreground">
        {address}
      </div>
      {notes ? (
        <p className="mt-2 font-display text-[12px] text-muted-foreground">{notes}</p>
      ) : null}
      {ai_summary ? (
        <p className="mt-2 font-display text-[13px] text-muted-foreground">{ai_summary}</p>
      ) : null}
      {next_action ? (
        <p className="mt-2 font-display text-[12px] font-medium text-primary">Next: {next_action}</p>
      ) : null}
      {showBbaBlock ? (
        bbaSigned ? (
          <div className="mt-3 flex items-center gap-1.5 rounded-[10px] border border-primary/20 bg-primary/10 px-2.5 py-1.5 font-display text-[11px] text-primary">
            <ShieldCheck size={12} /> BBA signed
          </div>
        ) : (
          <Link
            href={clientId ? `/clients/${clientId}` : "#"}
            className="mt-3 flex items-center justify-between gap-2 rounded-[10px] border border-destructive/25 bg-destructive/10 px-2.5 py-1.5 font-display text-[11px] text-destructive"
          >
            <span className="flex items-center gap-1.5">
              <ShieldAlert size={12} />
              BBA required before showing
            </span>
            <span className="font-semibold">Send link →</span>
          </Link>
        )
      ) : null}
    </div>
  );
}
