"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MEDIA_LABELS } from "@/lib/whatsapp/thread";

export type WhatsAppBubble = {
  id: string;
  direction: string | null;
  body: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

const VISIBLE = 30;

function stamp(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * The agent's WhatsApp chat with this client, as Aria received it from her
 * WhatsApp Business app (coexistence). Read-only: she replies from her phone;
 * "Reply" drafts an answer from this thread and opens WhatsApp with it.
 */
export function WhatsAppThread({
  firstName,
  messages,
  onReply,
}: {
  firstName: string;
  messages: WhatsAppBubble[];
  onReply: (() => void) | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? messages : messages.slice(-VISIBLE);
  const waiting = messages.at(-1)?.direction === "inbound";

  return (
    <section id="whatsapp" className="mb-10 scroll-mt-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 font-display text-section uppercase text-muted-foreground">
          <MessageCircle className="size-3.5" /> WhatsApp
        </h2>
        {onReply ? (
          <Button size="sm" onClick={onReply} className="h-8 rounded-full px-3" variant={waiting ? "default" : "outline"}>
            {waiting ? `Reply to ${firstName}` : `Message ${firstName}`}
          </Button>
        ) : null}
      </div>
      <Card className="overflow-hidden">
        <p className="border-b border-border px-5 py-3 font-display text-caption text-muted-foreground">
          From your WhatsApp Business app. Aria reads this chat; you send from your phone.
        </p>
        <div className="space-y-3 px-4 py-4">
          {messages.length > shown.length ? (
            <button type="button" onClick={() => setShowAll(true)} className="w-full text-center font-display text-caption font-semibold text-primary">
              Show {messages.length - shown.length} earlier
            </button>
          ) : null}
          {shown.map((m) => {
            const mine = m.direction !== "inbound";
            const media = typeof m.metadata?.media_type === "string" ? (m.metadata.media_type as string) : null;
            const label = media ? `[${MEDIA_LABELS[media] ?? "Attachment"}]` : null;
            return (
              <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 font-display text-body",
                    mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-secondary text-foreground",
                  )}
                >
                  {label && m.body ? <span className="mb-0.5 block text-caption opacity-80">{label}</span> : null}
                  {m.body || label}
                </div>
                <p className="mt-1 px-1 font-display text-[11px] text-muted-foreground">
                  {mine ? "You" : firstName} · {stamp(m.created_at)}
                </p>
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
