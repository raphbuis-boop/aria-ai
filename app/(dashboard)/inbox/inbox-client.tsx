"use client";

// Architecture note: This inbox is designed to unify SMS, Gmail, and Outlook
// conversations. Each activity row carries a `type` field. As additional
// channels are connected (Gmail threads, Outlook messages), they will appear
// here as first-class conversation threads grouped by client. The filter tabs
// and channel badge system below are pre-wired for this expansion.

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

type GmailStatus = {
  connected: boolean;
  email: string | null;
};

const FILTERS = [
  "All",
  "Pending",
  "SMS",
  "Calls",
  "Notes",
  "Showings",
] as const;

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

// Channel badge for each activity type — ready for Gmail, Outlook expansion
function ChannelBadge({ type, isDraft }: { type: string; isDraft: boolean }) {
  if (isDraft) {
    return (
      <span
        className="text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0"
        style={{ background: "rgba(59,130,246,0.14)", color: "var(--oc-blue)" }}
      >
        AI DRAFT
      </span>
    );
  }
  if (type === "showing") {
    return (
      <span
        className="text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0"
        style={{ background: "rgba(26,155,94,0.14)", color: "#1A9B5E" }}
      >
        SHOWING
      </span>
    );
  }
  if (type === "call") {
    return (
      <span
        className="text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0"
        style={{ background: "rgba(196,126,26,0.14)", color: "#C47E1A" }}
      >
        CALL
      </span>
    );
  }
  if (type === "note") {
    return (
      <span
        className="text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0"
        style={{ background: "rgba(83,104,120,0.22)", color: "var(--oc-text-2)" }}
      >
        NOTE
      </span>
    );
  }
  if (type === "email") {
    return (
      <span
        className="text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0"
        style={{ background: "rgba(59,130,246,0.14)", color: "var(--oc-blue)" }}
      >
        EMAIL
      </span>
    );
  }
  // SMS — default for type === "text"
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0"
      style={{ background: "rgba(26,155,94,0.14)", color: "#1A9B5E" }}
    >
      SMS
    </span>
  );
}

export function InboxClient({
  initial,
  gmailStatus,
}: {
  initial: Row[];
  gmailStatus: GmailStatus;
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
      if (filter === "SMS") return r.type === "text";
      if (filter === "Calls") return r.type === "call";
      if (filter === "Notes") return r.type === "note";
      if (filter === "Showings") return r.type === "showing";
      return true;
    });
  }, [rows, filter]);

  const pendingCount = rows.filter((r) => r.ai_draft && !r.approved).length;

  // Unique clients in current view — conversation count
  const uniqueClients = useMemo(
    () => new Set(rows.map((r) => r.client_id)).size,
    [rows]
  );

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
    <div
      className="min-h-screen pb-[130px] relative"
      style={{ background: "#0C0F16", color: "var(--oc-text-1)" }}
    >
      <div className="px-5 pt-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-[22px] font-bold" style={{ letterSpacing: "-0.02em" }}>
              Follow-ups
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--oc-text-3)" }}>
              {uniqueClients > 0
                ? `${uniqueClients} client conversation${uniqueClients !== 1 ? "s" : ""}`
                : "AI drafts & activity log"}
            </p>
          </div>
          {pendingCount > 0 && (
            <span
              className="rounded-xl px-2.5 py-1 text-[12px] font-bold text-white"
              style={{ background: "#C43838" }}
            >
              {pendingCount} pending
            </span>
          )}
        </div>

        {/* ── Gmail status banner ── */}
        {gmailStatus.connected ? (
          <div
            className="flex items-center gap-2.5 rounded-2xl px-4 py-3 mb-4"
            style={{
              background: "rgba(26,155,94,0.10)",
              border: "0.5px solid rgba(26,155,94,0.28)",
            }}
          >
            <span
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ background: "#1A9B5E" }}
            />
            <div className="min-w-0 flex-1">
              <span className="text-[13px] font-medium" style={{ color: "#1A9B5E" }}>
                Gmail connected
              </span>
              {gmailStatus.email && (
                <span className="text-[12px] ml-2" style={{ color: "var(--oc-text-3)" }}>
                  {gmailStatus.email}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div
            className="flex items-center gap-2.5 rounded-2xl px-4 py-3 mb-4"
            style={{
              background: "rgba(196,126,26,0.10)",
              border: "0.5px solid rgba(196,126,26,0.28)",
            }}
          >
            <span
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ background: "#C47E1A" }}
            />
            <span className="text-[13px] font-medium flex-1" style={{ color: "#C47E1A" }}>
              Gmail not connected
            </span>
            <a
              href="/settings"
              className="text-[12px] font-semibold"
              style={{ color: "var(--oc-blue)" }}
            >
              Connect →
            </a>
          </div>
        )}

        {/* ── Filter pills ── */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4" style={{ scrollbarWidth: "none" }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className="px-3.5 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap"
              style={
                filter === f
                  ? { background: "var(--oc-blue)", color: "#ffffff" }
                  : {
                      background: "var(--oc-surface-1)",
                      color: "var(--oc-text-3)",
                      border: "0.5px solid var(--oc-border-soft)",
                    }
              }
            >
              {f}
              {f === "Pending" && pendingCount > 0 && ` (${pendingCount})`}
            </button>
          ))}
          {/* Future channels — non-interactive placeholders */}
          {["Gmail", "Outlook"].map((ch) => (
            <button
              key={ch}
              type="button"
              disabled
              className="px-3.5 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap opacity-35 cursor-not-allowed"
              style={{
                background: "var(--oc-surface-1)",
                color: "var(--oc-text-3)",
                border: "0.5px solid var(--oc-border-soft)",
              }}
            >
              {ch}
            </button>
          ))}
        </div>
      </div>

      {/* ── List ── */}
      <div className="px-5 space-y-2">
        {filtered.length === 0 ? (
          <div
            className="rounded-3xl px-6 py-10 text-center"
            style={{
              background: "var(--oc-surface-1)",
              border: "0.5px solid var(--oc-border-soft)",
            }}
          >
            {filter === "Pending" ? (
              <>
                <p className="text-[15px] font-semibold mb-1" style={{ color: "var(--oc-text-1)" }}>
                  No pending drafts
                </p>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--oc-text-3)" }}>
                  Aria surfaces follow-up drafts when a client needs attention.
                  Check back after your next MLS match run.
                </p>
              </>
            ) : filter === "All" ? (
              <>
                <p className="text-[15px] font-semibold mb-1" style={{ color: "var(--oc-text-1)" }}>
                  Aria is watching
                </p>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--oc-text-3)" }}>
                  When clients need follow-up, Aria drafts a message and surfaces
                  it here. SMS sent, calls logged, and notes appear here too.
                </p>
              </>
            ) : (
              <>
                <p className="text-[15px] font-semibold mb-1" style={{ color: "var(--oc-text-1)" }}>
                  Nothing here
                </p>
                <p className="text-[13px]" style={{ color: "var(--oc-text-3)" }}>
                  No {filter.toLowerCase()} logged yet.
                </p>
              </>
            )}
          </div>
        ) : null}

        {filtered.map((item) => {
          const pending = !!item.ai_draft && !item.approved;
          const clientName = item.clients?.name ?? "Client";
          return (
            <button
              key={item.id}
              onClick={() => openDraft(item)}
              className="w-full text-left active:opacity-80"
              type="button"
            >
              <div
                className="rounded-2xl p-4 flex items-start gap-3"
                style={{
                  background: pending
                    ? "rgba(59,130,246,0.06)"
                    : "var(--oc-surface-1)",
                  border: pending
                    ? "0.5px solid rgba(59,130,246,0.22)"
                    : "0.5px solid var(--oc-border-soft)",
                  backdropFilter: "blur(24px) saturate(240%)",
                  WebkitBackdropFilter: "blur(24px) saturate(240%)",
                }}
              >
                {/* Avatar */}
                <div
                  className="h-10 w-10 rounded-[13px] flex items-center justify-center text-[12px] font-bold flex-shrink-0"
                  style={{
                    background: "rgba(59,130,246,0.16)",
                    color: "var(--oc-blue)",
                  }}
                >
                  {initialsOf(clientName)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[14px] font-semibold truncate"
                      style={{ color: "var(--oc-text-1)" }}
                    >
                      {clientName}
                    </span>
                    <ChannelBadge type={item.type} isDraft={pending} />
                    <span
                      className="text-[12px] ml-auto flex-shrink-0"
                      style={{ color: "var(--oc-text-3)" }}
                    >
                      {new Date(item.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <p
                    className="text-[13px] leading-relaxed line-clamp-2"
                    style={{ color: pending ? "var(--oc-text-2)" : "var(--oc-text-3)" }}
                  >
                    {item.body || "No content"}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Draft review sheet ── */}
      {selected ? (
        <div
          className="fixed inset-0 z-50"
          onClick={() => {
            if (!busy) setSelected(null);
          }}
        >
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl p-5"
            style={{
              background: "var(--oc-surface-2)",
              backdropFilter: "blur(32px) saturate(260%)",
              WebkitBackdropFilter: "blur(32px) saturate(260%)",
              border: "0.5px solid var(--oc-border-mid)",
              paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="h-1 w-9 rounded-full mx-auto mb-5"
              style={{ background: "var(--oc-border-mid)" }}
            />
            <div className="flex items-center gap-3 mb-4">
              <div
                className="h-11 w-11 rounded-[14px] flex items-center justify-center text-[13px] font-bold"
                style={{
                  background: "rgba(59,130,246,0.16)",
                  color: "var(--oc-blue)",
                }}
              >
                {initialsOf(selected.clients?.name)}
              </div>
              <div>
                <p className="text-[15px] font-semibold" style={{ color: "var(--oc-text-1)" }}>
                  {selected.clients?.name ?? "Client"}
                </p>
                <p className="text-[12px]" style={{ color: "var(--oc-text-3)" }}>
                  Aria matched your tone · SMS
                </p>
              </div>
            </div>
            <textarea
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              className="w-full rounded-2xl p-4 text-[13px] leading-relaxed resize-none outline-none mb-4"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "0.5px solid var(--oc-border-soft)",
                color: "var(--oc-text-1)",
              }}
              rows={5}
            />
            <button
              type="button"
              onClick={approveSend}
              disabled={busy}
              className="w-full text-white font-semibold rounded-2xl py-3.5 text-[14px] mb-2.5 disabled:opacity-60 active:opacity-80"
              style={{ background: "var(--oc-blue)" }}
            >
              {busy ? "Sending…" : "Approve & Send"}
            </button>
            <button
              type="button"
              onClick={dismiss}
              disabled={busy}
              className="w-full font-semibold rounded-2xl py-3 text-[14px] disabled:opacity-60 active:opacity-70"
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "var(--oc-text-2)",
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
