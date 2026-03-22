"use client";

import { fmtDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export function TaskItem({
  id,
  title,
  due_at,
  done,
  overdue,
}: {
  id: string;
  title: string;
  due_at: string | null;
  done: boolean;
  overdue: boolean;
}) {
  const supabase = createClient();

  async function toggle() {
    await supabase.from("tasks").update({ done: !done }).eq("id", id);
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`flex w-full items-start gap-3 rounded-[10px] border border-border-card bg-bg-card px-3 py-2 text-left ${
        overdue && !done ? "border-accent-amber" : ""
      }`}
    >
      <span
        className={`mt-0.5 h-4 w-4 rounded border ${
          done ? "border-accent-green bg-accent-green" : "border-border-card"
        }`}
      />
      <div className="min-w-0 flex-1">
        <div
          className={`text-[13px] ${done ? "text-text-dim line-through" : "text-text-primary"}`}
        >
          {title}
        </div>
        {due_at ? (
          <div
            className={`text-[11px] ${overdue && !done ? "text-accent-amber" : "text-text-dim"}`}
          >
            Due {fmtDate(due_at)}
          </div>
        ) : null}
      </div>
    </button>
  );
}
