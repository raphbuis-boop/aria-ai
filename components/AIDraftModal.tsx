"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useToast } from "@/components/ToastProvider";

type Client = {
  id: string;
  name: string;
  phone: string | null;
  town?: string | null;
  budget_max?: number | null;
  status?: string | null;
};

export function AIDraftModal({
  client,
  onClose,
  propertyContext,
  scenario,
}: {
  client: Client;
  onClose: () => void;
  propertyContext?: string;
  scenario?: string;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function generate() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/ai/draft-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: client.id,
            clientName: client.name,
            scenario: scenario ?? "Warm follow-up check-in",
            context:
              `Status: ${client.status ?? "active"}. ` +
              (client.town ? `Town: ${client.town}. ` : "") +
              (client.budget_max ? `Budget: $${client.budget_max}. ` : ""),
            propertyContext: propertyContext ?? "",
            skipInsert: true,
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(String(data.error ?? "Could not draft"));
          setDraft("");
        } else {
          setDraft(String(data.draft ?? ""));
        }
      } catch {
        if (!cancelled) setError("Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    generate();
    return () => {
      cancelled = true;
    };
  }, [client.id, client.name, client.status, client.town, client.budget_max, propertyContext, scenario]);

  async function send() {
    if (!draft.trim()) return;
    if (!client.phone) {
      toast.toast("No phone on file for this client", "warn");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          to: client.phone,
          body: draft.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.toast(String(data.error ?? "SMS failed"), "warn");
      } else {
        toast.toast("Sent ✓", "success");
        onClose();
      }
    } catch {
      toast.toast("Network error", "warn");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 mb-0 w-full max-w-lg rounded-t-[24px] border-[0.5px] border-b-0 border-[#1e1e2e] bg-[#0f0f1a] px-5 pb-8 pt-4">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-[#2a2a3e]" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[1.2px] text-[#4f7bff]">
              <Sparkles size={12} /> Aria draft
            </div>
            <div className="mt-1 text-[16px] font-semibold text-[#f0eee8]">
              AI text · {client.name}
            </div>
            {client.phone ? (
              <div className="text-[12px] text-[#666680]">{client.phone}</div>
            ) : (
              <div className="text-[12px] text-[#ffb832]">No phone on file</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-[#555570]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="flex items-center gap-2 rounded-[14px] border-[0.5px] border-[#1e1e2e] bg-[#0a0a15] px-3 py-4 text-[13px] text-[#888898]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4f7bff]" />
              Aria is drafting…
            </div>
          ) : error ? (
            <div className="rounded-[14px] border-[0.5px] border-red-500/30 bg-red-500/5 px-3 py-3 text-[13px] text-red-400">
              {error}
            </div>
          ) : (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[120px] w-full resize-none rounded-[14px] border-[0.5px] border-[#1e1e2e] bg-[#0a0a15] px-3 py-3 text-[13px] leading-[1.55] text-[#e5e4df] outline-none focus:border-[#4f7bff]/40"
            />
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[12px] border-[0.5px] border-[#2a2a3e] px-3 py-2.5 text-[13px] font-semibold text-[#9090a8]"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={send}
            disabled={loading || sending || !draft.trim() || !client.phone}
            className="rounded-[12px] bg-gradient-to-br from-[#4f7bff] to-[#7c5cfc] px-3 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {sending ? "Sending…" : "Approve & Send"}
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-[#444460]">
          You approve every message before it sends.
        </p>
      </div>
    </div>
  );
}
