"use client";

import { useToast } from "@/components/ToastProvider";
import { Mic } from "lucide-react";
import { useState } from "react";

export function AIBar({
  context,
}: {
  context: string;
}) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, context, history: [] }),
    });
    const data = await res.json();
    setLoading(false);
    setReply(String(data.reply ?? ""));
    toast.toast("Aria responded", "success");
  }

  return (
    <div className="space-y-3">
      {reply ? (
        <div className="rounded-[12px] border border-border-card bg-bg-card p-3 text-[13px] text-text-secondary">
          {reply}
        </div>
      ) : null}
      <form
        onSubmit={submit}
        className="flex items-center gap-2 rounded-[12px] border border-border-card bg-bg-deep px-3 py-2"
      >
        <span className="h-2 w-2 rounded-full bg-accent-blue" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask Aria anything..."
          className="min-w-0 flex-1 bg-transparent text-[13px] text-text-primary outline-none placeholder:text-text-dim"
        />
        <Mic className="text-text-dim" size={18} />
      </form>
      {loading ? (
        <div className="text-[12px] text-text-dim">Thinking…</div>
      ) : null}
    </div>
  );
}
