"use client";

import { useToast } from "@/components/ToastProvider";
import { fmtDateTime } from "@/lib/utils";
import { smsUrl } from "@/lib/messaging-links";
import {
  Mail,
  Megaphone,
  MessageSquare,
  Mic,
  Phone,
  StickyNote,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const icons: Record<string, typeof Phone> = {
  call: Phone,
  text: MessageSquare,
  email: Mail,
  note: StickyNote,
  showing: Megaphone,
  offer: Megaphone,
  voice_memo: Mic,
  automation: Megaphone,
};

export function InboxActivityCard({
  id,
  type,
  body: initialBody,
  created_at,
  clientName,
  ai_draft,
  approved,
  sent,
  clientId,
  clientPhone,
  onRemove,
}: {
  id: string;
  type: string;
  body: string | null;
  created_at: string;
  clientName: string;
  ai_draft?: boolean;
  approved?: boolean;
  sent?: boolean;
  clientId: string;
  clientPhone?: string | null;
  onRemove?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const Icon = icons[type] ?? StickyNote;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(initialBody ?? "");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setDraft(initialBody ?? "");
  }, [initialBody]);

  function approveSend() {
    const text = draft.trim();
    if (!text) {
      toast.toast("Add message text first", "warn");
      return;
    }
    const phone = clientPhone ?? "";
    if (!phone) {
      toast.toast("Client has no phone on file", "warn");
      return;
    }
    setSending(true);
    void fetch("/api/activities/log-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activityId: ai_draft ? id : undefined,
        clientId,
        body: text,
        channel: "sms",
      }),
    });
    window.location.href = smsUrl(phone, text);
    setSending(false);
    setOpen(false);
    onRemove?.();
    router.refresh();
  }

  async function dismiss() {
    const res = await fetch(`/api/inbox/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.toast((data as { error?: string }).error ?? "Could not dismiss", "warn");
      return;
    }
    toast.toast("Dismissed", "success");
    setOpen(false);
    onRemove?.();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-[14px] border border-border-card bg-bg-card p-3 text-left transition hover:border-accent-blue/40"
      >
        <div className="flex gap-3">
          <Icon className="mt-0.5 shrink-0 text-accent-blue" size={18} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border-card bg-bg-deep px-2 py-0.5 text-[11px] text-text-secondary">
                {clientName}
              </span>
              <span className="text-[11px] text-text-dim">
                {fmtDateTime(created_at)}
              </span>
            </div>
            <p className="mt-2 line-clamp-3 text-[13px] text-text-secondary">
              {initialBody}
            </p>
            {sent ? (
              <p className="mt-2 text-[11px] font-medium text-accent-blue">
                Sent via Aria ✓
              </p>
            ) : null}
          </div>
        </div>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 z-0"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-[16px] border border-border-card border-b-0 bg-bg-card p-4 shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border-card" />
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[16px] font-medium text-text-primary">
                  {clientName}
                </div>
                <div className="text-[11px] text-text-dim">
                  {fmtDateTime(created_at)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-text-dim hover:bg-bg-deep"
                aria-label="Close sheet"
              >
                <X size={20} />
              </button>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              readOnly={!!sent || (!!approved && !ai_draft)}
              className="mt-4 min-h-[160px] w-full resize-y rounded-[12px] border border-border-card bg-bg-deep p-3 text-[14px] text-text-primary"
            />
            {ai_draft && !approved && !sent ? (
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void approveSend()}
                  className="w-full rounded-[8px] bg-accent-blue py-3 text-[14px] font-medium text-white disabled:opacity-60"
                >
                  {sending ? "Sending…" : "Approve & Send"}
                </button>
                <button
                  type="button"
                  onClick={() => void dismiss()}
                  className="w-full rounded-[8px] border border-border-card py-3 text-[14px] text-text-dim"
                >
                  Dismiss
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
