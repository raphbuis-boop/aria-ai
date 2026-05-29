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
  "Pending",
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
}: {
  initial: Row[];
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
      if (filter === "Pending") return r.ai_draft && !r.approved;
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
    <div className="min-h-screen pb-24 relative" style={{ background: "#0a0a0a", color: "#f0f0f5" }}>
      <div className="px-5 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold">Follow-ups</h1>
            <p className="text-xs mt-0.5" style={{ color: "#6b7090" }}>
              AI drafts &amp; activity log
            </p>
          </div>
          {pendingCount > 0 ? (
            <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg">
              {pendingCount} pending
            </span>
          ) : null}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap"
              style={filter === f
                ? { background: "#0a7cff", color: "#ffffff" }
                : { background: "#1c1c1e", color: "#8e8e93" }
              }
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-[#6b7090]">
            {filter === "Pending" ? (
              <>
                <p className="font-medium">No pending drafts</p>
                <p className="text-sm mt-1">
                  Aria will surface follow-up drafts when clients need attention
                </p>
              </>
            ) : filter === "All" ? (
              <>
                <p className="font-medium">No activity yet</p>
                <p className="text-sm mt-1">
                  Texts you send and AI drafts will appear here
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">Nothing here</p>
                <p className="text-sm mt-1">No {filter.toLowerCase()} logged yet</p>
              </>
            )}
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
                className={`rounded-2xl p-3.5 flex items-start gap-3 ${pending ? "" : "opacity-70"}`}
                style={{ background: "#1c1c1e" }}
              >
                <div
                  className={`w-10 h-10 rounded-[13px] flex items-center justify-center text-xs font-bold flex-shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}
                >
                  {initialsOf(clientName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-[#e8eaf2] truncate">
                      {clientName}
                    </span>
                    {pending ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0" style={{ background: "rgba(10,124,255,0.12)", color: "#0a7cff" }}>
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
                    <span className="text-xs text-[#6b7090] ml-auto flex-shrink-0">
                      {new Date(item.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <p
                    className={`text-sm leading-relaxed line-clamp-2 ${
                      pending ? "text-[#e8eaf2]" : "text-[#9498b0]"
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
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl p-5 pb-10" style={{ background: "#1c1c1e" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-9 h-1 rounded-full mx-auto mb-4" style={{ background: "#3a3a3c" }} />
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-[14px] bg-red-500/20 text-red-400 flex items-center justify-center text-sm font-bold">
                {initialsOf(selected.clients?.name)}
              </div>
              <div>
                <p className="text-base font-semibold text-[#e8eaf2]">
                  {selected.clients?.name ?? "Client"}
                </p>
                <p className="text-xs text-[#6b7090]">AI matched your tone</p>
              </div>
            </div>
            <textarea
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              className="w-full rounded-2xl p-4 text-sm leading-relaxed resize-none outline-none mb-4" style={{ background: "#2c2c2e", color: "#f0f0f5" }}
              rows={5}
            />
            <button
              type="button"
              onClick={approveSend}
              disabled={busy}
              className="w-full text-white font-semibold rounded-full py-3.5 text-sm mb-2.5 disabled:opacity-60" style={{ background: "#0a7cff" }}
            >
              {busy ? "Sending…" : "Approve & Send"}
            </button>
            <button
              type="button"
              onClick={dismiss}
              disabled={busy}
              className="w-full font-semibold rounded-full py-3 text-sm disabled:opacity-60" style={{ background: "rgba(255,255,255,0.06)", color: "#8e8e93" }}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
