import { fmtDateTime } from "@/lib/utils";

const badgeBase =
  "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase whitespace-nowrap";

const statusStyle: Record<string, string> = {
  scheduled: `${badgeBase} bg-blue-500/10 text-blue-400`,
  completed: `${badgeBase} bg-green-500/10 text-green-400`,
  cancelled: `${badgeBase} bg-red-500/10 text-red-400`,
  considering: `${badgeBase} bg-amber-500/10 text-amber-400`,
  "strong interest": `${badgeBase} bg-green-500/10 text-green-400`,
  strong_interest: `${badgeBase} bg-green-500/10 text-green-400`,
  "not a fit": `${badgeBase} bg-red-500/10 text-red-400`,
  not_a_fit: `${badgeBase} bg-red-500/10 text-red-400`,
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
  const badgeClass = statusStyle[st] ?? statusStyle.scheduled;
  return (
    <div className="bg-[#12121e] border border-[#1e1e2e] rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[#d0d0e0] mb-1">
            {address ?? "—"}
          </div>
          <div className="text-xs text-[#555570]">
            {clientName} · {fmtDateTime(showing_date)}
          </div>
        </div>
        <span className={badgeClass}>{st.replace(/_/g, " ")}</span>
      </div>
      {notes ? (
        <p className="text-xs text-[#888898] mt-1">{notes}</p>
      ) : null}
      {ai_summary ? (
        <p className="text-xs text-[#888898] mt-1">{ai_summary}</p>
      ) : null}
      {next_action ? (
        <p className="text-xs text-[#4f7bff] mt-1">Next: {next_action}</p>
      ) : null}
    </div>
  );
}
