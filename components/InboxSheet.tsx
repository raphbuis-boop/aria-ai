"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, RefreshCw, Send } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ThreadMessage = {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
};

type ThreadData = {
  connected: boolean;
  threadId?: string;
  messages?: ThreadMessage[];
  totalThreads?: number;
};

type Props = {
  clientId: string;
  clientName: string;
  clientEmail: string;
  onClose: () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isOutbound(msg: ThreadMessage, agentEmail: string): boolean {
  return msg.from.toLowerCase().includes(agentEmail.toLowerCase());
}

// ── Component ─────────────────────────────────────────────────────────────────

export function InboxSheet({ clientId, clientName, clientEmail, onClose }: Props) {
  const [threadData, setThreadData] = useState<ThreadData | null>(null);
  const [agentEmail, setAgentEmail] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch thread + agent email
  useEffect(() => {
    if (!clientEmail) return;

    void fetch(`/api/gmail/threads?clientEmail=${encodeURIComponent(clientEmail)}`)
      .then((r) => r.json())
      .then((d: ThreadData) => {
        setThreadData(d);
        // Scroll to bottom after render
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }, 100);
      });

    void fetch("/api/gmail/status")
      .then((r) => r.json())
      .then((d: { connected: boolean; email?: string }) => {
        if (d.email) setAgentEmail(d.email);
      });
  }, [clientEmail]);

  const fetchSuggestion = useCallback(async (messages: ThreadMessage[]) => {
    setSuggestionLoading(true);
    setSuggestion("");
    try {
      const res = await fetch("/api/gmail/suggest-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          threadMessages: messages.map((m) => ({
            from: m.from,
            date: m.date,
            body: m.body,
          })),
        }),
      });
      const d = await res.json();
      setSuggestion(d.suggestion ?? "");
    } finally {
      setSuggestionLoading(false);
    }
  }, [clientName]);

  // Fetch AI suggestion once thread loads
  useEffect(() => {
    if (!threadData?.messages?.length) return;
    void fetchSuggestion(threadData.messages);
  }, [threadData, fetchSuggestion]);

  async function handleSend(body: string) {
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      const subject = threadData?.messages?.[0]?.subject
        ? `Re: ${threadData.messages[0].subject.replace(/^Re:\s*/i, "")}`
        : `Re: Message with ${clientName}`;

      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: clientEmail,
          subject,
          body: body.trim(),
          threadId: threadData?.threadId,
          clientId,
        }),
      });
      const d = await res.json();
      if (d.sent) {
        showToast("Sent ✓");
        setManualInput("");
        setSuggestion("");
        // Refresh thread after short delay
        setTimeout(() => {
          void fetch(`/api/gmail/threads?clientEmail=${encodeURIComponent(clientEmail)}`)
            .then((r) => r.json())
            .then((updated: ThreadData) => setThreadData(updated));
        }, 800);
      } else {
        showToast("Send failed — try again");
      }
    } catch {
      showToast("Send failed — try again");
    } finally {
      setSending(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const messages = threadData?.messages ?? [];
  const subject = messages[0]?.subject ?? "";
  const messageCount = messages.length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-col"
        style={{
          maxHeight: "88vh",
          borderRadius: "20px 20px 0 0",
          background: "rgba(14,14,16,0.97)",
          border: "0.5px solid rgba(255,255,255,0.10)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="rounded-full"
            style={{ width: 36, height: 4, background: "rgba(255,255,255,0.18)" }}
          />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-semibold" style={{ color: "#ffffff" }}>
              Inbox · {clientName}
            </p>
            {messageCount > 0 && (
              <p className="text-[12px] mt-0.5" style={{ color: "#6B7280" }}>
                {messageCount} message{messageCount !== 1 ? "s" : ""}
                {subject ? ` · ${subject.slice(0, 40)}` : ""}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 flex h-8 w-8 items-center justify-center rounded-full active:bg-white/10"
          >
            <X size={18} style={{ color: "#9CA3AF" }} />
          </button>
        </div>

        {/* Messages scroll area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ minHeight: 0 }}
        >
          {/* Not connected */}
          {threadData && !threadData.connected && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <p className="text-[15px]" style={{ color: "#6B7280" }}>
                Connect Gmail to see emails
              </p>
              <button
                type="button"
                onClick={() => { window.location.href = "/settings"; }}
                className="text-[13px] font-semibold"
                style={{ color: "#3B82F6" }}
              >
                Go to Settings →
              </button>
            </div>
          )}

          {/* No email on file */}
          {threadData?.connected && !clientEmail && (
            <p className="py-12 text-center text-[14px]" style={{ color: "#6B7280" }}>
              No email on file for this client.
            </p>
          )}

          {/* Loading */}
          {!threadData && (
            <div className="flex items-center justify-center py-12">
              <div
                className="h-5 w-5 animate-spin rounded-full"
                style={{ border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#3B82F6" }}
              />
            </div>
          )}

          {/* Empty thread */}
          {threadData?.connected && clientEmail && messages.length === 0 && (
            <p className="py-12 text-center text-[14px]" style={{ color: "#6B7280" }}>
              No email threads with {clientName} yet.
            </p>
          )}

          {/* Messages */}
          {messages.map((msg) => {
            const out = isOutbound(msg, agentEmail);
            return (
              <div
                key={msg.id}
                className={`mb-3 flex ${out ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[82%] rounded-2xl px-4 py-3"
                  style={{
                    background: out
                      ? "rgba(59,130,246,0.15)"
                      : "rgba(255,255,255,0.06)",
                    border: "0.5px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <p
                    className="text-[11px] mb-1"
                    style={{ color: "#6B7280" }}
                  >
                    {out ? "You" : msg.from.split("<")[0].trim()} · {msg.date.split(",")[0]}
                  </p>
                  <p
                    className="text-[13px] leading-relaxed whitespace-pre-wrap"
                    style={{ color: "#e0e0e5" }}
                  >
                    {msg.body.trim() || msg.snippet}
                  </p>
                </div>
              </div>
            );
          })}

          {/* AI suggestion card */}
          {threadData?.connected && (messages.length > 0 || suggestionLoading) && (
            <div
              className="mt-4 rounded-2xl p-4"
              style={{
                background: "rgba(167,139,250,0.08)",
                border: "0.5px solid rgba(167,139,250,0.20)",
              }}
            >
              {/* Header */}
              <div className="flex items-center gap-2 mb-3">
                {/* Mini Aria logo */}
                <svg viewBox="0 0 200 200" width="16" height="16">
                  <defs>
                    <linearGradient id="sheet-aria-grad" x1="100" y1="20" x2="100" y2="180" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#A78BFA" />
                      <stop offset="100%" stopColor="#7C3AED" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M100 25 L165 175 L130 175 L120 150 L80 150 L70 175 L35 175 Z M90 125 L110 125 L100 100 Z"
                    fill="url(#sheet-aria-grad)"
                  />
                </svg>
                <span className="text-[11px] font-semibold uppercase" style={{ color: "#A78BFA", letterSpacing: "0.06em" }}>
                  Aria suggests a reply
                </span>
                {!suggestionLoading && suggestion && (
                  <button
                    type="button"
                    onClick={() => threadData.messages && fetchSuggestion(threadData.messages)}
                    className="ml-auto"
                    aria-label="Try a different tone"
                  >
                    <RefreshCw size={14} style={{ color: "#A78BFA" }} />
                  </button>
                )}
              </div>

              {suggestionLoading ? (
                <div className="flex items-center gap-2">
                  <div
                    className="h-4 w-4 animate-spin rounded-full"
                    style={{ border: "2px solid rgba(167,139,250,0.2)", borderTopColor: "#A78BFA" }}
                  />
                  <p className="text-[13px]" style={{ color: "#9CA3AF" }}>Drafting…</p>
                </div>
              ) : editMode ? (
                <textarea
                  value={suggestion}
                  onChange={(e) => setSuggestion(e.target.value)}
                  className="w-full resize-none rounded-xl px-3 py-2.5 text-[13px] leading-relaxed outline-none"
                  rows={5}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "0.5px solid rgba(255,255,255,0.10)",
                    color: "#e0e0e5",
                  }}
                />
              ) : (
                <p className="text-[13px] italic leading-relaxed" style={{ color: "#C4B5FD" }}>
                  {suggestion}
                </p>
              )}

              {/* Action buttons */}
              {!suggestionLoading && suggestion && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => handleSend(suggestion)}
                    className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold text-white active:opacity-80"
                    style={{ background: "#3B82F6" }}
                  >
                    {sending ? "Sending…" : "Send"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditMode((e) => !e)}
                    className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold active:opacity-80"
                    style={{
                      background: "transparent",
                      border: "0.5px solid rgba(255,255,255,0.15)",
                      color: "#ffffff",
                    }}
                  >
                    {editMode ? "Done editing" : "Edit"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Manual input bar */}
        {threadData?.connected && clientEmail && (
          <div
            className="flex items-end gap-2 px-4 py-3"
            style={{
              borderTop: "0.5px solid rgba(255,255,255,0.08)",
              paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
            }}
          >
            <textarea
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Or write your own…"
              rows={1}
              className="flex-1 resize-none rounded-2xl px-4 py-2.5 text-[14px] outline-none"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "0.5px solid rgba(255,255,255,0.10)",
                color: "#ffffff",
                maxHeight: 100,
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend(manualInput);
                }
              }}
            />
            <button
              type="button"
              disabled={!manualInput.trim() || sending}
              onClick={() => handleSend(manualInput)}
              className="flex h-10 w-10 items-center justify-center rounded-full active:opacity-80"
              style={{
                background: manualInput.trim() ? "#3B82F6" : "rgba(255,255,255,0.08)",
                flexShrink: 0,
              }}
            >
              <Send size={16} style={{ color: manualInput.trim() ? "#ffffff" : "#6B7280" }} />
            </button>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div
            className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full px-4 py-2 text-[13px] font-semibold text-white"
            style={{
              background: "rgba(20,20,22,0.95)",
              border: "0.5px solid rgba(255,255,255,0.12)",
              backdropFilter: "blur(20px)",
              zIndex: 10,
            }}
          >
            {toast}
          </div>
        )}
      </div>
    </>
  );
}
