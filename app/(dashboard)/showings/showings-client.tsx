"use client";

import { ShowingCard } from "@/components/ShowingCard";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isFuture, parseISO } from "date-fns";

export function ShowingsClient({
  initial,
}: {
  initial: Record<string, unknown>[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    client_id: "",
    address: "",
    showing_date: "",
    status: "scheduled" as "scheduled" | "completed" | "cancelled",
    notes: "",
    feedback: "",
  });

  const { upcoming, past } = useMemo(() => {
    const u: typeof initial = [];
    const p: typeof initial = [];
    for (const s of initial) {
      const iso = s.showing_date as string | null;
      if (!iso) {
        p.push(s);
        continue;
      }
      try {
        if (isFuture(parseISO(iso))) u.push(s);
        else p.push(s);
      } catch {
        p.push(s);
      }
    }
    u.sort((a, b) => {
      const ta = String(a.showing_date ?? "");
      const tb = String(b.showing_date ?? "");
      return ta.localeCompare(tb);
    });
    p.sort((a, b) => {
      const ta = String(a.showing_date ?? "");
      const tb = String(b.showing_date ?? "");
      return tb.localeCompare(ta);
    });
    return { upcoming: u, past: p };
  }, [initial]);

  async function openModal() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("clients")
      .select("id, name")
      .eq("agent_id", user.id);
    setClients((data as { id: string; name: string }[]) ?? []);
    setOpen(true);
  }

  async function save() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    if (!form.client_id || !form.address.trim()) {
      toast.toast("Client and address are required", "warn");
      return;
    }
    const res = await fetch("/api/ai/showing-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: form.address,
        clientName: "Client",
        feedback: form.feedback,
      }),
    });
    const summary = await res.json();
    const row: Record<string, unknown> = {
      client_id: form.client_id,
      agent_id: user.id,
      address: form.address,
      showing_date: form.showing_date
        ? new Date(form.showing_date).toISOString()
        : null,
      client_feedback: form.feedback,
      ai_summary: summary.summary,
      next_action: summary.next_action,
      status: form.status,
      notes: form.notes.trim() || null,
    };
    const { error } = await supabase.from("showings").insert(row);
    if (error) {
      toast.toast(error.message, "warn");
      return;
    }
    const delta = Number(summary.lead_score_change ?? 0);
    if (delta && form.client_id) {
      const { data: c } = await supabase
        .from("clients")
        .select("lead_score")
        .eq("id", form.client_id)
        .single();
      const next = Math.min(10, Math.max(0, (c?.lead_score ?? 0) + delta));
      await supabase
        .from("clients")
        .update({ lead_score: next })
        .eq("id", form.client_id);
    }
    await supabase.from("tasks").insert({
      client_id: form.client_id,
      agent_id: user.id,
      title: `Showing follow-up: ${summary.next_action ?? "Next step"}`,
      due_at: new Date(Date.now() + 86400000).toISOString(),
      ai_generated: true,
    });
    toast.toast("Showing saved", "success");
    setOpen(false);
    setForm({
      client_id: "",
      address: "",
      showing_date: "",
      status: "scheduled",
      notes: "",
      feedback: "",
    });
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-6">
      <div className="text-[20px] font-medium text-text-primary">
        Showings
      </div>
      <p className="mt-1 text-[13px] text-text-dim">
        Upcoming and past property showings with your clients.
      </p>
      <button
        type="button"
        onClick={openModal}
        className="mt-4 w-full rounded-[8px] bg-accent-blue py-3 text-[13px] font-medium text-white"
      >
        Add Showing
      </button>

      <div className="mt-8">
        <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-text-dim">
          Upcoming
        </div>
        <div className="mt-3 space-y-3">
          {upcoming.length ? (
            upcoming.map((s) => (
              <ShowingCard
                key={String(s.id)}
                clientName={String(
                  (s.clients as { name?: string })?.name ?? "Client",
                )}
                address={s.address as string | null}
                showing_date={s.showing_date as string | null}
                status={(s.status as string) ?? "scheduled"}
                notes={s.notes as string | null}
                ai_summary={s.ai_summary as string | null}
                next_action={s.next_action as string | null}
              />
            ))
          ) : (
            <div className="rounded-[14px] border border-border-card bg-bg-card p-4 text-[13px] text-text-muted">
              No upcoming showings.
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-text-dim">
          Past
        </div>
        <div className="mt-3 space-y-3">
          {past.length ? (
            past.map((s) => (
              <ShowingCard
                key={String(s.id)}
                clientName={String(
                  (s.clients as { name?: string })?.name ?? "Client",
                )}
                address={s.address as string | null}
                showing_date={s.showing_date as string | null}
                status={(s.status as string) ?? "scheduled"}
                notes={s.notes as string | null}
                ai_summary={s.ai_summary as string | null}
                next_action={s.next_action as string | null}
              />
            ))
          ) : (
            <div className="rounded-[14px] border border-border-card bg-bg-card p-4 text-[13px] text-text-muted">
              No past showings yet.
            </div>
          )}
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[14px] border border-border-card bg-bg-card p-4">
            <div className="text-[16px] font-medium">Add showing</div>
            <select
              value={form.client_id}
              onChange={(e) =>
                setForm({ ...form, client_id: e.target.value })
              }
              className="mt-3 w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Property address"
              className="mt-2 w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
            />
            <input
              type="datetime-local"
              value={form.showing_date}
              onChange={(e) =>
                setForm({ ...form, showing_date: e.target.value })
              }
              className="mt-2 w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
            />
            <select
              value={form.status}
              onChange={(e) =>
                setForm({
                  ...form,
                  status: e.target.value as typeof form.status,
                })
              }
              className="mt-2 w-full rounded-[8px] border border-border-card bg-bg-deep px-3 py-2 text-[13px]"
            >
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notes"
              className="mt-2 min-h-[60px] w-full rounded-[8px] border border-border-card bg-bg-deep p-3 text-[13px]"
            />
            <textarea
              value={form.feedback}
              onChange={(e) => setForm({ ...form, feedback: e.target.value })}
              placeholder="Feedback (optional — used for AI summary)"
              className="mt-2 min-h-[90px] w-full rounded-[8px] border border-border-card bg-bg-deep p-3 text-[13px]"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={save}
                className="flex-1 rounded-[8px] bg-accent-blue py-2 text-[13px] text-white"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-[8px] border border-border-card px-3 py-2 text-[13px] text-text-dim"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
