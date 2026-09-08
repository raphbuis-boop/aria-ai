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
} from "lucide-react";

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

export function ActivityItem({
  id,
  type,
  body,
  created_at,
  clientName,
  ai_draft,
  approved,
  sent,
  clientId,
  clientPhone,
  onApproved,
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
  onApproved?: () => void;
}) {
  const toast = useToast();
  const Icon = icons[type] ?? StickyNote;

  function approve() {
    if (!body) return;
    if (!clientPhone?.trim()) {
      toast.toast(`No phone on file for ${clientName}`, "warn");
      return;
    }
    void fetch("/api/activities/log-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityId: id, clientId, body, channel: "sms" }),
    });
    window.location.href = smsUrl(clientPhone, body);
    onApproved?.();
  }

  return (
    <div className="rounded-[14px] border border-border-card bg-bg-card p-3">
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
            {body}
          </p>
          {sent ? (
            <p className="mt-2 text-[11px] font-medium text-accent-blue">
              Sent via Aria ✓
            </p>
          ) : null}
          {ai_draft && !approved ? (
            <button
              type="button"
              onClick={approve}
              className="mt-2 rounded-[8px] bg-accent-blue px-3 py-1.5 text-[12px] font-medium text-white"
            >
              Approve
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
