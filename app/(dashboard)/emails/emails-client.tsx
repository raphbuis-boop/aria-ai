"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Card } from "@/components/ui/card";

type Email = {
  id: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  date: string;
  snippet: string;
  unread: boolean;
  client: { id: string; name: string } | null;
};

function timeAgo(date: string): string {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: false })
      .replace("about ", "")
      .replace(" minutes", "m")
      .replace(" minute", "m")
      .replace(" hours", "h")
      .replace(" hour", "h")
      .replace(" days", "d")
      .replace(" day", "d");
  } catch {
    return "";
  }
}

export function EmailsClient() {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "disconnected" | "ready">("loading");
  const [emails, setEmails] = useState<Email[]>([]);

  async function load() {
    setState("loading");
    try {
      const res = await fetch("/api/gmail/inbox", { cache: "no-store" });
      const data = (await res.json()) as { connected?: boolean; messages?: Email[] };
      if (!data.connected) {
        setState("disconnected");
        return;
      }
      setEmails(data.messages ?? []);
      setState("ready");
    } catch {
      setState("disconnected");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const clientCount = emails.filter((e) => e.client).length;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-5 pt-6 pb-32 sm:px-8 sm:pt-10">
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back"
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Refresh"
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary transition-colors"
          >
            <RefreshCw className={`size-4 ${state === "loading" ? "animate-spin" : ""}`} />
          </button>
        </div>

        <header className="mb-6">
          <h1 className="font-heading text-[32px] leading-tight text-foreground">Inbox</h1>
          {state === "ready" && (
            <p className="font-display text-body-lg text-muted-foreground mt-1">
              {emails.length} recent
              {clientCount > 0 ? (
                <>
                  {" · "}
                  <span className="text-primary font-semibold">{clientCount} from clients</span>
                </>
              ) : null}
            </p>
          )}
        </header>

        {state === "loading" && (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-secondary/70 animate-pulse" />
            ))}
          </div>
        )}

        {state === "disconnected" && (
          <div className="flex flex-col items-center text-center rounded-2xl border border-dashed border-border px-6 py-16">
            <Mail className="size-8 text-primary mb-4" />
            <p className="font-heading text-[19px] text-foreground mb-1">Connect your email</p>
            <p className="font-display text-body text-muted-foreground/80 mb-5">
              Link Gmail and every email — and every new lead — shows up here, with a reply drafted.
            </p>
            <a
              href="/api/auth/google/connect"
              className="rounded-full bg-primary px-5 py-2.5 font-display text-body font-semibold text-primary-foreground active:scale-95 transition-transform"
            >
              Connect Gmail
            </a>
          </div>
        )}

        {state === "ready" && emails.length === 0 && (
          <div className="flex flex-col items-center text-center rounded-2xl border border-dashed border-border px-6 py-16">
            <Mail className="size-8 text-primary mb-4" />
            <p className="font-heading text-[19px] text-foreground mb-1">Inbox is clear</p>
            <p className="font-display text-body text-muted-foreground/70">Nothing new right now.</p>
          </div>
        )}

        {state === "ready" && emails.length > 0 && (
          <Card className="divide-y divide-border overflow-hidden">
            {emails.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => {
                  if (e.client) router.push(`/clients/${e.client.id}`);
                }}
                className="w-full text-left px-5 py-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {e.unread && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                  <p className={`min-w-0 flex-1 truncate font-display text-body-lg ${e.unread ? "font-semibold text-foreground" : "text-foreground"}`}>
                    {e.senderName}
                  </p>
                  {e.client && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-display text-[11px] font-semibold text-primary">
                      Client
                    </span>
                  )}
                  <span className="shrink-0 font-display text-caption text-muted-foreground/60">{timeAgo(e.date)}</span>
                </div>
                <p className="mt-0.5 truncate font-display text-body text-foreground/90">{e.subject}</p>
                <p className="mt-0.5 truncate font-display text-caption text-muted-foreground">{e.snippet}</p>
              </button>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
