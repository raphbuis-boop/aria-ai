import { fmtDate } from "@/lib/utils";

export function FileRow({
  name,
  file_type,
  created_at,
}: {
  name: string | null;
  file_type: string | null;
  created_at: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[10px] border border-border-card bg-bg-card px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-[13px] text-text-primary">{name}</div>
        <div className="text-[11px] text-text-dim">
          {(file_type ?? "other").replace("_", " ")} · {fmtDate(created_at)}
        </div>
      </div>
    </div>
  );
}
