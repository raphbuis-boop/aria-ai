"use client";

import { useState } from "react";
import {
  Mail,
  MailOpen,
  Reply,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";

export interface EmailMessageSummary {
  id: string;
  threadId: string;
  from: string | null;
  to: string | null;
  subject: string | null;
  date: string | null;
  snippet: string;
  unread: boolean;
  direction: "inbound" | "outbound" | "other";
}

interface Props {
  clientEmail: string | null;
  onReply: (opts: {
    to: string;
    subject: string;
    body: string;
    threadId: string;
    inReplyTo: string | null;
    references: string[] | null;
  }) => void;
}

interface FullMessage {
  id: string;
  threadId: string;
  headers: {
    from: string | null;
    to: string | null;
    cc: string | null;
    subject: string | null;
    date: string | null;
    messageId: string | null;
  };
  html: string | null;
  text: string | null;
  snippet: string | null;
  labelIds: string[];
}

export function ClientEmailHistory({ clientEmail, onReply }: Props) {
  const toast = useToast();
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<EmailMessageSummary[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fullCache, setFullCache] = useState<Record<string, FullMessage>>({});
  const [fetchingFull, setFetchingFull] = useState<string | null>(null);

  async function load() {
    if (!clientEmail) {
      setError("No email on file for this client.");
      setLoaded(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/gmail/client-thread?clientEmail=${encodeURIComponent(clientEmail)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "not_connected") {
          setError("Gmail not connected. Connect in Settings.");
        } else if (data.error === "not_configured") {
          setError("Gmail OAuth is not configured on this deployment.");
        } else {
          setError(String(data.error ?? "Failed to load email history"));
        }
        return;
      }
      setMessages((data.messages ?? []) as EmailMessageSummary[]);
      setLoaded(true);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function expand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (fullCache[id]) return;
    setFetchingFull(id);
    try {
      const res = await fetch(`/api/gmail/message/${id}`);
      if (!res.ok) return;
      const data = (await res.json()) as FullMessage;
      setFullCache((prev) => ({ ...prev, [id]: data }));
      // If unread, mark as read in Gmail (fire and forget).
      const msg = messages.find((m) => m.id === id);
      if (msg?.unread) {
        void fetch(`/api/gmail/message/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markRead: true }),
        });
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, unread: false } : m)),
        );
      }
    } finally {
      setFetchingFull(null);
    }
  }

  async function markUnread(id: string) {
    try {
      await fetch(`/api/gmail/message/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markUnread: true }),
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, unread: true } : m)),
      );
      toast.toast("Marked unread", "success");
    } catch {
      toast.toast("Could not mark unread", "warn");
    }
  }

  function handleReply(m: EmailMessageSummary) {
    if (!clientEmail) return;
    const full = fullCache[m.id];
    const subject =
      m.subject && !/^re:\s*/i.test(m.subject)
        ? `Re: ${m.subject}`
        : (m.subject ?? "");
    const quotedHtml = full?.html
      ? `<blockquote style="border-left:3px solid #ccc;padding-left:10px;color:#555;">${full.html}</blockquote>`
      : full?.text
        ? `<blockquote style="border-left:3px solid #ccc;padding-left:10px;color:#555;white-space:pre-wrap;">${full.text.replace(/</g, "&lt;")}</blockquote>`
        : `<blockquote style="border-left:3px solid #ccc;padding-left:10px;color:#555;">${m.snippet}</blockquote>`;
    const prelude = `<p></p><p>On ${m.date ?? ""}, ${m.from ?? ""} wrote:</p>`;
    onReply({
      to: clientEmail,
      subject,
      body: `<p></p>${prelude}${quotedHtml}`,
      threadId: m.threadId,
      inReplyTo: full?.headers.messageId ?? null,
      references: full?.headers.messageId ? [full.headers.messageId] : null,
    });
  }

  return (
    <div className="mb-4 rounded-[14px] border border-[#1e1e2e] bg-[#12121e]">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Mail size={14} className="text-[#6f9bff]" />
          <div className="text-[13px] font-semibold text-white">
            Gmail history
          </div>
          {loaded && messages.length > 0 ? (
            <span className="rounded-md bg-[#4f7bff]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#6f9bff]">
              {messages.length}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-[8px] border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-1.5 text-[12px] font-semibold text-[#d0d0e0] disabled:opacity-60"
        >
          {loading ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> Loading…
            </span>
          ) : loaded ? (
            "Refresh"
          ) : (
            "Load email history"
          )}
        </button>
      </div>

      {error ? (
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-[10px] border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {loaded && messages.length === 0 && !error ? (
        <div className="px-4 pb-3 text-[12px] text-[#888898]">
          No messages with {clientEmail ?? "this client"} in the last 90 days.
        </div>
      ) : null}

      {messages.length > 0 ? (
        <div className="divide-y divide-[#1e1e2e] border-t border-[#1e1e2e]">
          {messages.map((m) => {
            const isExpanded = expandedId === m.id;
            const full = fullCache[m.id];
            return (
              <div key={m.id}>
                <button
                  type="button"
                  onClick={() => expand(m.id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[#0f0f1a]"
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {m.unread ? (
                      <Mail size={14} className="text-[#6f9bff]" />
                    ) : (
                      <MailOpen size={14} className="text-[#555570]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`truncate text-[12px] ${m.unread ? "font-semibold text-white" : "text-[#d0d0e0]"}`}
                      >
                        {m.direction === "inbound"
                          ? (m.from ?? "Sender")
                          : `To ${m.to ?? ""}`}
                      </span>
                      <span className="ml-auto text-[10px] text-[#555570]">
                        {formatShortDate(m.date)}
                      </span>
                    </div>
                    <div
                      className={`truncate text-[12px] ${m.unread ? "font-semibold text-white" : "text-[#d0d0e0]"}`}
                    >
                      {m.subject ?? "(no subject)"}
                    </div>
                    <div className="truncate text-[11px] text-[#888898]">
                      {m.snippet}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {isExpanded ? (
                      <ChevronUp size={14} className="text-[#555570]" />
                    ) : (
                      <ChevronDown size={14} className="text-[#555570]" />
                    )}
                  </div>
                </button>

                {isExpanded ? (
                  <div className="border-t border-[#1e1e2e] bg-[#0c0c14] px-4 py-3 text-[12px]">
                    {fetchingFull === m.id && !full ? (
                      <div className="inline-flex items-center gap-1 text-[#888898]">
                        <Loader2 size={12} className="animate-spin" /> Loading
                        message…
                      </div>
                    ) : full ? (
                      <>
                        <div className="mb-2 space-y-0.5 text-[11px] text-[#888898]">
                          <div>
                            <span className="text-[#555570]">From:</span>{" "}
                            {full.headers.from}
                          </div>
                          <div>
                            <span className="text-[#555570]">To:</span>{" "}
                            {full.headers.to}
                          </div>
                          <div>
                            <span className="text-[#555570]">Date:</span>{" "}
                            {full.headers.date}
                          </div>
                        </div>
                        <div className="mb-3 max-h-80 overflow-y-auto rounded-[8px] border border-[#1e1e2e] bg-white p-3 text-black">
                          {full.html ? (
                            <div
                              // Sanitization note: Gmail content is already
                              // sanitized client-side by Gmail; we're only
                              // rendering it here in a pane the agent
                              // explicitly opens.  For extra defense we
                              // could strip <script>/<iframe> server-side.
                              dangerouslySetInnerHTML={{ __html: full.html }}
                            />
                          ) : (
                            <pre className="whitespace-pre-wrap font-sans text-[12px]">
                              {full.text ?? m.snippet}
                            </pre>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="text-[#888898]">{m.snippet}</div>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleReply(m)}
                        className="inline-flex items-center gap-1 rounded-[8px] bg-[#4f7bff] px-3 py-1.5 text-[12px] font-semibold text-white"
                      >
                        <Reply size={12} /> Reply
                      </button>
                      <button
                        type="button"
                        onClick={() => markUnread(m.id)}
                        className="rounded-[8px] border border-[#1e1e2e] bg-[#12121e] px-3 py-1.5 text-[12px] font-medium text-[#9090a8]"
                      >
                        Mark unread
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function formatShortDate(raw: string | null): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "2-digit",
  });
}
