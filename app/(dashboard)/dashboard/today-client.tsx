"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import {
  ArrowRight,
  FileText,
  ChevronDown,
  ChevronUp,
  Home as HomeIcon,
  Mail,
  MessageSquare,
  Phone,
  Sparkles,
  Upload,
  UserPlus,
} from "lucide-react";
import type { TodayItem } from "@/lib/today-items";
import { DraftSheet } from "@/components/DraftSheet";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toaster, toast } from "@/components/ui/sonner";
import { fmtMoney, relTime } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────

type ShowingRow = {
  id: string;
  address: string | null;
  showing_date: string | null;
  status: string | null;
  clients: { name: string } | null;
};
type TaskDueRow = { id: string; clientId: string | null; clientName: string | null; title: string; dueAt: string | null };
type DealMovingRow = { id: string; clientId: string; clientName: string; address: string | null; closingDate: string | null };
type Insight = { count: number; commissionEst: number };
type ActivityFeedRow = { id: string; clientName: string; verb: string; createdAt: string };
type Briefing = { showingsToday: number; closingsThisWeek: number; newMatches: number };
type KPI = { activeClients: number; warmLeads: number; pipelineCount: number; pendingDeals: number };

type Props = {
  items: TodayItem[];
  briefing: Briefing;
  showingsToday: ShowingRow[];
  tasksDue: TaskDueRow[];
  dealsMoving: DealMovingRow[];
  insight: Insight;
  activityFeed: ActivityFeedRow[];
  userName: string;
  agentInitials: string;
  hasAnyClients: boolean;
  kpi: KPI;
};

// ── Helpers ───────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getDateLabel(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function firstNameOf(name: string): string {
  return name.split(" ")[0];
}

function triggerHaptic() {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
  } catch {
    /* never break */
  }
}

async function dismissItem(itemId: string): Promise<void> {
  await fetch("/api/opportunities/dismiss", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId, hours: 24 }),
  });
}

const EASE = [0.25, 0.46, 0.45, 0.94] as const;
const ATTENTION_CAP = 4;

// Plain CSS custom-property refs, not Tailwind's ring-{color}/{opacity} utility —
// that opacity-modifier form doesn't reliably resolve for these hex-string tokens
// (same class of issue as the outline-ring/50 build failure fixed in globals.css).
const HEAT_DOT_COLOR: Record<"hot" | "warm", { fill: string; ring: string }> = {
  hot: { fill: "var(--hot)", ring: "rgba(184, 75, 51, 0.15)" },
  warm: { fill: "var(--warm)", ring: "rgba(184, 132, 46, 0.15)" },
};

/** Maps an activity's raw type to a feed icon — same real, honest verbs as the signal line. */
function feedIcon(verb: string) {
  const v = verb.toLowerCase();
  if (v.includes("text")) return MessageSquare;
  if (v.includes("call")) return Phone;
  if (v.includes("email")) return Mail;
  if (v.includes("tour")) return HomeIcon;
  if (v.includes("offer")) return FileText;
  return Sparkles;
}

// ── Shared section primitives ────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-display text-section text-muted-foreground mb-3">{children}</p>;
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-6 py-8 text-center">
      <p className="font-display text-body text-muted-foreground/70">{children}</p>
    </div>
  );
}

// ── Aria insight — the hero ──────────────────────────────────────────────

function InsightHero({ insight }: { insight: Insight }) {
  if (insight.count === 0) {
    return (
      <Card className="mb-8 px-6 py-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="size-3.5 text-primary" />
          <p className="font-display text-caption uppercase tracking-[0.08em] text-primary">Aria insight</p>
        </div>
        <p className="font-heading text-[19px] leading-snug text-muted-foreground">
          Nothing urgent enough to flag yet — check back as the week moves.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mb-8 px-6 py-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="size-3.5 text-primary" />
        <p className="font-display text-caption uppercase tracking-[0.08em] text-primary">Aria insight</p>
      </div>
      <p className="font-heading text-[21px] leading-snug text-foreground">
        {insight.count} client{insight.count === 1 ? "" : "s"} {insight.count === 1 ? "is" : "are"} likely to move
        this week
        {insight.commissionEst > 0 && (
          <>
            {" "}
            · <span className="text-primary font-medium">~{fmtMoney(insight.commissionEst)}</span> expected
            commission
          </>
        )}
        .
      </p>
    </Card>
  );
}

// ── Needs your attention — compact, capped rows ──────────────────────────

function AttentionRow({
  item,
  onAct,
  onSkip,
}: {
  item: TodayItem;
  onAct: (item: TodayItem) => void;
  onSkip: (item: TodayItem) => void;
}) {
  const dot = item.leadHeat !== "cold" ? HEAT_DOT_COLOR[item.leadHeat] : null;

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={
          dot
            ? { background: dot.fill, boxShadow: `0 0 0 4px ${dot.ring}` }
            : { background: "var(--border)" }
        }
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="font-display text-body-lg font-semibold text-foreground truncate">{item.clientName}</p>
        <p className="font-display text-caption text-muted-foreground truncate mt-0.5">
          {item.reason}
          {item.commissionEst ? ` · ~${fmtMoney(item.commissionEst)}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => onSkip(item)}
          className="hidden sm:block font-display text-caption text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          Skip
        </button>
        <Button
          size="sm"
          onClick={() => onAct(item)}
          className="rounded-full px-4 h-9 text-caption font-semibold"
        >
          {item.actionLabel}
        </Button>
      </div>
    </div>
  );
}

// ── What's happening — activity feed ─────────────────────────────────────

function ActivityFeedRowItem({ a }: { a: ActivityFeedRow }) {
  const Icon = feedIcon(a.verb);
  return (
    <div className="flex items-center gap-3.5 px-5 py-3.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
        <Icon className="size-3.5 text-muted-foreground" />
      </span>
      <p className="font-display text-body text-muted-foreground min-w-0 flex-1 truncate">
        <span className="text-foreground font-medium">{a.clientName}</span> {a.verb.toLowerCase()}
      </p>
      <span className="font-display text-caption text-muted-foreground/60 shrink-0">{relTime(a.createdAt)}</span>
    </div>
  );
}

// ── Zero-clients state ───────────────────────────────────────────────────

const SETUP_STEPS = [
  { Icon: Upload, title: "Import clients", desc: "Upload a CSV — Aria maps columns and imports your book instantly.", href: "/settings/import" },
  { Icon: UserPlus, title: "Add first client", desc: "Add one client manually and Aria starts finding opportunities.", href: "/clients?new=1" },
] as const;

function NewAgentState({ userName }: { userName: string }) {
  const [greeting, setGreeting] = useState("Good morning");
  useEffect(() => setGreeting(getGreeting()), []);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-5 pt-16 pb-32 sm:px-8">
        <h1 className="font-heading text-[34px] leading-tight text-foreground mb-2">
          {greeting}, {firstNameOf(userName)}.
        </h1>
        <p className="font-display text-body-lg text-muted-foreground mb-12 max-w-md">
          Add your first clients and Aria starts building your daily follow-up list automatically.
        </p>
        <div className="flex flex-col gap-3">
          {SETUP_STEPS.map(({ Icon, title, desc, href }) => (
            <a key={title} href={href}>
              <Card className="p-6 flex items-center gap-4 hover:border-input transition-colors">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                  <Icon className="size-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-title text-foreground">{title}</p>
                  <p className="font-display text-body text-muted-foreground mt-0.5">{desc}</p>
                </div>
                <ArrowRight className="size-4 text-muted-foreground shrink-0" />
              </Card>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────

export function TodayClient({
  items,
  insight,
  activityFeed,
  userName,
  agentInitials,
  hasAnyClients,
}: Props) {
  const router = useRouter();
  const [greeting, setGreeting] = useState("Good morning");
  const [dateLabel, setDateLabel] = useState("");
  const [activeDraftItem, setActiveDraftItem] = useState<TodayItem | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [localDismissed, setLocalDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setGreeting(getGreeting());
    setDateLabel(getDateLabel());
  }, []);

  const [attentionExpanded, setAttentionExpanded] = useState(false);
  const visibleItems = items.filter((i) => !localDismissed.has(i.id));
  const attentionItems = visibleItems.slice(0, attentionExpanded ? visibleItems.length : ATTENTION_CAP);
  const hiddenCount = Math.max(0, visibleItems.length - ATTENTION_CAP);

  // Pre-fetch AI drafts for all text-action items on mount — unchanged from prior behavior.
  useEffect(() => {
    const textItems = items.filter((i) => i.actionType === "text");
    if (textItems.length === 0) return;

    Promise.all(
      textItems.map((item) =>
        fetch("/api/ai/draft-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: item.clientName,
            scenario: item.reason,
            context: item.context ?? "",
            clientId: item.clientId,
            skipInsert: true,
            urgencyRank: item.urgencyRank,
            clientTown: item.clientTown,
            clientBudgetMax: item.clientBudgetMax,
            propertyAddress: item.propertyAddress ?? "",
            clientStatus: item.clientStatus,
            leadScore: item.leadScore,
            activitySignal: item.activitySignal ?? "",
            commissionEst: item.commissionEst,
          }),
        })
          .then((r) => r.json())
          .then((data: { draft?: string }) => ({ id: item.id, draft: data.draft ?? "" }))
          .catch(() => ({ id: item.id, draft: "" })),
      ),
    ).then((results) => {
      const draftMap: Record<string, string> = {};
      results.forEach(({ id, draft }) => {
        draftMap[id] = draft;
      });
      setDrafts(draftMap);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable on mount — server-rendered items

  const handleAction = useCallback(
    (item: TodayItem) => {
      triggerHaptic();
      if (item.actionType === "navigate" && item.navigateTo) {
        router.push(item.navigateTo);
      } else {
        setActiveDraftItem(item);
      }
    },
    [router],
  );

  const handleDismiss = useCallback((item: TodayItem) => {
    triggerHaptic();
    setLocalDismissed((prev) => new Set([...prev, item.id]));
    toast(`Skipped ${firstNameOf(item.clientName)} for today`);
    void dismissItem(item.id);
  }, []);

  const handleSent = useCallback((itemId: string) => {
    setActiveDraftItem(null);
    setLocalDismissed((prev) => new Set([...prev, itemId]));
    toast.success("Message sent");
  }, []);

  if (!hasAnyClients) {
    return <NewAgentState userName={userName} />;
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-[100dvh] bg-background text-foreground">
        <div className="mx-auto max-w-2xl px-5 pt-12 pb-32 sm:px-8 sm:pt-16">
          {/* Header */}
          <header className="mb-8 flex items-start justify-between gap-4">
            <div>
              <p className="font-display text-caption uppercase tracking-[0.08em] text-muted-foreground mb-3">
                {dateLabel}
              </p>
              <h1 className="font-heading text-[34px] leading-tight text-foreground">
                {greeting}, {firstNameOf(userName)}.
              </h1>
              <p className="font-display text-body-lg text-muted-foreground mt-1.5">Here&apos;s what&apos;s happening.</p>
            </div>
            <Link
              href="/settings"
              aria-label="Profile"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-body font-semibold text-foreground hover:opacity-80 transition-opacity"
            >
              {agentInitials}
            </Link>
          </header>

          {/* Aria insight — the hero */}
          <InsightHero insight={insight} />

          {/* Needs your attention — short, scannable, capped */}
          <section className="mb-12">
            <SectionLabel>Needs your attention</SectionLabel>
            {attentionItems.length === 0 ? (
              <EmptyNote>Nothing needs you right now. Nice work.</EmptyNote>
            ) : (
              <>
                <Card className="divide-y divide-border overflow-hidden">
                  <AnimatePresence initial={false}>
                    {attentionItems.map((item, i) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -12 }}
                        transition={{ duration: 0.26, delay: Math.min(i, 6) * 0.04, ease: EASE }}
                      >
                        <AttentionRow item={item} onAct={handleAction} onSkip={handleDismiss} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </Card>
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        navigator.vibrate?.(8);
                      } catch {
                        /* ignore */
                      }
                      setAttentionExpanded((v) => !v);
                    }}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-border bg-card py-3 font-display text-caption font-semibold text-muted-foreground shadow-[0_1px_2px_rgba(43,36,25,0.04)] transition-all hover:bg-secondary active:scale-[0.985]"
                  >
                    {attentionExpanded ? "Show less" : `Show ${hiddenCount} more`}
                    {attentionExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </button>
                )}
              </>
            )}
          </section>

          {/* What's happening — activity feed */}
          <section>
            <div className="flex items-center justify-between">
              <SectionLabel>What&apos;s happening</SectionLabel>
              <Link
                href="/emails"
                className="font-display text-caption font-semibold text-primary active:opacity-70"
              >
                Inbox →
              </Link>
            </div>
            {activityFeed.length === 0 ? (
              <EmptyNote>Nothing logged yet — activity shows up here as it happens.</EmptyNote>
            ) : (
              <Card className="divide-y divide-border overflow-hidden">
                {activityFeed.map((a) => (
                  <ActivityFeedRowItem key={a.id} a={a} />
                ))}
              </Card>
            )}
          </section>
        </div>

        <DraftSheet
          item={activeDraftItem}
          prefetchedDraft={activeDraftItem ? drafts[activeDraftItem.id] : undefined}
          onClose={() => setActiveDraftItem(null)}
          onSent={handleSent}
        />
        <Toaster />
      </div>
    </MotionConfig>
  );
}
