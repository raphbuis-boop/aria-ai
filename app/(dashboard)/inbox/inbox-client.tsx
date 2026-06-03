"use client";

// Conversations — iMessage-style unified messaging.
// Primary mental model: people, not messages.
//
// Architecture:
//   - Activities are grouped by client into Conversations.
//   - Conversation list shows last message, timestamp, badges, lead score ring.
//   - Tapping a conversation opens a full-screen Thread view.
//   - Thread interleaves SMS and Email chronologically.
//   - Agent messages are right-aligned, client replies are left-aligned.
//   - AI drafts appear inline at their chronological position.
//   - Composer defaults to SMS (if client has phone), otherwise Email.

import { useToast } from "@/components/ToastProvider";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Row = {
  id: string;
  type: string;
  direction: string | null;
  body: string | null;
  created_at: string;
  ai_draft: boolean | null;
  approved: boolean | null;
  sent: boolean | null;
  client_id: string;
  clients: {
    name: string | null;
    phone: string | null;
    email: string | null;
    lead_score: number | null;
  } | null;
};

type GmailStatus = {
  connected: boolean;
  email: string | null;
};

type Conversation = {
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  leadScore: number | null;
  lastActivity: Row;         // most recent (for preview)
  hasPendingDraft: boolean;
  pendingDraft: Row | null;
  // Stored newest-first (matches query order); reverse for thread display
  activities: Row[];
};

type FilterKey = "All" | "Pending" | "SMS" | "Email";

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string | null | undefined): string {
  return (
    (name ?? "")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

// Compact relative timestamp for conversation rows (iMessage-style)
function relTs(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7)
    return new Date(iso).toLocaleDateString("en-US", { weekday: "short" });
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Full date label for thread separators
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

// Lead score → ring color
function scoreRingColor(score: number | null): string {
  if (!score) return "rgba(255,255,255,0.12)";
  if (score >= 8) return "#1A9B5E";
  if (score >= 5) return "#C47E1A";
  return "rgba(255,255,255,0.12)";
}

// Preview text for conversation list row
function previewText(row: Row): string {
  const body = row.body ?? "";
  if (row.ai_draft && !row.approved) {
    const preview = body.length > 60 ? body.slice(0, 60) + "…" : body;
    return `Aria: ${preview || "Draft ready"}`;
  }
  if (row.direction === "inbound") {
    const preview = body.length > 60 ? body.slice(0, 60) + "…" : body;
    return preview;
  }
  if (row.type === "call") return "Call logged";
  if (row.type === "note") return body.length > 60 ? body.slice(0, 60) + "…" : body || "Note";
  if (row.type === "showing") return "Showing logged";
  if (row.type === "email") {
    const preview = body.length > 60 ? body.slice(0, 60) + "…" : body;
    return `You: ${preview}`;
  }
  // SMS outbound
  const preview = body.length > 60 ? body.slice(0, 60) + "…" : body;
  return `You: ${preview}`;
}

// Whether a row is a displayable message (renders as a bubble)
function isMessageRow(row: Row): boolean {
  return row.type === "text" || row.type === "email";
}

// Whether a message is from the client (left side) vs agent (right side)
function isInbound(row: Row): boolean {
  return row.direction === "inbound";
}

// Group rows by client, sorted by most recent activity first
function groupByClient(rows: Row[]): Conversation[] {
  const map = new Map<string, Conversation>();

  for (const row of rows) {
    if (!map.has(row.client_id)) {
      map.set(row.client_id, {
        clientId: row.client_id,
        clientName: row.clients?.name ?? "Unknown",
        clientPhone: row.clients?.phone ?? null,
        clientEmail: row.clients?.email ?? null,
        leadScore: row.clients?.lead_score ?? null,
        lastActivity: row,
        hasPendingDraft: false,
        pendingDraft: null,
        activities: [],
      });
    }
    const conv = map.get(row.client_id)!;
    conv.activities.push(row);
    if (row.ai_draft && !row.approved && !row.sent) {
      conv.hasPendingDraft = true;
      conv.pendingDraft = row;
    }
  }

  // Conversations already ordered by most recent activity (rows are desc)
  return Array.from(map.values());
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ChannelChip({ type, inbound }: { type: string; inbound: boolean }) {
  if (type === "email") {
    return (
      <span
        className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
        style={{ background: "rgba(59,130,246,0.14)", color: "var(--oc-blue)" }}
      >
        EMAIL
      </span>
    );
  }
  if (type === "text" && inbound) {
    return (
      <span
        className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
        style={{ background: "rgba(26,155,94,0.14)", color: "#1A9B5E" }}
      >
        SMS
      </span>
    );
  }
  if (type === "text") {
    return (
      <span
        className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
        style={{ background: "rgba(26,155,94,0.14)", color: "#1A9B5E" }}
      >
        SMS
      </span>
    );
  }
  return null;
}

// ── Conversation List ─────────────────────────────────────────────────────────

function ConversationRow({
  conv,
  onOpen,
}: {
  conv: Conversation;
  onOpen: (id: string) => void;
}) {
  const ring = scoreRingColor(conv.leadScore);
  const preview = previewText(conv.lastActivity);
  const ts = relTs(conv.lastActivity.created_at);
  const hasDraft = conv.hasPendingDraft;
  const isInboundLast = isInbound(conv.lastActivity);

  return (
    <button
      type="button"
      className="w-full text-left active:opacity-75"
      onClick={() => onOpen(conv.clientId)}
    >
      <div
        className="flex items-center gap-3 px-5 py-3.5"
        style={{ borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}
      >
        {/* Avatar with lead score ring */}
        <div className="relative flex-shrink-0">
          <div
            className="h-[52px] w-[52px] rounded-2xl flex items-center justify-center text-[15px] font-bold"
            style={{
              background: "rgba(59,130,246,0.14)",
              color: "var(--oc-blue)",
              boxShadow: `0 0 0 2px ${ring}`,
            }}
          >
            {initials(conv.clientName)}
          </div>
          {/* Unread dot — inbound message means client replied */}
          {isInboundLast && (
            <span
              className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2"
              style={{ background: "var(--oc-blue)", borderColor: "#0C0F16" }}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-0.5">
            <span
              className="text-[15px] font-semibold truncate"
              style={{ color: "var(--oc-text-1)" }}
            >
              {conv.clientName}
            </span>
            <span
              className="text-[12px] flex-shrink-0"
              style={{ color: "var(--oc-text-3)" }}
            >
              {ts}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <p
              className="text-[13px] truncate flex-1"
              style={{
                color: hasDraft
                  ? "var(--oc-blue)"
                  : isInboundLast
                  ? "var(--oc-text-1)"
                  : "var(--oc-text-3)",
                fontWeight: isInboundLast ? 500 : 400,
              }}
            >
              {preview}
            </p>
            {hasDraft && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                style={{
                  background: "rgba(59,130,246,0.14)",
                  color: "var(--oc-blue)",
                }}
              >
                DRAFT
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Thread View ───────────────────────────────────────────────────────────────

function ThreadView({
  conv,
  onBack,
  onActivityUpdate,
}: {
  conv: Conversation;
  onBack: () => void;
  onActivityUpdate: (updatedId: string, patch: Partial<Row>) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [composerText, setComposerText] = useState("");
  const [sendBusy, setSendBusy] = useState(false);

  // Draft sheet state
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftBody, setDraftBody] = useState("");
  const [draftBusy, setDraftBusy] = useState(false);

  // Chronological order for display (activities stored newest-first)
  const chronological = useMemo(
    () => [...conv.activities].reverse(),
    [conv.activities]
  );

  // Scroll to bottom on open
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  function openDraft(row: Row) {
    setDraftBody(row.body ?? "");
    setDraftOpen(true);
  }

  async function approveDraft() {
    if (!conv.pendingDraft || draftBusy) return;
    const phone = conv.clientPhone;
    if (!phone) {
      toast.toast("Client has no phone number", "warn");
      return;
    }
    setDraftBusy(true);
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId: conv.pendingDraft.id,
          clientId: conv.clientId,
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
      onActivityUpdate(conv.pendingDraft.id, {
        sent: true,
        approved: true,
        body: draftBody,
      });
      setDraftOpen(false);
      router.refresh();
    } finally {
      setDraftBusy(false);
    }
  }

  async function dismissDraft() {
    if (!conv.pendingDraft || draftBusy) return;
    setDraftBusy(true);
    try {
      const res = await fetch(`/api/inbox/${conv.pendingDraft.id}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (!data.ok) {
        toast.toast("Could not dismiss", "warn");
        return;
      }
      toast.toast("Dismissed", "success");
      onActivityUpdate(conv.pendingDraft.id, { ai_draft: false, approved: true });
      setDraftOpen(false);
      router.refresh();
    } finally {
      setDraftBusy(false);
    }
  }

  // SMS-only composer. Email sending is not yet wired in this surface.
  async function sendMessage() {
    const text = composerText.trim();
    if (!text || sendBusy) return;
    if (!conv.clientPhone) {
      toast.toast("Client has no phone number on file", "warn");
      return;
    }

    setSendBusy(true);
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: conv.clientId,
          to: conv.clientPhone,
          body: text,
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
      setComposerText("");
      router.refresh();
      toast.toast("Sent", "success");
    } finally {
      setSendBusy(false);
    }
  }

  function handleComposerKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  const canSend = !!conv.clientPhone;

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col"
      style={{ background: "#0C0F16", color: "var(--oc-text-1)" }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-4 pt-safe-top"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 16px)",
          paddingBottom: 12,
          borderBottom: "0.5px solid rgba(255,255,255,0.07)",
          background: "rgba(12,15,22,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center h-9 w-9 rounded-full active:opacity-60"
          style={{ background: "rgba(255,255,255,0.06)" }}
          aria-label="Back"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <p
            className="text-[16px] font-semibold truncate"
            style={{ color: "var(--oc-text-1)" }}
          >
            {conv.clientName}
          </p>
          <p className="text-[12px]" style={{ color: "var(--oc-text-3)" }}>
            {conv.clientPhone ?? conv.clientEmail ?? "No contact info"}
          </p>
        </div>

        {/* Channel indicator */}
        <div className="flex-shrink-0">
          {conv.clientPhone && (
            <span
              className="text-[11px] font-semibold px-2 py-1 rounded-lg"
              style={{ background: "rgba(26,155,94,0.14)", color: "#1A9B5E" }}
            >
              SMS
            </span>
          )}
          {conv.clientEmail && (
            <span
              className="text-[11px] font-semibold px-2 py-1 rounded-lg ml-1.5"
              style={{
                background: "rgba(59,130,246,0.14)",
                color: "var(--oc-blue)",
              }}
            >
              Email
            </span>
          )}
        </div>
      </div>

      {/* ── Messages scroll area ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ scrollbarWidth: "none" }}
      >
        {chronological.map((row, idx) => {
          const prevRow = idx > 0 ? chronological[idx - 1] : null;
          const showDaySep =
            !prevRow || !isSameDay(prevRow.created_at, row.created_at);
          const isDraft = !!(row.ai_draft && !row.approved && !row.sent);
          const inbound = isInbound(row);

          return (
            <div key={row.id}>
              {/* Date separator */}
              {showDaySep && (
                <div
                  className="text-center text-[11px] my-4 font-medium"
                  style={{ color: "var(--oc-text-3)" }}
                >
                  {dayLabel(row.created_at)}
                </div>
              )}

              {/* Message bubbles */}
              {isMessageRow(row) ? (
                <div
                  className={`flex mb-2 ${inbound ? "justify-start" : "justify-end"}`}
                >
                  {isDraft ? (
                    // AI draft — right-aligned, dashed border
                    <button
                      type="button"
                      className="text-left active:opacity-80"
                      style={{ maxWidth: "78%" }}
                      onClick={() => openDraft(row)}
                    >
                      <div
                        className="rounded-[18px] rounded-br-[4px] px-4 py-3"
                        style={{
                          background: "rgba(59,130,246,0.08)",
                          border: "1px dashed rgba(59,130,246,0.35)",
                        }}
                      >
                        <p
                          className="text-[10px] font-bold mb-1.5"
                          style={{ color: "var(--oc-blue)" }}
                        >
                          ARIA DRAFT — tap to edit
                        </p>
                        <p
                          className="text-[14px] leading-relaxed"
                          style={{ color: "var(--oc-text-2)" }}
                        >
                          {row.body || "Draft ready"}
                        </p>
                      </div>
                    </button>
                  ) : inbound ? (
                    // Client message — left bubble
                    <div style={{ maxWidth: "78%" }}>
                      <div
                        className="rounded-[18px] rounded-tl-[4px] px-4 py-3"
                        style={{
                          background: "rgba(255,255,255,0.07)",
                          border: "0.5px solid rgba(255,255,255,0.09)",
                        }}
                      >
                        <p
                          className="text-[14px] leading-relaxed"
                          style={{ color: "var(--oc-text-1)" }}
                        >
                          {row.body}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 ml-1">
                        <ChannelChip type={row.type} inbound={true} />
                        <span
                          className="text-[11px]"
                          style={{ color: "var(--oc-text-3)" }}
                        >
                          {relTs(row.created_at)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    // Agent message — right bubble
                    <div style={{ maxWidth: "78%" }}>
                      <div
                        className="rounded-[18px] rounded-br-[4px] px-4 py-3"
                        style={{ background: "var(--oc-blue)" }}
                      >
                        <p className="text-[14px] leading-relaxed text-white">
                          {row.body}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 justify-end mr-1">
                        <ChannelChip type={row.type} inbound={false} />
                        <span
                          className="text-[11px]"
                          style={{ color: "var(--oc-text-3)" }}
                        >
                          {relTs(row.created_at)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Non-message activity — centered pill
                <div
                  className="text-center text-[12px] my-3"
                  style={{ color: "var(--oc-text-3)" }}
                >
                  {row.type === "call" && "Call logged"}
                  {row.type === "note" && `Note: "${row.body ?? ""}"`}
                  {row.type === "showing" && "Showing"}
                  {row.type === "automation" && "Automated follow-up"}
                  {!["call", "note", "showing", "automation"].includes(row.type) &&
                    row.type}
                  {" · "}
                  {relTs(row.created_at)}
                </div>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {chronological.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-[13px]" style={{ color: "var(--oc-text-3)" }}>
              No messages yet. Start the conversation below.
            </p>
          </div>
        )}
      </div>

      {/* ── Composer ── */}
      <div
        className="px-4 pb-safe-bottom"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 24px)",
          paddingTop: 12,
          borderTop: "0.5px solid rgba(255,255,255,0.07)",
          background: "rgba(12,15,22,0.94)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        {conv.clientPhone ? (
          <div className="flex items-end gap-2">
            <textarea
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              onKeyDown={handleComposerKey}
              placeholder="Text message…"
              rows={1}
              className="flex-1 resize-none rounded-2xl px-4 py-3 text-[14px] leading-relaxed outline-none"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "0.5px solid rgba(255,255,255,0.10)",
                color: "var(--oc-text-1)",
                minHeight: 44,
                maxHeight: 120,
                overflowY: "auto",
              }}
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={sendBusy || !composerText.trim() || !canSend}
              className="h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0 disabled:opacity-35 active:opacity-70"
              style={{ background: "var(--oc-blue)" }}
              aria-label="Send SMS"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        ) : (
          <div
            className="rounded-2xl px-4 py-3 text-center text-[13px]"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "0.5px solid rgba(255,255,255,0.08)",
              color: "var(--oc-text-3)",
            }}
          >
            No phone number on file — add one in the client profile to send SMS
          </div>
        )}
      </div>

      {/* ── Draft sheet ── */}
      {draftOpen && conv.pendingDraft && (
        <div className="fixed inset-0 z-50" onClick={() => { if (!draftBusy) setDraftOpen(false); }}>
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
                style={{ background: "rgba(59,130,246,0.16)", color: "var(--oc-blue)" }}
              >
                {initials(conv.clientName)}
              </div>
              <div>
                <p
                  className="text-[15px] font-semibold"
                  style={{ color: "var(--oc-text-1)" }}
                >
                  {conv.clientName}
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
              onClick={() => void approveDraft()}
              disabled={draftBusy}
              className="w-full text-white font-semibold rounded-2xl py-3.5 text-[14px] mb-2.5 disabled:opacity-60 active:opacity-80"
              style={{ background: "var(--oc-blue)" }}
            >
              {draftBusy ? "Sending…" : "Approve & Send"}
            </button>
            <button
              type="button"
              onClick={() => void dismissDraft()}
              disabled={draftBusy}
              className="w-full font-medium rounded-2xl py-3 text-[14px] active:opacity-70"
              style={{ color: "var(--oc-text-3)" }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function InboxClient({
  initial,
  gmailStatus,
}: {
  initial: Row[];
  gmailStatus: GmailStatus;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial);
  const [openClientId, setOpenClientId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("All");

  useEffect(() => {
    setRows(initial);
  }, [initial]);

  // Backfill placeholder AI drafts with real copy on load
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
        const data = (await res.json().catch(() => ({}))) as {
          updated?: number;
        };
        if ((data.updated ?? 0) > 0) router.refresh();
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    })();
    return () => controller.abort();
  }, [router]);

  // Update a single activity row in state (after draft approve/dismiss)
  const handleActivityUpdate = useCallback(
    (updatedId: string, patch: Partial<Row>) => {
      setRows((prev) =>
        prev.map((r) => (r.id === updatedId ? { ...r, ...patch } : r))
      );
    },
    []
  );

  const conversations = useMemo(() => groupByClient(rows), [rows]);

  // Apply filter to conversation list
  const filtered = useMemo(() => {
    return conversations.filter((conv) => {
      if (filter === "All") return true;
      if (filter === "Pending") return conv.hasPendingDraft;
      if (filter === "SMS")
        return conv.activities.some((a) => a.type === "text");
      if (filter === "Email")
        return conv.activities.some((a) => a.type === "email");
      return true;
    });
  }, [conversations, filter]);

  const pendingCount = conversations.filter((c) => c.hasPendingDraft).length;
  const openConv = conversations.find((c) => c.clientId === openClientId) ?? null;

  // Thread view — fullscreen overlay
  if (openConv) {
    return (
      <ThreadView
        conv={openConv}
        onBack={() => setOpenClientId(null)}
        onActivityUpdate={handleActivityUpdate}
      />
    );
  }

  // ── Conversation list ──────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen pb-[130px]"
      style={{ background: "#0C0F16", color: "var(--oc-text-1)" }}
    >
      {/* ── Header ── */}
      <div className="px-5 pt-6 pb-3">
        <div className="flex items-start justify-between mb-1">
          <h1
            className="text-[24px] font-bold"
            style={{ letterSpacing: "-0.03em" }}
          >
            Conversations
          </h1>
          {pendingCount > 0 && (
            <span
              className="rounded-xl px-2.5 py-1 text-[12px] font-bold text-white mt-1"
              style={{ background: "#C43838" }}
            >
              {pendingCount} pending
            </span>
          )}
        </div>
        <p className="text-[13px]" style={{ color: "var(--oc-text-3)" }}>
          {conversations.length > 0
            ? `${conversations.length} client${conversations.length !== 1 ? "s" : ""}`
            : "No conversations yet"}
        </p>
      </div>

      {/* ── Gmail status banner ── */}
      {gmailStatus.connected ? (
        <div
          className="mx-5 flex items-center gap-2.5 rounded-2xl px-4 py-2.5 mb-3"
          style={{
            background: "rgba(26,155,94,0.08)",
            border: "0.5px solid rgba(26,155,94,0.22)",
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full flex-shrink-0"
            style={{ background: "#1A9B5E" }}
          />
          <span
            className="text-[12px] font-medium flex-1"
            style={{ color: "#1A9B5E" }}
          >
            Gmail connected
          </span>
          {gmailStatus.email && (
            <span className="text-[11px]" style={{ color: "var(--oc-text-3)" }}>
              {gmailStatus.email}
            </span>
          )}
        </div>
      ) : (
        <div
          className="mx-5 flex items-center gap-2.5 rounded-2xl px-4 py-2.5 mb-3"
          style={{
            background: "rgba(196,126,26,0.08)",
            border: "0.5px solid rgba(196,126,26,0.22)",
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full flex-shrink-0"
            style={{ background: "#C47E1A" }}
          />
          <span
            className="text-[12px] font-medium flex-1"
            style={{ color: "#C47E1A" }}
          >
            Gmail not connected — email sending disabled
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

      {/* ── Filter tabs ── */}
      <div
        className="flex gap-2 px-5 overflow-x-auto pb-3"
        style={{ scrollbarWidth: "none" }}
      >
        {(["All", "Pending", "SMS", "Email"] as FilterKey[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className="px-3.5 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap flex-shrink-0"
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
        {/* Future channels — not yet functional */}
        {["Gmail", "Outlook"].map((ch) => (
          <span
            key={ch}
            className="px-3.5 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap flex-shrink-0 select-none"
            style={{
              background: "var(--oc-surface-1)",
              color: "var(--oc-text-3)",
              border: "0.5px solid var(--oc-border-soft)",
              opacity: 0.35,
            }}
            title={`${ch} — coming soon`}
          >
            {ch} · Soon
          </span>
        ))}
      </div>

      {/* ── Conversation list ── */}
      <div
        className="rounded-2xl overflow-hidden mx-5"
        style={{ background: "var(--oc-surface-1)", border: "0.5px solid var(--oc-border-soft)" }}
      >
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            {filter === "Pending" ? (
              <>
                <p
                  className="text-[15px] font-semibold mb-1"
                  style={{ color: "var(--oc-text-1)" }}
                >
                  No pending drafts
                </p>
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: "var(--oc-text-3)" }}
                >
                  Aria surfaces follow-up drafts when a client needs attention.
                </p>
              </>
            ) : (
              <>
                <p
                  className="text-[15px] font-semibold mb-1"
                  style={{ color: "var(--oc-text-1)" }}
                >
                  Aria is watching
                </p>
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: "var(--oc-text-3)" }}
                >
                  When clients need follow-up, Aria drafts a message and
                  surfaces it here.
                </p>
              </>
            )}
          </div>
        ) : (
          filtered.map((conv) => (
            <ConversationRow
              key={conv.clientId}
              conv={conv}
              onOpen={setOpenClientId}
            />
          ))
        )}
      </div>
    </div>
  );
}
