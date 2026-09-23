import { differenceInHours, isBefore } from "date-fns";
import { fmtDate } from "@/lib/utils";

export function TransactionMilestone({
  label,
  dateIso,
}: {
  label: string;
  dateIso: string | null;
}) {
  const now = new Date();
  if (!dateIso) {
    return (
      <div className="flex gap-3 rounded-[10px] border border-border bg-card px-3 py-2">
        <div className="mt-1 h-3 w-3 rounded-full bg-muted-foreground" />
        <div>
          <div className="text-[13px] text-foreground">{label}</div>
          <div className="text-[11px] text-muted-foreground">TBD</div>
        </div>
      </div>
    );
  }
  const d = new Date(dateIso);
  const passed = isBefore(d, now);
  let color = "bg-primary";
  if (passed) {
    color = "bg-primary";
  } else {
    const hours = differenceInHours(d, now);
    if (hours >= 0 && hours <= 48) color = "bg-warm";
  }

  return (
    <div className="flex gap-3 rounded-[10px] border border-border bg-card px-3 py-2">
      <div className={`mt-1 h-3 w-3 rounded-full ${color}`} />
      <div>
        <div className="text-[13px] text-foreground">{label}</div>
        <div className="text-[11px] text-muted-foreground">{fmtDate(dateIso)}</div>
      </div>
    </div>
  );
}
