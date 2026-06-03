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

// Strip email header lines (To:, Subject:, From:, etc.) that may be stored
// in the body field when activities are created via the Gmail send route.
function parseEmailContent(raw: string | null): { subject: string | null; cleanBody: string } {
  if (!raw) return { subject: null, cleanBody: "" };
  // Detect header block: a line starting with a known header key
  const headerRe = /^(To|From|Subject|Cc|Bcc|Date|Content-Type|MIME-Version|Content-Transfer-Encoding):/im;
  if (!headerRe.test(raw.slice(0, 300))) {
    return { subject: null, cleanBody: raw };
  }
  const lines = raw.split("\n");
  let subject: string | null = null;
  let bodyStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "") { bodyStart = i + 1; break; }
    if (/^Subject:/i.test(lines[i])) subject = lines[i].replace(/^Subject:\s*/i, "").trim();
  }
  const cleanBody = bodyStart >= 0 ? lines.slice(bodyStart).join("\n").trim() : raw;
  return { subject, cleanBody };
}

// Urgency score — higher = should appear earlier in conversation list.
// Factors: pending draft, unread reply, silence duration, lead score.
function urgencyScore(conv: Conversation): number {
  const daysSince = Math.floor(
    (Date.now() - new Date(conv.lastActivity.created_at).getTime()) / 86_400_000
  );
  let score = 0;
  if (conv.hasPendingDraft) score += 10_000;
  if (isInbound(conv.lastActivity) && daysSince < 3) score += 5_000;
  if ((conv.leadScore ?? 0) >= 8 && daysSince >= 7) score += 2_000;
  if (daysSince >= 14) score += 1_000;
  else if (daysSince >= 7) score += 400;
  score -= daysSince; // recency tiebreaker within tier
  return score;
}

// One reason chip per conversation row — answers "why does this matter?"
function reasonChip(
  conv: Conversation
): { label: string; color: string; bg: string } | null {
  const daysSince = Math.floor(
    (Date.now() - new Date(conv.lastActivity.created_at).getTime()) / 86_400_000
  );
  if (conv.hasPendingDraft)
    return { label: "Draft pending", color: "var(--oc-blue)", bg: "rgba(59,130,246,0.12)" };
  if (isInbound(conv.lastActivity) && daysSince < 3)
    return { label: "Replied recently", color: "#1A9B5E", bg: "rgba(26,155,94,0.12)" };
  if (daysSince >= 14)
    return { label: "No contact 14d+", color: "#C47E1A", bg: "rgba(196,126,26,0.12)" };
  if (daysSince >= 7)
    return { label: "No contact 7d+", color: "#C47E1A", bg: "rgba(196,126,26,0.08)" };
  if ((conv.leadScore ?? 0) >= 8)
    return { label: "Hot lead", color: "#1A9B5E", bg: "rgba(26,155,94,0.10)" };
  return null;
}

// Preview text for conversation list row — strips email headers for clean display
function previewText(row: Row): string {
  const body = row.body ?? "";
  if (row.ai_draft && !row.approved) {
    const p = body.length > 55 ? body.slice(0, 55) + "…" : body;
    return `Aria: ${p || "Draft ready"}`;
  }
  if (row.direction === "inbound") {
    return body.length > 60 ? body.slice(0, 60) + "…" : body;
  }
  if (row.type === "call") return "Call logged";
  if (row.type === "note") return body.length > 60 ? body.slice(0, 60) + "…" : body || "Note";
  if (row.type === "showing") return "Showing logged";
  if (row.type === "email") {
    const { subject, cleanBody } = parseEmailContent(body);
    const content = subject || cleanBody;
    return `You: ${content.length > 55 ? content.slice(0, 55) + "…" : content}`;
  }
  const p = body.length > 60 ? body.slice(0, 60) + "…" : body;
  return `You: ${p}`;
}

// Whether a message is from the client (left side) vs agent (right side)
function isInbound(row: Row): boolean {
  return row.direction === "inbound";
}

// Group rows by client, then sort by urgency (highest first)
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

  const convs = Array.from(map.values());
  convs.sort((a, b) => urgencyScore(b) - urgencyScore(a));
  return convs;
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
  const chip = reasonChip(conv);

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

          <p
            className="text-[13px] truncate"
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
          {/* Reason chip — answers "why does this conversation matter?" */}
          {chip && (
            <div className="flex items-center mt-1">
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: chip.bg, color: chip.color }}
              >
                {chip.label}
              </span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Thread View ───────────────────────────────────────────────────────────────

type ThreadChannel = "sms" | "email" | "whatsapp";

// Compact inline draft card — sparkle + preview + Review & Send tap
function DraftCard({ row, onTap }: { row: Row; onTap: () => void }) {
  const preview = (row.body ?? "Draft ready").slice(0, 80);
  return (
    <div className="flex justify-end mb-2">
      <button
        type="button"
        className="text-left active:scale-[0.98] transition-transform"
        style={{ maxWidth: "72%" }}
        onClick={onTap}
      >
        <div
          className="rounded-[18px] rounded-br-[4px] px-3.5 py-2.5"
          style={{
            background: "rgba(59,130,246,0.09)",
            border: "1px dashed rgba(59,130,246,0.32)",
          }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            {/* Sparkle */}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"
                fill="#3B82F6"
              />
            </svg>
            <span
              className="text-[10px] font-bold tracking-wide"
              style={{ color: "var(--oc-blue)" }}
            >
              ARIA DRAFT
            </span>
          </div>
          <p
            className="text-[13px] leading-snug mb-2"
            style={{ color: "var(--oc-text-2)" }}
          >
            {preview}{(row.body ?? "").length > 80 ? "…" : ""}
          </p>
          <span
            className="text-[11px] font-semibold"
            style={{ color: "var(--oc-blue)" }}
          >
            Review &amp; Send →
          </span>
        </div>
      </button>
    </div>
  );
}

// Compact email card — channel badge + subject + collapsible body
function EmailBubble({ row, inbound }: { row: Row; inbound: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { subject, cleanBody } = parseEmailContent(row.body);
  const preview = cleanBody.slice(0, 90);

  return (
    <div className={`flex mb-2 ${inbound ? "justify-start" : "justify-end"}`}>
      <div style={{ maxWidth: "72%" }}>
        <button
          type="button"
          className="text-left w-full active:opacity-80"
          onClick={() => setExpanded((v) => !v)}
        >
          <div
            className="rounded-[16px] px-3.5 py-2.5"
            style={{
              background: inbound
                ? "rgba(255,255,255,0.07)"
                : "rgba(59,130,246,0.13)",
              border: `0.5px solid ${inbound ? "rgba(255,255,255,0.09)" : "rgba(59,130,246,0.28)"}`,
            }}
          >
            {/* Header row */}
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{
                  background: "rgba(59,130,246,0.18)",
                  color: "var(--oc-blue)",
                }}
              >
                EMAIL
              </span>
              {subject && (
                <span
                  className="text-[12px] font-semibold truncate"
                  style={{ color: inbound ? "var(--oc-text-1)" : "#A8C8FF" }}
                >
                  {subject}
                </span>
              )}
            </div>
            {/* Body preview / expanded */}
            <p
              className="text-[13px] leading-snug"
              style={{ color: inbound ? "var(--oc-text-2)" : "rgba(255,255,255,0.80)" }}
            >
              {expanded ? cleanBody : (preview + (cleanBody.length > 90 ? "…" : ""))}
            </p>
            {cleanBody.length > 90 && (
              <p
                className="text-[11px] mt-1.5 font-medium"
                style={{ color: "var(--oc-blue)" }}
              >
                {expanded ? "Show less" : "Show more"}
              </p>
            )}
          </div>
        </button>
        <div
          className={`flex items-center gap-1.5 mt-1 ${inbound ? "ml-1" : "mr-1 justify-end"}`}
        >
          <span className="text-[11px]" style={{ color: "var(--oc-text-3)" }}>
            {relTs(row.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

function ThreadView({
  conv,
  gmailStatus,
  onBack,
  onActivityUpdate,
}: {
  conv: Conversation;
  gmailStatus: GmailStatus;
  onBack: () => void;
  onActivityUpdate: (updatedId: string, patch: Partial<Row>) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Default to SMS if phone exists, Email if only email, else SMS
  const defaultChannel: ThreadChannel =
    conv.clientPhone ? "sms" : conv.clientEmail ? "email" : "sms";
  const [activeChannel, setActiveChannel] = useState<ThreadChannel>(defaultChannel);

  const [composerText, setComposerText] = useState("");
  const [sendBusy, setSendBusy] = useState(false);

  // Draft review sheet state
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftBody, setDraftBody] = useState("");
  const [draftBusy, setDraftBusy] = useState(false);

  // All activities in chronological order (stored newest-first in DB)
  const allChronological = useMemo(
    () => [...conv.activities].reverse(),
    [conv.activities]
  );

  // Filter by active channel
  const chronological = useMemo(() => {
    if (activeChannel === "sms")
      return allChronological.filter(
        (r) => r.type === "text" || (r.ai_draft && !r.approved && !r.sent)
      );
    if (activeChannel === "email")
      return allChronological.filter((r) => r.type === "email");
    return [];
  }, [allChronological, activeChannel]);

  // Scroll to bottom on open and channel switch
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [activeChannel]);

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
      onActivityUpdate(conv.pendingDraft.id, { sent: true, approved: true, body: draftBody });
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
      const res = await fetch(`/api/inbox/${conv.pendingDraft.id}`, { method: "DELETE" });
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

  async function sendSms() {
    const text = composerText.trim();
    if (!text || sendBusy || !conv.clientPhone) return;
    setSendBusy(true);
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: conv.clientId, to: conv.clientPhone, body: text }),
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
      void sendSms();
    }
  }

  // WhatsApp deep link — strips leading + for wa.me format
  const waPhone = (conv.clientPhone ?? "").replace(/^\+/, "");
  const waHref = `https://wa.me/${waPhone}`;

  const CHANNELS: { key: ThreadChannel; label: string }[] = [
    { key: "sms", label: "SMS" },
    { key: "email", label: "Email" },
    { key: "whatsapp", label: "WhatsApp" },
  ];

  return (
    // z-[60] above AppHeader (z-30) and BottomNav (z-50).
    // PageShell bypasses /inbox — fixed positioning is viewport-relative.
    // height: 100dvh = dynamic viewport height; shrinks when iOS keyboard opens.
    <div
      className="fixed top-0 left-0 right-0 z-[60] flex flex-col overflow-hidden"
      style={{ height: "100dvh", background: "#0C0F16", color: "var(--oc-text-1)" }}
    >
      {/* ── Header + channel tabs ── */}
      <div
        className="flex-shrink-0"
        style={{
          background: "rgba(12,15,22,0.96)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderBottom: "0.5px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Top row: back + name */}
        <div
          className="flex items-center gap-3 px-4"
          style={{
            paddingTop: "max(env(safe-area-inset-top), 14px)",
            paddingBottom: 8,
          }}
        >
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center h-8 w-8 rounded-full active:opacity-60 flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.08)" }}
            aria-label="Back"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <div className="flex-1 min-w-0">
            <p
              className="text-[15px] font-semibold truncate leading-tight"
              style={{ color: "var(--oc-text-1)" }}
            >
              {conv.clientName}
            </p>
            <p
              className="text-[11px] leading-tight mt-0.5"
              style={{ color: "var(--oc-text-3)" }}
            >
              {conv.clientPhone ?? conv.clientEmail ?? "No contact info"}
            </p>
          </div>
        </div>

        {/* Channel tabs */}
        <div className="flex px-4 gap-0">
          {CHANNELS.map(({ key, label }) => {
            const isActive = activeChannel === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveChannel(key)}
                className="text-[13px] font-medium pb-2.5 pr-5 transition-colors"
                style={{
                  color: isActive ? "var(--oc-blue)" : "var(--oc-text-3)",
                  borderBottom: isActive
                    ? "2px solid var(--oc-blue)"
                    : "2px solid transparent",
                  background: "none",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Messages scroll area ── */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 pt-4"
        style={{ scrollbarWidth: "none", paddingBottom: 12 }}
      >
        {/* WhatsApp — external deep link only */}
        {activeChannel === "whatsapp" ? (
          <div className="flex flex-col items-center justify-center min-h-full gap-4 pb-12">
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(37,211,102,0.15)" }}
            >
              {/* WhatsApp icon */}
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
                  fill="#25D166"
                />
              </svg>
            </div>
            <div className="text-center">
              <p
                className="text-[15px] font-semibold mb-1"
                style={{ color: "var(--oc-text-1)" }}
              >
                Continue on WhatsApp
              </p>
              <p
                className="text-[13px] mb-5 leading-relaxed"
                style={{ color: "var(--oc-text-3)" }}
              >
                WhatsApp messages are sent and received<br />
                in the WhatsApp app directly.
              </p>
              {conv.clientPhone ? (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-semibold text-[14px] px-5 py-3 rounded-2xl text-white"
                  style={{ background: "#25D166" }}
                >
                  Open WhatsApp
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
              ) : (
                <p
                  className="text-[13px] px-4 py-3 rounded-2xl"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    color: "var(--oc-text-3)",
                    border: "0.5px solid rgba(255,255,255,0.08)",
                  }}
                >
                  No phone number on file
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            {chronological.map((row, idx) => {
              const prevRow = idx > 0 ? chronological[idx - 1] : null;
              const showDaySep = !prevRow || !isSameDay(prevRow.created_at, row.created_at);
              const isDraft = !!(row.ai_draft && !row.approved && !row.sent);
              const inbound = isInbound(row);

              return (
                <div key={row.id}>
                  {showDaySep && (
                    <div
                      className="text-center text-[11px] my-4 font-medium"
                      style={{ color: "var(--oc-text-3)" }}
                    >
                      {dayLabel(row.created_at)}
                    </div>
                  )}

                  {isDraft ? (
                    <DraftCard row={row} onTap={() => openDraft(row)} />
                  ) : row.type === "email" ? (
                    <EmailBubble row={row} inbound={inbound} />
                  ) : row.type === "text" ? (
                    // SMS bubble
                    <div
                      className={`flex mb-2 ${inbound ? "justify-start" : "justify-end"}`}
                    >
                      {inbound ? (
                        <div style={{ maxWidth: "72%" }}>
                          <div
                            className="rounded-[18px] rounded-tl-[4px] px-3.5 py-2.5"
                            style={{
                              background: "rgba(255,255,255,0.08)",
                              border: "0.5px solid rgba(255,255,255,0.09)",
                            }}
                          >
                            <p
                              className="text-[14px] leading-snug"
                              style={{ color: "var(--oc-text-1)" }}
                            >
                              {row.body}
                            </p>
                          </div>
                          <p
                            className="text-[11px] mt-1 ml-1"
                            style={{ color: "var(--oc-text-3)" }}
                          >
                            {relTs(row.created_at)}
                          </p>
                        </div>
                      ) : (
                        <div style={{ maxWidth: "72%" }}>
                          <div
                            className="rounded-[18px] rounded-br-[4px] px-3.5 py-2.5"
                            style={{ background: "var(--oc-blue)" }}
                          >
                            <p className="text-[14px] leading-snug text-white">
                              {row.body}
                            </p>
                          </div>
                          <p
                            className="text-[11px] mt-1 mr-1 text-right"
                            style={{ color: "var(--oc-text-3)" }}
                          >
                            {relTs(row.created_at)}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Non-message activity pill
                    <div
                      className="text-center text-[11px] my-3"
                      style={{ color: "var(--oc-text-3)" }}
                    >
                      {row.type === "call" && "Call logged"}
                      {row.type === "note" && `Note: "${row.body ?? ""}"`}
                      {row.type === "showing" && "Showing"}
                      {row.type === "automation" && "Automated follow-up"}
                      {!["call", "note", "showing", "automation"].includes(row.type) && row.type}
                      {" · "}
                      {relTs(row.created_at)}
                    </div>
                  )}
                </div>
              );
            })}

            {chronological.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-full gap-2 pb-12">
                <p
                  className="text-[14px] font-medium"
                  style={{ color: "var(--oc-text-2)" }}
                >
                  {activeChannel === "email"
                    ? "No emails yet"
                    : "No messages yet"}
                </p>
                <p className="text-[13px]" style={{ color: "var(--oc-text-3)" }}>
                  {activeChannel === "email" && !gmailStatus.connected
                    ? "Connect Gmail in Settings to send emails."
                    : "Send the first message below."}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Composer ── */}
      {activeChannel !== "whatsapp" && (
        <div
          className="flex-shrink-0 px-4"
          style={{
            paddingTop: 10,
            paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
            borderTop: "0.5px solid rgba(255,255,255,0.06)",
            background: "rgba(12,15,22,0.94)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          }}
        >
          {activeChannel === "sms" && conv.clientPhone ? (
            <div className="flex items-end gap-2">
              <textarea
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                onKeyDown={handleComposerKey}
                placeholder="Text message…"
                rows={1}
                className="flex-1 resize-none outline-none"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "0.5px solid rgba(255,255,255,0.10)",
                  color: "var(--oc-text-1)",
                  borderRadius: 22,
                  paddingLeft: 16,
                  paddingRight: 16,
                  paddingTop: 12,
                  paddingBottom: 12,
                  fontSize: 16, // 16px minimum — prevents iOS auto-zoom on focus
                  lineHeight: "1.4",
                  minHeight: 44,
                  maxHeight: 120,
                  overflowY: "auto",
                }}
              />
              <button
                type="button"
                onClick={() => void sendSms()}
                disabled={sendBusy || !composerText.trim()}
                className="h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-30 active:opacity-70 transition-opacity"
                style={{ background: "var(--oc-blue)" }}
                aria-label="Send SMS"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"
                    stroke="white"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          ) : activeChannel === "sms" && !conv.clientPhone ? (
            <div
              className="rounded-full px-5 py-3 text-center text-[14px]"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "0.5px solid rgba(255,255,255,0.08)",
                color: "var(--oc-text-3)",
                fontSize: 14,
              }}
            >
              No phone number on file
            </div>
          ) : activeChannel === "email" && gmailStatus.connected ? (
            // Email composer — Gmail connected
            <div className="flex items-end gap-2">
              <textarea
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                placeholder="Write an email…"
                rows={1}
                className="flex-1 resize-none outline-none"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "0.5px solid rgba(255,255,255,0.10)",
                  color: "var(--oc-text-1)",
                  borderRadius: 22,
                  paddingLeft: 16,
                  paddingRight: 16,
                  paddingTop: 12,
                  paddingBottom: 12,
                  fontSize: 16,
                  lineHeight: "1.4",
                  minHeight: 44,
                  maxHeight: 120,
                  overflowY: "auto",
                }}
              />
              <button
                type="button"
                disabled={!composerText.trim()}
                className="h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-30 active:opacity-70"
                style={{ background: "var(--oc-blue)" }}
                aria-label="Send email"
                onClick={() => toast.toast("Email send coming soon", "warn")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"
                    stroke="white"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          ) : (
            // Email — Gmail not connected
            <a
              href="/settings"
              className="flex items-center justify-between rounded-full px-5 py-3"
              style={{
                background: "rgba(196,126,26,0.08)",
                border: "0.5px solid rgba(196,126,26,0.22)",
              }}
            >
              <span className="text-[14px]" style={{ color: "#C47E1A" }}>
                Connect Gmail to send emails
              </span>
              <span className="text-[13px] font-semibold" style={{ color: "var(--oc-blue)" }}>
                Settings →
              </span>
            </a>
          )}
        </div>
      )}

      {/* ── Draft review sheet ── */}
      {draftOpen && conv.pendingDraft && (
        <div
          className="fixed inset-0 z-[70]"
          onClick={() => { if (!draftBusy) setDraftOpen(false); }}
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
                style={{ background: "rgba(59,130,246,0.16)", color: "var(--oc-blue)" }}
              >
                {initials(conv.clientName)}
              </div>
              <div>
                <p className="text-[15px] font-semibold" style={{ color: "var(--oc-text-1)" }}>
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
              className="w-full rounded-2xl p-4 resize-none outline-none mb-4"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "0.5px solid var(--oc-border-soft)",
                color: "var(--oc-text-1)",
                fontSize: 16,
                lineHeight: "1.5",
              }}
              rows={5}
            />
            <button
              type="button"
              onClick={() => void approveDraft()}
              disabled={draftBusy}
              className="w-full text-white font-semibold rounded-2xl py-3.5 text-[15px] mb-2.5 disabled:opacity-60 active:opacity-80"
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
  initialClientId = null,
}: {
  initial: Row[];
  gmailStatus: GmailStatus;
  initialClientId?: string | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial);
  // Seed from ?clientId= query param — allows deep-linking to a thread
  const [openClientId, setOpenClientId] = useState<string | null>(initialClientId);
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
        gmailStatus={gmailStatus}
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
