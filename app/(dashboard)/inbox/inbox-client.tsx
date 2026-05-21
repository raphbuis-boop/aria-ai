"use client";

import { useToast } from "@/components/ToastProvider";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Row = {
  id: string;
  type: string;
  body: string | null;
  created_at: string;
  ai_draft: boolean | null;
  approved: boolean | null;
  sent: boolean | null;
  client_id: string;
  clients: { name: string | null; phone: string | null } | null;
};

const FILTERS = [
  "All",
  "AI Drafts",
  "Sent Texts",
  "Calls",
  "Notes",
  "Showings",
] as const;

const AVATAR_COLORS = [
  "bg-red-500/20 text-red-400",
  "bg-blue-500/20 text-blue-400",
  "bg-purple-500/20 text-purple-400",
  "bg-green-500/20 text-green-400",
  "bg-amber-500/20 text-amber-400",
];

function initialsOf(name: string | null | undefined) {
  return (
    (name ?? "")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export function InboxClient({
  initial,
  unread,
}: {
  initial: Row[];
  unread: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [rows, setRows] = useState(initial);
  const [selected, setSelected] = useState<Row | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRows(initial);
  }, [initial]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/inbox/backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          signal: controller.signal,
        });
        const data = (await res.json().catch(() => ({}))) as { updated?: number };
        if ((data.updated ?? 0) > 0) router.refresh();
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    })();
    return () => controller.abort();
  }, [router]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "All") return true;
      if (filter === "AI Drafts") return r.ai_draft && !r.approved;
      if (filter === "Sent Texts") return r.type === "text" && r.sent;
      if (filter === "Calls") return r.type === "call";
      if (filter === "Notes") return r.type === "note";
      if (filter === "Showings") return r.type === "showing";
      return true;
    });
  }, [rows, filter]);

  const pendingCount = rows.filter((r) => r.ai_draft && !r.approved).length;

  function openDraft(r: Row) {
    if (!(r.ai_draft && !r.approved)) return;
    setSelected(r);
    setDraftBody(r.body ?? "");
  }

  async function approveSend() {
    if (!selected || busy) return;
    const phone = selected.clients?.phone;
    if (!phone) {
      toast.toast("Client has no phone number", "warn");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId: selected.id,
          clientId: selected.client_id,
          to: phone,
          body: draftBody,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!data.success) {
        toast.toast(data.error ?? "Send failed", "warn");
        return;
      }
      toast.toast("Sent", "success");
      setRows((list) => list.filter((x) => x.id !== selected.id));
      setSelected(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/inbox/${selected.id}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!data.ok) {
        toast.toast(data.error ?? "Could not dismiss", "warn");
        return;
      }
      toast.toast("Dismissed", "success");
      setRows((list) => list.filter((x) => x.id !== selected.id));
      setSelected(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24 relative">
      <div className="px-5 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Inbox</h1>
          {pendingCount > 0 ? (
            <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg">
              {pendingCount}
            </span>
          ) : unread > 0 ? (
            <span className="bg-[#4f7bff] text-white text-xs font-bold px-2.5 py-1 rounded-lg">
              {unread}
            </span>
          ) : null}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
                filter === f
                  ? "bg-[#4f7bff]/15 border-[#4f7bff]/30 text-[#6f9bff]"
                  : "bg-[#12121e] border-[#1e1e2e] text-[#666680]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-[#444460]">
            <p className="font-medium">All clear</p>
            <p className="text-sm mt-1">No messages in this category</p>
          </div>
        ) : null}

        {filtered.map((item, i) => {
          const pending = !!item.ai_draft && !item.approved;
          const clientName = item.clients?.name ?? "Client";
          return (
            <button
              key={item.id}
              onClick={() => openDraft(item)}
              className="w-full text-left"
              type="button"
            >
              <div
                className={`bg-[#12121e] border rounded-2xl p-3.5 flex items-start gap-3 transition-colors ${
                  pending ? "border-[#2a2a4e]" : "border-[#1e1e2e] opacity-70"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-[13px] flex items-center justify-center text-xs font-bold flex-shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}
                >
                  {initialsOf(clientName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-[#d0d0e0] truncate">
                      {clientName}
                    </span>
                    {pending ? (
                      <span className="text-[10px] font-bold bg-[#4f7bff]/12 text-[#6f9bff] px-2 py-0.5 rounded flex-shrink-0">
                        AI DRAFT
                      </span>
                    ) : null}
                    {item.type === "showing" ? (
                      <span className="text-[10px] font-bold bg-green-500/10 text-green-400 px-2 py-0.5 rounded flex-shrink-0">
                        SHOWING
                      </span>
                    ) : null}
                    {item.type === "call" ? (
                      <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded flex-shrink-0">
                        CALL
                      </span>
                    ) : null}
                    {item.type === "note" ? (
                      <span className="text-[10px] font-bold bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded flex-shrink-0">
                        NOTE
                      </span>
                    ) : null}
                    <span className="text-xs text-[#444460] ml-auto flex-shrink-0">
                      {new Date(item.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <p
                    className={`text-sm leading-relaxed line-clamp-2 ${
                      pending ? "text-[#c0bfd8]" : "text-[#888898]"
                    }`}
                  >
                    {item.body || "No content"}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selected ? (
        <div
          className="fixed inset-0 z-50"
          onClick={() => {
            if (!busy) setSelected(null);
          }}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-[#0f0f1a] border-t border-[#1e1e2e] rounded-t-3xl p-5 pb-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-9 h-1 bg-[#2a2a3e] rounded-full mx-auto mb-4" />
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-[14px] bg-red-500/20 text-red-400 flex items-center justify-center text-sm font-bold">
                {initialsOf(selected.clients?.name)}
              </div>
              <div>
                <p className="text-base font-semibold text-[#d0d0e0]">
                  {selected.clients?.name ?? "Client"}
                </p>
                <p className="text-xs text-[#444460]">AI matched your tone</p>
              </div>
            </div>
            <textarea
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              className="w-full bg-[#0a0a14] border border-[#2a2a3e] rounded-2xl p-4 text-sm text-[#d0d0e0] leading-relaxed resize-none outline-none mb-4"
              rows={5}
            />
            <button
              type="button"
              onClick={approveSend}
              disabled={busy}
              className="w-full bg-[#4f7bff] text-white font-semibold rounded-xl py-3.5 text-sm mb-2.5 disabled:opacity-60"
            >
              {busy ? "Sending…" : "Approve & Send"}
            </button>
            <button
              type="button"
              onClick={dismiss}
              disabled={busy}
              className="w-full bg-transparent border border-[#2a2a3e] text-[#888898] font-semibold rounded-xl py-3 text-sm disabled:opacity-60"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
