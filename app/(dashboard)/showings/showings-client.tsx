"use client";

import { ShowingCard } from "@/components/ShowingCard";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
    feedback: "",
  });

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
    await supabase.from("showings").insert({
      client_id: form.client_id,
      agent_id: user.id,
      address: form.address,
      showing_date: form.showing_date
        ? new Date(form.showing_date).toISOString()
        : null,
      client_feedback: form.feedback,
      ai_summary: summary.summary,
      next_action: summary.next_action,
    });
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
    router.refresh();
  }

  function startVoice() {
    const w = window as unknown as {
      webkitSpeechRecognition?: new () => {
        lang: string;
        onresult: (ev: {
          results: ArrayLike<{ 0: { transcript: string } }>;
        }) => void;
        start: () => void;
      };
    };
    const SR = w.webkitSpeechRecognition;
    if (!SR) {
      toast.toast("Speech recognition not supported", "warn");
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.onresult = (ev) => {
      const text = ev.results[0][0].transcript;
      setForm((f) => ({ ...f, feedback: (f.feedback + " " + text).trim() }));
    };
    rec.start();
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-6">
      <div className="text-[20px] font-medium text-text-primary">
        Showing Assistant
      </div>
      <button
        type="button"
        onClick={openModal}
        className="mt-4 w-full rounded-[8px] bg-accent-blue py-3 text-[13px] font-medium text-white"
      >
        Log New Showing
      </button>
      <div className="mt-6 space-y-3">
        {initial.map((s) => (
          <ShowingCard
            key={String(s.id)}
            clientName={String((s.clients as { name?: string })?.name ?? "Client")}
            address={s.address as string | null}
            showing_date={s.showing_date as string | null}
            ai_summary={s.ai_summary as string | null}
            next_action={s.next_action as string | null}
          />
        ))}
      </div>

      {open ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-[14px] border border-border-card bg-bg-card p-4">
            <div className="text-[16px] font-medium">Log showing</div>
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
              placeholder="Address"
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
            <textarea
              value={form.feedback}
              onChange={(e) => setForm({ ...form, feedback: e.target.value })}
              placeholder="Feedback"
              className="mt-2 min-h-[90px] w-full rounded-[8px] border border-border-card bg-bg-deep p-3 text-[13px]"
            />
            <button
              type="button"
              onClick={startVoice}
              className="mt-2 rounded-[8px] border border-border-card px-3 py-2 text-[12px] text-text-dim"
            >
              Voice memo
            </button>
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
