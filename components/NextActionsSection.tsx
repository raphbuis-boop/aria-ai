"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";

type Task = {
  id: string;
  title: string;
  due_at: string | null;
  done: boolean;
};

type AutoTask = {
  id: string;
  title: string;
  subtitle?: string;
};

type Props = {
  clientId: string;
  initialTasks: Record<string, unknown>[];
  activities: Record<string, unknown>[];
  showings: Record<string, unknown>[];
};

// ─── Auto-suggestion logic ───────────────────────────────────────────────────

function buildAutoTasks(
  activities: Record<string, unknown>[],
  showings: Record<string, unknown>[],
): AutoTask[] {
  const suggestions: AutoTask[] = [];
  const now = Date.now();
  const DAY = 1000 * 60 * 60 * 24;

  // 1. No listing sent in 7 days
  const recentOutreach = activities.find((a) => {
    const t = String(a.type ?? "");
    if (t !== "text" && t !== "email") return false;
    const ts = a.created_at ? new Date(String(a.created_at)).getTime() : 0;
    return now - ts <= 7 * DAY;
  });

  if (!recentOutreach) {
    const lastAny = activities[0];
    const lastTs = lastAny?.created_at
      ? new Date(String(lastAny.created_at)).getTime()
      : null;
    const days = lastTs ? Math.floor((now - lastTs) / DAY) : null;
    suggestions.push({
      id: "auto-listings",
      title: "Send listings",
      subtitle:
        days != null ? `Overdue ${days} day${days === 1 ? "" : "s"}` : undefined,
    });
  }

  // 2. Upcoming showings
  const upcoming = showings.filter((s) => {
    const d = s.showing_date ? new Date(String(s.showing_date)) : null;
    return d && d.getTime() > now;
  });
  for (const s of upcoming.slice(0, 2)) {
    const d = new Date(String(s.showing_date));
    const dateStr = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    suggestions.push({
      id: `auto-showing-${String(s.id)}`,
      title: "Showing scheduled",
      subtitle: `${String(s.address ?? "Property")} · ${dateStr}`,
    });
  }

  // 3. No reply to last outbound
  const lastActivity = activities[0];
  if (lastActivity) {
    const wasSent = lastActivity.sent === true;
    const wasOutbound =
      wasSent ||
      String(lastActivity.type ?? "") === "text" ||
      String(lastActivity.type ?? "") === "email";
    if (wasOutbound) {
      const ts = lastActivity.created_at
        ? new Date(String(lastActivity.created_at)).getTime()
        : 0;
      const days = Math.floor((now - ts) / DAY);
      if (days >= 2) {
        suggestions.push({
          id: "auto-noreply",
          title: "No reply to your last message",
          subtitle: `${days} day${days === 1 ? "" : "s"} ago`,
        });
      }
    }
  }

  return suggestions;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toTask(raw: Record<string, unknown>): Task {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    due_at: (raw.due_at as string | null) ?? null,
    done: Boolean(raw.done),
  };
}

function fmtDue(due_at: string | null): string | null {
  if (!due_at) return null;
  const d = new Date(due_at);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function NextActionsSection({
  clientId,
  initialTasks,
  activities,
  showings,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>(() =>
    initialTasks.map(toTask).filter((t) => !t.done),
  );
  const [doneTasks, setDoneTasks] = useState<Task[]>(() =>
    initialTasks.map(toTask).filter((t) => t.done),
  );
  const [doneExpanded, setDoneExpanded] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");
  const [saving, setSaving] = useState(false);
  const [dismissedAuto, setDismissedAuto] = useState<Set<string>>(new Set());

  const autoTasks = useMemo(
    () => buildAutoTasks(activities, showings),
    [activities, showings],
  );

  const visibleAuto = autoTasks.filter((a) => !dismissedAuto.has(a.id));

  // ── Toggle done ────────────────────────────────────────────────────────────
  const toggleDone = useCallback(
    async (task: Task) => {
      // Optimistic: move to done list immediately
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      setDoneTasks((prev) => [{ ...task, done: true }, ...prev]);

      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: true }),
      });
    },
    [],
  );

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteTask = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setDoneTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  }, []);

  // ── Add task ───────────────────────────────────────────────────────────────
  const submitNew = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const title = newTitle.trim();
      if (!title || saving) return;
      setSaving(true);

      const res = await fetch(`/api/clients/${clientId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, due_at: newDue || null }),
      });
      const data = (await res.json()) as { task?: Record<string, unknown> };

      if (data.task) {
        setTasks((prev) => [...prev, toTask(data.task!)]);
      }
      setNewTitle("");
      setNewDue("");
      setAddingNew(false);
      setSaving(false);
    },
    [clientId, newTitle, newDue, saving],
  );

  const totalCount = visibleAuto.length + tasks.length;

  return (
    <div className="mb-4 rounded-2xl border border-[#1e2230] bg-[#12121e] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#6b7090]">
            Next Actions
          </p>
          {totalCount > 0 && (
            <span className="rounded-full bg-[#3a65f0]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#6b8fff]">
              {totalCount}
            </span>
          )}
        </div>
      </div>

      <div className="px-3 pb-3 space-y-1.5">
        {/* Auto-suggested tasks */}
        {visibleAuto.map((at) => (
          <div
            key={at.id}
            className="flex items-center gap-2.5 rounded-xl border border-[#3a65f0]/15 bg-[#3a65f0]/6 px-3 py-2.5"
          >
            <span className="h-4 w-4 flex-shrink-0 rounded border border-[#3a65f0]/30 bg-transparent" />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium text-[#c0c0d8]">
                {at.title}
              </p>
              {at.subtitle && (
                <p className="text-[11px] text-[#555575]">{at.subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                setDismissedAuto((prev) => { const s = new Set(prev); s.add(at.id); return s; })
              }
              className="flex-shrink-0 text-[#333350] hover:text-[#9498b0] transition-colors"
              aria-label="Dismiss suggestion"
            >
              <X size={13} />
            </button>
          </div>
        ))}

        {/* Manual tasks */}
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-2.5 rounded-xl border border-[#1e2230] bg-[#0e0e1a] px-3 py-2.5"
          >
            <button
              type="button"
              onClick={() => toggleDone(task)}
              className="h-4 w-4 flex-shrink-0 rounded border border-[#333350] bg-transparent hover:border-green-500 hover:bg-green-500/10 transition-colors"
              aria-label="Mark done"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium text-[#c0c0d8]">
                {task.title}
              </p>
              {fmtDue(task.due_at) && (
                <p className="text-[11px] text-[#555575]">
                  Due {fmtDue(task.due_at)}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => deleteTask(task.id)}
              className="flex-shrink-0 text-[#333350] hover:text-red-400 transition-colors"
              aria-label="Delete task"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}

        {/* Empty state */}
        {totalCount === 0 && !addingNew && (
          <p className="py-3 text-center text-[12px] text-[#6b7090]">
            No actions needed — keep up the good work
          </p>
        )}

        {/* Add task form */}
        {addingNew ? (
          <form
            onSubmit={submitNew}
            className="rounded-xl border border-[#3a65f0]/25 bg-[#0e0e1a] px-3 py-2.5 space-y-2"
          >
            <input
              autoFocus
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task title…"
              className="w-full bg-transparent text-[12.5px] text-[#e8eaf2] placeholder-[#333350] outline-none"
            />
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={newDue}
                onChange={(e) => setNewDue(e.target.value)}
                className="flex-1 rounded-lg border border-[#1e2230] bg-[#080910] px-2 py-1 text-[11px] text-[#9498b0] outline-none focus:border-[#3a65f0]/40"
              />
              <button
                type="submit"
                disabled={!newTitle.trim() || saving}
                className="rounded-lg bg-[#3a65f0] px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingNew(false);
                  setNewTitle("");
                  setNewDue("");
                }}
                className="text-[11px] text-[#555570]"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAddingNew(true)}
            className="flex w-full items-center gap-1.5 rounded-xl px-2 py-2 text-[12px] font-medium text-[#6b7090] hover:text-[#6b8fff] transition-colors"
          >
            <Plus size={13} />
            Add task
          </button>
        )}

        {/* Done section */}
        {doneTasks.length > 0 && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setDoneExpanded((p) => !p)}
              className="flex items-center gap-1.5 text-[11px] text-[#6b7090] hover:text-[#9498b0] transition-colors"
            >
              {doneExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Done ({doneTasks.length})
            </button>
            {doneExpanded && (
              <div className="mt-1.5 space-y-1">
                {doneTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 opacity-50"
                  >
                    <span className="h-4 w-4 flex-shrink-0 rounded border border-green-500/40 bg-green-500/15 flex items-center justify-center">
                      <span className="block h-1.5 w-1.5 rounded-full bg-green-400" />
                    </span>
                    <p className="text-[12px] line-through text-[#9498b0]">
                      {task.title}
                    </p>
                    <button
                      type="button"
                      onClick={() => deleteTask(task.id)}
                      className="ml-auto flex-shrink-0 text-[#333350] hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
