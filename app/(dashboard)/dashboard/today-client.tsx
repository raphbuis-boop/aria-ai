"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, CalendarDays, ChevronRight, Sparkles, Upload, UserPlus } from "lucide-react";
import type { TodayItem } from "@/lib/today-items";
import { DraftSheet } from "@/components/DraftSheet";
import { NotificationBell } from "@/components/NotificationPanel";
import { Avatar, EmptyNote, Pill, Section } from "@/components/Section";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toaster, toast } from "@/components/ui/sonner";
import { humanizeSource, relTime } from "@/lib/utils";
import { AriaApprovals, type AriaTaskRow } from "@/components/aria/AriaApprovals";
import type { ShowingRequestRow } from "@/components/aria/ShowingApprovalCard";

export type NewLeadRow = {
  id: string;
  name: string;
  source: string | null;
  town: string | null;
  createdAt: string;
  ariaTexted: boolean;
  ariaPaused: boolean;
};
export type ConversationRow = {
  clientId: string;
  clientName: string;
  body: string;
  inbound: boolean;
  byAria: boolean;
  failed: boolean;
  at: string;
  ariaActive: boolean;
};
export type ShowingRow = {
  id: string;
  address: string | null;
  showingDate: string | null;
  client: { id: string; name: string } | null;
};
export type TaskDueRow = { id: string; clientId: string | null; clientName: string | null; title: string; dueAt: string | null };

type Props = {
  firstName: string;
  agentInitials: string;
  hasAnyClients: boolean;
  newLeads: NewLeadRow[];
  conversations: ConversationRow[];
  ariaShowingRequests: ShowingRequestRow[];
  ariaTasks: AriaTaskRow[];
  showingsToday: ShowingRow[];
  tasksDue: TaskDueRow[];
  followUps: TodayItem[];
};

const FOLLOW_UP_CAP = 4;

function greetingFor(h: number): string {
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function timeOf(iso: string | null): string {
  if (!iso) return "Time TBD";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function Header({ firstName, agentInitials }: { firstName: string; agentInitials: string }) {
  // Client-only: server time zone ≠ the agent's.
  const [greeting, setGreeting] = useState("Hello");
  const [dateLabel, setDateLabel] = useState(" ");
  useEffect(() => {
    const d = new Date();
    setGreeting(greetingFor(d.getHours()));
    setDateLabel(d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }));
  }, []);

  return (
    <header className="mb-8 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="mb-2 font-display text-caption uppercase tracking-[0.08em] text-muted-foreground">{dateLabel}</p>
        <h1 className="font-heading text-[32px] leading-tight text-foreground">
          {greeting}, {firstName}.
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <NotificationBell />
        <Link
          href="/settings"
          aria-label="Settings"
          className="flex size-11 items-center justify-center rounded-full bg-primary font-display text-body font-semibold text-primary-foreground"
        >
          {agentInitials}
        </Link>
      </div>
    </header>
  );
}

function NewLeads({ leads }: { leads: NewLeadRow[] }) {
  if (!leads.length) return null;
  return (
    <Section label="New leads" count={leads.length} action={{ href: "/clients", label: "All clients →" }}>
      <Card className="divide-y divide-border overflow-hidden">
        {leads.map((l) => (
          <Link key={l.id} href={`/clients/${l.id}`} className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-secondary/50">
            <Avatar name={l.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-body-lg font-semibold text-foreground">{l.name}</p>
              <p className="truncate font-display text-caption text-muted-foreground">
                {[humanizeSource(l.source), l.town, relTime(l.createdAt)].filter(Boolean).join(" · ")}
              </p>
            </div>
            {l.ariaTexted ? (
              <Pill tone={l.ariaPaused ? "neutral" : "primary"}>
                <Sparkles className="size-3" /> {l.ariaPaused ? "Paused" : "Aria texting"}
              </Pill>
            ) : (
              <Pill tone="warm">Not texted</Pill>
            )}
          </Link>
        ))}
      </Card>
    </Section>
  );
}

function Conversations({ rows }: { rows: ConversationRow[] }) {
  return (
    <Section label="Recent conversations" action={{ href: "/inbox", label: "Follow-ups →" }}>
      {rows.length === 0 ? (
        <EmptyNote>No texts in the last 7 days. Conversations with leads show up here.</EmptyNote>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {rows.map((c) => (
            <Link key={c.clientId} href={`/clients/${c.clientId}#messages`} className="flex items-start gap-3.5 px-5 py-3.5 hover:bg-secondary/50">
              <Avatar name={c.clientName} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-display text-body font-semibold text-foreground">{c.clientName}</p>
                  <span className="shrink-0 font-display text-caption text-muted-foreground">{relTime(c.at)}</span>
                </div>
                <p className={`mt-0.5 line-clamp-2 font-display text-body ${c.inbound ? "text-foreground" : "text-muted-foreground"}`}>
                  {c.inbound ? "" : c.byAria ? "Aria: " : "You: "}
                  {c.body}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {c.inbound ? <Pill tone="primary">Replied</Pill> : null}
                  {c.failed ? (
                    <Pill tone="hot">
                      <AlertCircle className="size-3" /> Not delivered
                    </Pill>
                  ) : null}
                  {!c.ariaActive ? <Pill>Aria paused</Pill> : null}
                </div>
              </div>
            </Link>
          ))}
        </Card>
      )}
    </Section>
  );
}

function ShowingsToday({ rows }: { rows: ShowingRow[] }) {
  return (
    <Section label="Today's showings" action={{ href: "/showings", label: "Schedule →" }}>
      {rows.length === 0 ? (
        <EmptyNote>No showings booked for today.</EmptyNote>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {rows.map((s) => (
            <Link
              key={s.id}
              href={s.client ? `/clients/${s.client.id}` : "/showings"}
              className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-secondary/50"
            >
              <span className="w-16 shrink-0 font-display text-body font-semibold text-primary">{timeOf(s.showingDate)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-body font-semibold text-foreground">{s.address ?? "Address TBD"}</p>
                <p className="truncate font-display text-caption text-muted-foreground">{s.client?.name ?? "No client linked"}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
            </Link>
          ))}
        </Card>
      )}
    </Section>
  );
}

function FollowUps({
  items,
  tasks,
  onAct,
  onSkip,
}: {
  items: TodayItem[];
  tasks: TaskDueRow[];
  onAct: (item: TodayItem) => void;
  onSkip: (item: TodayItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, FOLLOW_UP_CAP);
  const hidden = items.length - shown.length;

  return (
    <Section label="Follow-ups" action={{ href: "/inbox", label: "All →" }}>
      {items.length === 0 && tasks.length === 0 ? (
        <EmptyNote>Nobody is overdue for a follow-up.</EmptyNote>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {tasks.map((t) => (
            <Link
              key={t.id}
              href={t.clientId ? `/clients/${t.clientId}` : "/clients"}
              className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-secondary/50"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                <CalendarDays className="size-3.5 text-muted-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-body font-semibold text-foreground">{t.title}</p>
                <p className="truncate font-display text-caption text-muted-foreground">
                  {[t.clientName, t.dueAt ? `Due ${relTime(t.dueAt)}` : null].filter(Boolean).join(" · ")}
                </p>
              </div>
            </Link>
          ))}
          {shown.map((item) => (
            <div key={item.id} className="flex items-center gap-3.5 px-5 py-3.5">
              <span
                className={`size-2.5 shrink-0 rounded-full ${item.leadHeat === "hot" ? "bg-hot" : item.leadHeat === "warm" ? "bg-warm" : "bg-border"}`}
                aria-hidden
              />
              <Link href={`/clients/${item.clientId}`} className="min-w-0 flex-1">
                <p className="truncate font-display text-body font-semibold text-foreground">{item.clientName}</p>
                <p className="truncate font-display text-caption text-muted-foreground">{item.reason}</p>
              </Link>
              <button
                type="button"
                onClick={() => onSkip(item)}
                className="hidden font-display text-caption text-muted-foreground sm:block"
              >
                Skip
              </button>
              <Button size="sm" onClick={() => onAct(item)} className="h-9 shrink-0 rounded-full px-4 text-caption font-semibold">
                {item.actionLabel}
              </Button>
            </div>
          ))}
          {hidden > 0 || expanded ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="w-full py-3 text-center font-display text-caption font-semibold text-muted-foreground hover:bg-secondary/50"
            >
              {expanded ? "Show less" : `Show ${hidden} more`}
            </button>
          ) : null}
        </Card>
      )}
    </Section>
  );
}

const SETUP_STEPS = [
  { Icon: UserPlus, title: "Add your first client", desc: "Aria texts new leads and keeps the thread going.", href: "/clients?new=1" },
  { Icon: Upload, title: "Import clients", desc: "Upload a CSV from your old CRM.", href: "/settings/import" },
] as const;

function EmptyState() {
  return (
    <Section label="Get started">
      <div className="flex flex-col gap-3">
        {SETUP_STEPS.map(({ Icon, title, desc, href }) => (
          <Link key={title} href={href}>
            <Card className="flex items-center gap-4 p-5 hover:border-input">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="size-4 text-primary" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-title text-foreground">{title}</p>
                <p className="mt-0.5 font-display text-body text-muted-foreground">{desc}</p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </Card>
          </Link>
        ))}
      </div>
    </Section>
  );
}

export function TodayClient(props: Props) {
  const router = useRouter();
  const [activeDraftItem, setActiveDraftItem] = useState<TodayItem | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const followUps = props.followUps.filter((i) => !skipped.has(i.id));

  const handleAct = useCallback(
    (item: TodayItem) => {
      if (item.actionType === "navigate" && item.navigateTo) router.push(item.navigateTo);
      else setActiveDraftItem(item);
    },
    [router],
  );

  const handleSkip = useCallback((item: TodayItem) => {
    setSkipped((prev) => new Set(prev).add(item.id));
    toast(`Skipped ${item.clientName.split(" ")[0]} for today`);
    void fetch("/api/opportunities/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id, hours: 24 }),
    });
  }, []);

  const handleSent = useCallback((itemId: string) => {
    setActiveDraftItem(null);
    setSkipped((prev) => new Set(prev).add(itemId));
    toast.success("Message sent");
  }, []);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-5 pb-32 pt-10 sm:px-8 sm:pt-14">
        <Header firstName={props.firstName} agentInitials={props.agentInitials} />

        <AriaApprovals showingRequests={props.ariaShowingRequests} tasks={props.ariaTasks} />

        {props.hasAnyClients ? (
          <>
            <NewLeads leads={props.newLeads} />
            <Conversations rows={props.conversations} />
            <ShowingsToday rows={props.showingsToday} />
            <FollowUps items={followUps} tasks={props.tasksDue} onAct={handleAct} onSkip={handleSkip} />
          </>
        ) : (
          <EmptyState />
        )}
      </div>

      <DraftSheet item={activeDraftItem} onClose={() => setActiveDraftItem(null)} onSent={handleSent} />
      <Toaster />
    </div>
  );
}
