"use client";

import { useToast } from "@/components/ToastProvider";
import { smsUrl } from "@/lib/messaging-links";
import { useState } from "react";

type Props = {
  kind: "hot" | "approve" | "closing";
  title: string;
  subtitle?: string;
  body?: string;
  timestamp?: string;
  draft?: string;
  clientId?: string;
  clientPhone?: string | null;
  activityId?: string;
  onSnooze?: () => void;
};

export function ActionCard({
  kind,
  title,
  subtitle,
  body,
  timestamp,
  draft,
  clientId,
  clientPhone,
  activityId,
  onSnooze,
}: Props) {
  const toast = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draftText, setDraftText] = useState(draft ?? "");
  const [loading, setLoading] = useState(false);

  const badge =
    kind === "hot"
      ? { label: "HOT LEAD", className: "bg-[rgba(245,158,11,0.15)] text-accent-amber" }
      : kind === "approve"
        ? {
            label: "APPROVE & SEND",
            className: "bg-[rgba(59,130,246,0.15)] text-accent-blue",
          }
        : {
            label: "CLOSING",
            className: "bg-[rgba(139,92,246,0.15)] text-accent-purple",
          };

  async function draftAi() {
    if (!clientId) return;
    setLoading(true);
    const res = await fetch("/api/ai/draft-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        clientName: title,
        context: "Speed-to-lead follow-up",
        scenario: "Quick check-in text",
        skipInsert: true,
      }),
    });
    const data = await res.json();
    setLoading(false);
    setDraftText(String(data.draft ?? ""));
    setSheetOpen(true);
  }

  function sendSms() {
    if (!clientId || !clientPhone) {
      toast.toast(`No phone number for ${title}. Add one in their profile.`, "warn");
      return;
    }
    if (!draftText.trim()) return;
    void fetch("/api/activities/log-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, body: draftText, channel: "sms", activityId }),
    });
    window.location.href = smsUrl(clientPhone, draftText);
    setSheetOpen(false);
  }

  return (
    <div className="rounded-[14px] border border-border-card bg-bg-card p-[13px_15px]">
      <div className="flex items-start justify-between gap-2">
        <span
          className={`rounded-[8px] px-2 py-1 text-[10px] font-medium tracking-wide ${badge.className}`}
        >
          {badge.label}
        </span>
        {timestamp ? (
          <span className="text-[11px] text-text-dim">{timestamp}</span>
        ) : null}
      </div>
      <div className="mt-2 text-[13px] font-medium text-text-primary">{title}</div>
      {subtitle ? (
        <div className="mt-1 text-[12px] text-text-muted">{subtitle}</div>
      ) : null}
      {body ? <div className="mt-2 text-[12px] text-text-muted">{body}</div> : null}

      {kind === "approve" && draft ? (
        <div className="mt-3">
          <p className="text-[12px] text-text-muted">AI matched your tone</p>
          <textarea
            value={draftText || draft}
            onChange={(e) => setDraftText(e.target.value)}
            className="mt-2 w-full rounded-[8px] border border-border-card bg-bg-deep p-3 text-[12px] italic text-text-primary"
            rows={3}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={sendSms}
              disabled={loading}
              className="rounded-[8px] bg-accent-blue px-3 py-2 text-[13px] font-medium text-white"
            >
              Approve & send
            </button>
          </div>
        </div>
      ) : null}

      {kind === "hot" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={clientPhone ? `tel:${clientPhone}` : undefined}
            className="rounded-[8px] bg-accent-blue px-3 py-2 text-[13px] font-medium text-white"
          >
            Call now
          </a>
          <button
            type="button"
            onClick={draftAi}
            disabled={loading || !clientId}
            className="rounded-[8px] border border-border-card bg-bg-card px-3 py-2 text-[13px] font-medium text-accent-blue"
          >
            AI text
          </button>
          <button
            type="button"
            onClick={onSnooze}
            className="rounded-[8px] border border-border-card bg-bg-primary px-3 py-2 text-[13px] text-text-dim"
          >
            Snooze 1hr
          </button>
        </div>
      ) : null}

      {kind === "closing" ? (
        <a
          href="/transactions"
          className="mt-3 inline-block rounded-[8px] bg-accent-blue px-3 py-2 text-[13px] font-medium text-white"
        >
          View deal
        </a>
      ) : null}

      {sheetOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-[14px] border border-border-card bg-bg-card p-4">
            <div className="text-[14px] font-medium text-text-primary">Draft</div>
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              className="mt-2 w-full rounded-[8px] border border-border-card bg-bg-deep p-3 text-[13px] text-text-primary"
              rows={4}
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={sendSms}
                className="flex-1 rounded-[8px] bg-accent-blue py-2 text-[13px] font-medium text-white"
              >
                Approve & Send
              </button>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="rounded-[8px] border border-border-card bg-bg-primary px-3 py-2 text-[13px] text-text-dim"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
