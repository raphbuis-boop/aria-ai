"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronUp, Mail, RefreshCw, Send, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toaster, toast } from "@/components/ui/sonner";
import { Avatar, EmptyNote, Pill, Section } from "@/components/Section";
import { relTime } from "@/lib/utils";
import { Skeleton, SkeletonRegion, SkeletonRows } from "@/components/Skeleton";

type Urgency = "high" | "medium" | "low";
type Row = {
  threadId: string;
  subject: string;
  snippet: string;
  date: string;
  from: { name: string; email: string };
  unread: boolean;
  messageCount: number;
  client: { id: string; name: string } | null;
  needsReply: boolean;
  lowReason: string | null;
  ai: { summary: string; why: string; urgency: Urgency; needs_reply: boolean } | null;
};
type Inbox = { connected: boolean; email?: string; threads: Row[]; error?: string };
type Msg = { id: string; from: { name: string; email: string }; date: string; subject: string; body: string; fromMe: boolean };
type Thread = {
  threadId: string;
  messages: Msg[];
  replyTo: { name: string; email: string } | null;
  client: { id: string; name: string } | null;
};
type Assist = { summary: string; why: string; urgency: Urgency; reply: string };

const URGENCY: Record<Urgency, { label: string; tone: "hot" | "warm" | "neutral" }> = {
  high: { label: "Urgent", tone: "hot" },
  medium: { label: "This week", tone: "warm" },
  low: { label: "FYI", tone: "neutral" },
};

function ThreadRow({ t, onOpen }: { t: Row; onOpen: (t: Row) => void }) {
  return (
    <button type="button" onClick={() => onOpen(t)} className="flex w-full items-start gap-3.5 px-5 py-4 text-left hover:bg-secondary/50">
      <Avatar name={t.client?.name ?? t.from.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className={`truncate font-display text-body ${t.unread ? "font-semibold text-foreground" : "text-foreground"}`}>
            {t.client?.name ?? t.from.name}
            {t.messageCount > 1 ? <span className="ml-1 text-muted-foreground">({t.messageCount})</span> : null}
          </p>
          <span className="shrink-0 font-display text-caption text-muted-foreground">{relTime(t.date)}</span>
        </div>
        <p className="truncate font-display text-caption font-medium text-foreground">{t.subject}</p>
        <p className="mt-0.5 line-clamp-2 font-display text-caption text-muted-foreground">{t.ai?.summary ?? t.snippet}</p>
        {t.client || t.ai || t.needsReply ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {t.client ? <Pill tone="primary">Client</Pill> : null}
            {t.ai ? <Pill tone={URGENCY[t.ai.urgency].tone}>{URGENCY[t.ai.urgency].label}</Pill> : null}
            {(t.ai?.needs_reply ?? t.needsReply) ? <Pill>Needs reply</Pill> : null}
            {t.ai?.why ? <span className="font-display text-[11px] text-muted-foreground">{t.ai.why}</span> : null}
          </div>
        ) : null}
      </div>
    </button>
  );
}

function ThreadView({ row, onClose, onSent }: { row: Row; onClose: () => void; onSent: () => void }) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [assist, setAssist] = useState<Assist | null>(null);
  const [assistError, setAssistError] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const draft = useCallback(async () => {
    setDrafting(true);
    setAssistError(null);
    try {
      const res = await fetch(`/api/gmail/thread/${row.threadId}/assist`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't draft a reply");
      setAssist(json);
      setReply(json.reply);
    } catch (e) {
      setAssistError(e instanceof Error ? e.message : "Couldn't draft a reply");
    } finally {
      setDrafting(false);
    }
  }, [row.threadId]);

  useEffect(() => {
    void fetch(`/api/gmail/thread/${row.threadId}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error);
        setThread(json);
      })
      .catch(() => toast.error("Couldn't load this email"));
    // Newsletters and notifications don't get an automatic AI draft.
    if (!row.lowReason) void draft();
  }, [row.threadId, row.lowReason, draft]);

  async function send() {
    if (!thread?.replyTo) return;
    setSending(true);
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: thread.replyTo.email,
          subject: row.subject,
          body: reply,
          threadId: thread.threadId,
          clientId: thread.client?.id ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Send failed");
      toast.success(`Sent to ${thread.replyTo.name}`);
      onSent();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  const msgs = thread?.messages ?? [];
  const shown = showAll ? msgs : msgs.slice(-3);

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-background" role="dialog" aria-modal="true" aria-label={row.subject}>
      <div className="mx-auto max-w-2xl px-5 pb-16 pt-6 sm:px-8">
        <div className="mb-4 flex items-center justify-between">
          <button type="button" onClick={onClose} aria-label="Back" className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary">
            <ArrowLeft className="size-4" />
          </button>
          {thread?.client ? (
            <Link href={`/clients/${thread.client.id}`} className="font-display text-caption font-semibold text-primary">
              {thread.client.name} →
            </Link>
          ) : null}
        </div>
        <h1 className="mb-5 font-heading text-[24px] leading-tight text-foreground">{row.subject}</h1>

        <Card className="mb-6 px-5 py-4">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="size-3.5 text-primary" />
            <p className="font-display text-caption font-semibold uppercase tracking-[0.06em] text-primary">Aria</p>
            {assist ? <Pill tone={URGENCY[assist.urgency].tone}>{URGENCY[assist.urgency].label}</Pill> : null}
          </div>
          {assist ? (
            <>
              <p className="font-display text-body text-foreground">{assist.summary}</p>
              <p className="mt-1 font-display text-caption text-muted-foreground">Why it matters: {assist.why}</p>
            </>
          ) : drafting ? (
            <SkeletonRegion label="Reading the thread…" className="space-y-2 pt-1">
              <Skeleton className="h-3.5 w-11/12" />
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </SkeletonRegion>
          ) : assistError ? (
            <p className="font-display text-body text-muted-foreground">{assistError}</p>
          ) : (
            <button type="button" onClick={() => void draft()} className="font-display text-body font-semibold text-primary">
              Summarize and draft a reply
            </button>
          )}
        </Card>

        <section className="mb-6 space-y-3">
          {msgs.length > shown.length ? (
            <button type="button" onClick={() => setShowAll(true)} className="font-display text-caption font-semibold text-primary">
              Show {msgs.length - shown.length} earlier message{msgs.length - shown.length === 1 ? "" : "s"}
            </button>
          ) : null}
          {thread === null ? (
            <p className="font-display text-body text-muted-foreground">Loading email…</p>
          ) : (
            shown.map((m) => (
              <Card key={m.id} className={`px-5 py-4 ${m.fromMe ? "bg-secondary/60" : ""}`}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="truncate font-display text-caption font-semibold text-foreground">{m.fromMe ? "You" : m.from.name}</p>
                  <span className="shrink-0 font-display text-caption text-muted-foreground">{relTime(m.date)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words font-display text-body text-foreground/90">{m.body || "(no text)"}</p>
              </Card>
            ))
          )}
        </section>

        {thread?.replyTo ? (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-display text-section uppercase text-muted-foreground">Reply to {thread.replyTo.name}</p>
              <button
                type="button"
                onClick={() => void draft()}
                disabled={drafting}
                className="flex items-center gap-1 font-display text-caption font-semibold text-primary disabled:opacity-50"
              >
                <RefreshCw className={`size-3 ${drafting ? "animate-spin" : ""}`} /> {drafting ? "Drafting…" : "Redraft"}
              </button>
            </div>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={8}
              aria-label="Reply"
              placeholder={drafting ? "Aria is drafting a reply…" : "Write your reply…"}
              className="w-full resize-y rounded-2xl border border-input bg-card p-4 font-display text-body text-foreground outline-none focus:border-ring"
            />
            <p className="mt-1 font-display text-caption text-muted-foreground">Sends from your Gmail, in this thread.</p>
            <Button onClick={() => void send()} disabled={sending || !reply.trim()} className="mt-3 h-12 w-full rounded-xl text-body-lg font-semibold">
              <Send className="size-4" /> {sending ? "Sending…" : "Send reply"}
            </Button>
          </section>
        ) : null}
      </div>
    </div>
  );
}

export function EmailsClient() {
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Row | null>(null);
  const [showLow, setShowLow] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gmail/inbox", { cache: "no-store" });
      setInbox(await res.json());
    } catch {
      setInbox({ connected: true, threads: [], error: "fetch_failed" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const p = new URLSearchParams(window.location.search);
    if (p.get("gmail") === "connected") toast.success("Google account connected");
    if (p.get("gmail") === "error") toast.error("Google connection failed — try again");
    if (p.get("gmail")) window.history.replaceState({}, "", "/emails");
  }, [load]);

  function connect() {
    document.cookie = "aria_return_to=inbox; path=/; max-age=600; SameSite=Lax";
    window.location.href = "/api/auth/google/connect";
  }

  const threads = inbox?.threads ?? [];
  const clients = threads.filter((t) => t.client && !t.lowReason);
  const needsReply = threads.filter((t) => !t.client && !t.lowReason && t.needsReply);
  const other = threads.filter((t) => !t.client && !t.lowReason && !t.needsReply);
  const low = threads.filter((t) => t.lowReason);

  return (
    <div className="min-h-[100dvh] bg-background pb-32 text-foreground">
      <div className="mx-auto max-w-2xl px-5 pt-10 sm:px-8">
        <header className="mb-6 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-[34px] leading-tight">Inbox</h1>
            <p className="mt-1 truncate font-display text-caption text-muted-foreground">
              {inbox?.connected && inbox.email ? inbox.email : "Your Gmail, sorted by what needs you"}
            </p>
          </div>
          {inbox?.connected ? (
            <Button variant="outline" onClick={() => void load()} disabled={loading} className="h-9 shrink-0 rounded-full px-3">
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          ) : null}
        </header>

        {inbox === null ? (
          <SkeletonRegion label="Loading your inbox…">
            <SkeletonRows count={6} />
          </SkeletonRegion>
        ) : !inbox.connected ? (
          <Card className="px-6 py-8 text-center">
            <Mail className="mx-auto mb-3 size-6 text-primary" />
            <p className="font-heading text-[20px] text-foreground">Connect your Gmail</p>
            <p className="mx-auto mt-1 max-w-sm font-display text-body text-muted-foreground">
              Aria puts client emails first, flags what needs a reply, summarizes each thread and drafts replies you can send from your own address.
            </p>
            <Button onClick={connect} className="mt-5 rounded-full px-5">
              Connect Google
            </Button>
          </Card>
        ) : inbox.error ? (
          <EmptyNote>Couldn&apos;t reach Gmail. Try Refresh, or reconnect Google in Settings.</EmptyNote>
        ) : threads.length === 0 ? (
          <EmptyNote>No email in the last 30 days.</EmptyNote>
        ) : (
          <>
            {clients.length ? (
              <Section label="Clients" count={clients.filter((t) => t.needsReply).length || undefined}>
                <Card className="divide-y divide-border overflow-hidden">
                  {clients.map((t) => (
                    <ThreadRow key={t.threadId} t={t} onOpen={setOpen} />
                  ))}
                </Card>
              </Section>
            ) : null}
            {needsReply.length ? (
              <Section label="Needs a reply">
                <Card className="divide-y divide-border overflow-hidden">
                  {needsReply.map((t) => (
                    <ThreadRow key={t.threadId} t={t} onOpen={setOpen} />
                  ))}
                </Card>
              </Section>
            ) : null}
            {other.length ? (
              <Section label="Other">
                <Card className="divide-y divide-border overflow-hidden">
                  {other.map((t) => (
                    <ThreadRow key={t.threadId} t={t} onOpen={setOpen} />
                  ))}
                </Card>
              </Section>
            ) : null}
            {low.length ? (
              <section className="mb-10">
                <button
                  type="button"
                  onClick={() => setShowLow((v) => !v)}
                  className="mb-3 flex w-full items-center justify-between font-display text-section uppercase text-muted-foreground"
                >
                  Newsletters &amp; notifications · {low.length}
                  {showLow ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>
                {showLow ? (
                  <Card className="divide-y divide-border overflow-hidden opacity-80">
                    {low.map((t) => (
                      <button key={t.threadId} type="button" onClick={() => setOpen(t)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-secondary/50">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-caption font-semibold text-foreground">{t.from.name}</p>
                          <p className="truncate font-display text-caption text-muted-foreground">{t.subject}</p>
                        </div>
                        <Pill>{t.lowReason}</Pill>
                      </button>
                    ))}
                  </Card>
                ) : null}
              </section>
            ) : null}
          </>
        )}
      </div>

      {open ? (
        <ThreadView
          row={open}
          onClose={() => setOpen(null)}
          onSent={() => {
            setOpen(null);
            void load();
          }}
        />
      ) : null}
      <Toaster />
    </div>
  );
}
