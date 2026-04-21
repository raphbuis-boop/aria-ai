"use client";

import { BackButton } from "@/components/BackButton";
import { MarketsComingSoonNote } from "@/components/MarketsComingSoonNote";
import { createClient } from "@/lib/supabase/client";
import { Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function AIPage() {
  const supabase = createClient();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ctx, setCtx] = useState("");

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("agent_profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      const { data: clients } = await supabase
        .from("clients")
        .select("name, town, status, lead_score, budget_min, budget_max")
        .eq("agent_id", user.id)
        .order("lead_score", { ascending: false });
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id")
        .eq("agent_id", user.id)
        .eq("done", false);
      const hot = (clients ?? []).filter((c) => (c.lead_score ?? 0) >= 7).length;
      const pipeline = (clients ?? []).reduce(
        (s, c) => s + (c.budget_max ?? 0),
        0,
      );
      const clientLines = (clients ?? [])
        .map(
          (c) =>
            `- ${c.name} — ${c.town ?? "?"}, ${c.status ?? "?"}, budget $${c.budget_min ?? "?"}–$${c.budget_max ?? "?"}, score ${c.lead_score ?? 0}/10`,
        )
        .join("\n");
      setCtx(
        `Agent: ${profile?.full_name ?? "Agent"}. ${clients?.length ?? 0} active clients. Hot leads: ${hot}. Pipeline: $${pipeline}. Open tasks: ${tasks?.length ?? 0}.\n\nRoster:\n${clientLines}`,
      );
    })();
  }, [supabase]);

  const prompts = useMemo(
    () => [
      "Who is my hottest lead right now?",
      "Summarize my pipeline",
      "Draft a follow-up for my coldest lead",
      "What's the market like in Ridgewood?",
    ],
    [],
  );

  async function send(text?: string) {
    const q = text ?? input;
    if (!q.trim()) return;
    setLoading(true);
    setMsgs((m) => [...m, { role: "user", content: q }]);
    setInput("");
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: q,
        context: ctx,
        history: msgs,
      }),
    });
    const data = await res.json();
    setLoading(false);
    setMsgs((m) => [
      ...m,
      { role: "assistant", content: String(data.reply ?? "") },
    ]);
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary px-4 pb-28 pt-6">
      <header className="mx-auto w-full max-w-lg">
        <BackButton href="/more" className="mb-4" />
        <div className="text-[20px] font-medium text-accent-blue">Aria</div>
        <div className="text-[13px] text-text-dim">
          Your AI real estate teammate
        </div>
        <MarketsComingSoonNote className="mt-2" />
      </header>

      <div className="mx-auto mt-6 flex w-full max-w-lg flex-1 flex-col gap-3">
        {msgs.length === 0 ? (
          <div className="space-y-2">
            {prompts.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => send(p)}
                className="w-full rounded-[14px] border border-border-card bg-bg-card px-4 py-3 text-left text-[13px] text-text-secondary"
              >
                {p}
              </button>
            ))}
          </div>
        ) : null}
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-[14px] px-4 py-3 text-[13px] leading-relaxed ${
              m.role === "user"
                ? "ml-auto bg-accent-blue text-white rounded-[14px_14px_2px_14px]"
                : "mr-auto border border-border-card bg-bg-card text-text-secondary rounded-[14px_14px_14px_2px]"
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading ? (
          <div className="text-[12px] text-text-dim">Aria is thinking…</div>
        ) : null}
      </div>

      <div className="mx-auto w-full max-w-lg pt-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex items-center gap-2 rounded-[12px] border border-border-card bg-bg-card px-3 py-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message Aria"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-text-primary outline-none placeholder:text-text-dim"
          />
          <button
            type="submit"
            className="rounded-[8px] bg-accent-blue p-2 text-white"
            aria-label="Send"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
