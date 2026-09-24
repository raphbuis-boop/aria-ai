"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Pause, Play, Send, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { Pill } from "@/components/Section";
import { cn } from "@/lib/utils";
import { twilioErrorHint } from "@/lib/twilio-errors";

export type AriaThreadState = {
  phone: string | null;
  paused: boolean;
  optedOut: boolean;
  started: boolean;
};

export type TextMessage = {
  id: string;
  direction: string | null;
  body: string | null;
  sent: boolean;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

const VISIBLE = 40;

function stamp(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function senderOf(m: TextMessage): "client" | "aria" | "agent" {
  if (m.direction === "inbound") return "client";
  // Twilio sends are Aria's unless the agent typed them; anything else was
  // logged after the agent texted from their own phone.
  if (m.metadata?.kind === "agent_reply") return "agent";
  return m.metadata?.channel === "twilio" ? "aria" : "agent";
}

function Bubble({ m, firstName }: { m: TextMessage; firstName: string }) {
  const who = senderOf(m);
  const mine = who !== "client";
  const deliveryFailed = m.metadata?.delivery_status === "failed" || m.metadata?.delivery_status === "undelivered";
  const failed = mine && (!m.sent || deliveryFailed);
  const deliveryCode = m.metadata?.delivery_error ? String(m.metadata.delivery_error) : null;
  const error =
    typeof m.metadata?.send_error === "string"
      ? (m.metadata.send_error as string)
      : deliveryFailed
        ? `Carrier didn't deliver${deliveryCode ? ` (Twilio ${deliveryCode}${twilioErrorHint(deliveryCode) ? `: ${twilioErrorHint(deliveryCode)}` : ""})` : ""}`
        : null;
  return (
    <div className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 font-display text-body",
          mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-secondary text-foreground",
          failed && "bg-hot/10 text-foreground ring-1 ring-hot/30",
        )}
      >
        {m.body}
      </div>
      {failed && error ? (
        <p className="mt-1 max-w-[85%] px-1 text-right font-display text-[11px] text-hot">{error}</p>
      ) : null}
      <p className="mt-1 flex items-center gap-1 px-1 font-display text-[11px] text-muted-foreground">
        {failed ? (
          <span className="flex items-center gap-1 text-hot">
            <AlertCircle className="size-3" /> Not delivered ·
          </span>
        ) : null}
        {who === "client" ? firstName : who === "aria" ? "Aria" : "You"} · {stamp(m.created_at)}
      </p>
    </div>
  );
}

/** The client's SMS thread (Aria's Twilio number): bubbles, Aria on/off, and
 * a composer that sends from the same number via /api/clients/[id]/aria. */
export function MessagesThread({
  clientId,
  firstName,
  state,
  messages,
}: {
  clientId: string;
  firstName: string;
  state: AriaThreadState;
  messages: TextMessage[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [showAll, setShowAll] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const shown = showAll ? messages : messages.slice(-VISIBLE);

  useEffect(() => {
    if (window.location.hash === "#messages") endRef.current?.scrollIntoView({ block: "end" });
  }, []);

  async function call(action: "start" | "pause" | "resume" | "send") {
    setBusy(action);
    try {
      const res = await fetch(`/api/clients/${clientId}/aria`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "send" ? { action, body: text } : { action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? json.firstText?.error ?? "Request failed");
      if (action === "send") setText("");
      toast.success(
        { start: "Aria sent the first text", pause: "Aria paused — you're handling replies", resume: "Aria is back on", send: "Sent" }[action],
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const canText = Boolean(state.phone) && !state.optedOut;
  const status = !state.phone
    ? "No phone number on file — add one to text this client."
    : state.optedOut
      ? `${firstName} replied STOP. Texts are blocked.`
      : !state.started
        ? "Aria hasn't texted this client yet."
        : state.paused
          ? "Aria is paused. You're handling replies; incoming texts still land here."
          : `Aria is answering ${firstName}'s texts. Pause to take over.`;

  return (
    <section id="messages" className="mb-10 scroll-mt-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-section uppercase text-muted-foreground">Messages</h2>
        {canText && state.started ? (
          state.paused ? (
            <Button size="sm" onClick={() => call("resume")} disabled={busy !== null} className="h-8 rounded-full px-3">
              <Play className="size-3.5" /> Resume Aria
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => call("pause")} disabled={busy !== null} className="h-8 rounded-full px-3">
              <Pause className="size-3.5" /> Pause Aria
            </Button>
          )
        ) : null}
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-start gap-2.5 border-b border-border px-5 py-3">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <p className="flex-1 font-display text-caption text-muted-foreground">{status}</p>
          {state.started && canText ? (
            <Pill tone={state.paused ? "neutral" : "primary"}>{state.paused ? "Paused" : "Active"}</Pill>
          ) : null}
        </div>

        <div className="space-y-3 px-4 py-4">
          {messages.length > shown.length ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="w-full text-center font-display text-caption font-semibold text-primary"
            >
              Show {messages.length - shown.length} earlier
            </button>
          ) : null}
          {shown.length === 0 ? (
            <p className="py-6 text-center font-display text-body text-muted-foreground">No texts yet.</p>
          ) : (
            shown.map((m) => <Bubble key={m.id} m={m} firstName={firstName} />)
          )}
          <div ref={endRef} />
        </div>

        {canText ? (
          !state.started ? (
            <div className="border-t border-border px-5 py-4">
              <Button onClick={() => call("start")} disabled={busy !== null} className="w-full rounded-xl">
                {busy === "start" ? "Texting…" : `Have Aria text ${firstName}`}
              </Button>
            </div>
          ) : (
            <form
              className="flex items-end gap-2 border-t border-border px-3 py-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim() && busy === null) void call("send");
              }}
            >
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim() && busy === null) void call("send");
                }}
                rows={1}
                maxLength={1000}
                aria-label={`Text ${firstName}`}
                placeholder={`Text ${firstName}…`}
                className="max-h-40 min-h-[44px] flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 font-display text-body text-foreground outline-none [field-sizing:content]"
              />
              <Button
                type="submit"
                size="icon"
                disabled={busy !== null || !text.trim()}
                aria-label="Send"
                className="size-11 shrink-0 rounded-full"
              >
                <Send className="size-4" />
              </Button>
            </form>
          )
        ) : null}
      </Card>
    </section>
  );
}
