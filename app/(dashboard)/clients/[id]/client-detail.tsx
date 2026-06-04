"use client";

import { EditClientModal } from "@/components/EditClientModal";
import { fmtMoney } from "@/lib/utils";
import { differenceInDays, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileText,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

type Activity = {
  id: string;
  type: string | null;
  body: string | null;
  ai_draft: boolean;
  approved: boolean;
  sent: boolean;
  created_at: string;
};

type MatchedProperty = {
  id: string;
  address: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  town: string | null;
  status: string | null;
  score: number;
};

type ClientDetailProps = {
  client: Record<string, unknown>;
  recentActivities: Activity[];
  draftCount: number;
  lastDraftBody: string | null;
  recentMatchCount: number;
  matchedProperties: MatchedProperty[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function initialsOf(name: string | null | undefined): string {
  return (
    (name ?? "")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function budgetDisplay(min: number | null, max: number | null): string {
  if (min == null && max == null) return "";
  if (min != null && max != null) return `${fmtMoney(min)} – ${fmtMoney(max)}`;
  if (max != null) return `Up to ${fmtMoney(max)}`;
  return `From ${fmtMoney(min!)}`;
}

function relTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

// ── Readiness scoring ─────────────────────────────────────────────────────────
//
// Contact recency is the dominant signal (55 pts). No recent contact = cannot
// be HOT. Profile completeness and match activity contribute up to 45 pts,
// so even a perfectly profiled client with no contact maxes out at WARM.

function computeReadiness(
  daysSinceContact: number | null,
  recentMatchCount: number,
  hasBudget: boolean,
  hasTown: boolean,
  hasBeds: boolean,
): { score: number; label: string; color: string; why: string } {
  let score = 0;

  // Contact recency — 55 pts max. Dominant factor.
  if (daysSinceContact === null) {
    score += 0;
  } else if (daysSinceContact <= 3) {
    score += 55;
  } else if (daysSinceContact <= 7) {
    score += 42;
  } else if (daysSinceContact <= 14) {
    score += 28;
  } else if (daysSinceContact <= 30) {
    score += 14;
  } else if (daysSinceContact <= 60) {
    score += 5;
  } else {
    score += 0; // 60+ days → no contact credit
  }

  // Recent matches — 20 pts max
  score += Math.min(recentMatchCount * 5, 20);

  // Profile completeness — 25 pts max
  if (hasBudget) score += 12;
  if (hasTown)   score += 8;
  if (hasBeds)   score += 5;

  score = Math.min(score, 100);

  // ≥75 HOT · 40–74 WARM · <40 COLD
  const label = score >= 75 ? "HOT" : score >= 40 ? "WARM" : "COLD";
  const color = score >= 75 ? "#1A9B5E" : score >= 40 ? "#C47E1A" : "#C43838";

  const whyParts: string[] = [];
  if (daysSinceContact === null)       whyParts.push("no contact yet");
  else if (daysSinceContact <= 3)      whyParts.push("active today");
  else if (daysSinceContact <= 14)     whyParts.push(`${daysSinceContact}d since contact`);
  else                                 whyParts.push(`${daysSinceContact}d of silence`);
  if (recentMatchCount > 0)            whyParts.push(`${recentMatchCount} new matches`);
  if (!hasBudget)                      whyParts.push("no budget");

  const why = whyParts.slice(0, 2).join(" · ");

  return { score, label, color, why };
}

// ── Attention signals ("Why Aria is paying attention") ────────────────────────

function computeAttentionSignals(
  daysSinceContact: number | null,
  recentMatchCount: number,
  hasBudget: boolean,
  hasTown: boolean,
  recentActivities: Activity[],
): string[] {
  const signals: string[] = [];

  if (daysSinceContact === null) {
    signals.push("No contact on record");
  } else if (daysSinceContact > 14) {
    signals.push(`${daysSinceContact} days since last contact`);
  }

  if (recentMatchCount > 0) {
    signals.push(`${recentMatchCount} matching listing${recentMatchCount !== 1 ? "s" : ""}`);
  }

  if (!hasBudget) {
    signals.push("No budget on file");
  }

  if (!hasTown) {
    signals.push("No search area defined");
  }

  const showingCount = recentActivities.filter((a) => a.type === "showing").length;
  if (showingCount > 0) {
    signals.push(`${showingCount} showing${showingCount !== 1 ? "s" : ""} in history`);
  }

  const draftCount = recentActivities.filter((a) => a.ai_draft && !a.approved).length;
  if (draftCount > 0) {
    signals.push(`${draftCount} AI draft${draftCount !== 1 ? "s" : ""} pending`);
  }

  return signals;
}

// ── Next best action ──────────────────────────────────────────────────────────

type NextAction = {
  title: string;
  reason: string;
  primary: string;
  secondary?: string;
  primaryType: "draft" | "showing" | "inbox" | "edit";
};

function computeNextAction(
  firstName: string,
  daysSinceContact: number | null,
  matchedCount: number,
  hasBudget: boolean,
  draftCount: number,
): NextAction {
  if (draftCount > 0) {
    return {
      title: "Review AI draft",
      reason: `${draftCount} message${draftCount > 1 ? "s" : ""} from Aria awaiting your approval.`,
      primary: "Open Draft",
      primaryType: "inbox",
    };
  }
  if (!hasBudget) {
    return {
      title: "Capture budget",
      reason: `No budget means Aria can't match properties accurately. Ask ${firstName} what range feels comfortable.`,
      primary: "Edit Profile",
      primaryType: "edit",
    };
  }
  if (matchedCount > 0 && (daysSinceContact === null || daysSinceContact > 3)) {
    return {
      title: "Send property update",
      reason: `${matchedCount} listing${matchedCount > 1 ? "s" : ""} match ${firstName}'s criteria — they haven't seen them yet.`,
      primary: "Draft Message",
      secondary: "Schedule Showing",
      primaryType: "draft",
    };
  }
  if (daysSinceContact === null || daysSinceContact > 14) {
    return {
      title: "Check in",
      reason: `${daysSinceContact ? `${daysSinceContact} days without contact` : "No contact on record"}. A short text keeps the relationship warm.`,
      primary: "Draft Message",
      secondary: "Call",
      primaryType: "draft",
    };
  }
  return {
    title: "Schedule a showing",
    reason: `${firstName} is engaged — the next step is an in-person tour.`,
    primary: "Schedule Showing",
    secondary: "Draft Message",
    primaryType: "showing",
  };
}

// ── Activity icon map ─────────────────────────────────────────────────────────

const ACTIVITY_ICON_MAP: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
  email:   { bg: "rgba(59,130,246,0.18)",  color: "#3B82F6", icon: <Mail size={14} /> },
  text:    { bg: "rgba(26,155,94,0.18)",   color: "#1A9B5E", icon: <MessageSquare size={14} /> },
  call:    { bg: "rgba(26,155,94,0.18)",   color: "#1A9B5E", icon: <Phone size={14} /> },
  note:    { bg: "rgba(196,126,26,0.18)",  color: "#C47E1A", icon: <FileText size={14} /> },
  showing: { bg: "rgba(59,130,246,0.18)",  color: "#3B82F6", icon: <CalendarDays size={14} /> },
};

function activityIconConfig(type: string | null) {
  return ACTIVITY_ICON_MAP[type ?? ""] ?? {
    bg: "rgba(83,104,120,0.18)", color: "#7A96A8", icon: <FileText size={14} />,
  };
}

function activityLabel(a: Activity): string {
  if (a.type === "email" && a.sent) return "Email sent";
  if (a.type === "text" && a.ai_draft && !a.approved) return "AI draft pending";
  if (a.type === "text" && a.sent) return "Text sent";
  if (a.type === "call") return "Call logged";
  if (a.type === "note") return "Note";
  if (a.type === "showing") return "Showing";
  return a.type ?? "Activity";
}

// ── Score Ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score, color, label }: { score: number; color: string; label: string }) {
  const r = 46;
  const circumference = 2 * Math.PI * r;
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const id = requestAnimationFrame(() =>
      setOffset(circumference * (1 - score / 100))
    );
    return () => cancelAnimationFrame(id);
  }, [score, circumference]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: 116, height: 116 }}>
      <svg width="116" height="116" style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={58} cy={58} r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={8}
        />
        <circle
          cx={58} cy={58} r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.34,1.56,0.64,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-[30px] font-bold leading-none"
          style={{ color: "var(--oc-text-1)", letterSpacing: "-0.03em" }}
        >
          {score}
        </span>
        <span
          className="text-[10px] font-bold mt-0.5"
          style={{ color, letterSpacing: "0.10em" }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ClientDetail({
  client,
  recentActivities,
  draftCount,
  lastDraftBody: _lastDraftBody, // eslint-disable-line @typescript-eslint/no-unused-vars
  recentMatchCount,
  matchedProperties,
}: ClientDetailProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // AI summary
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(true);
  const summaryFetched = useRef(false);

  const id          = String(client.id ?? "");
  const name        = String(client.name ?? "Client");
  const firstName   = name.split(" ")[0];
  const status      = (client.status as string | null) ?? null;
  const budgetMin   = (client.budget_min as number | null) ?? null;
  const budgetMax   = (client.budget_max as number | null) ?? null;
  const bedsWanted  = (client.beds_wanted as number | null) ?? null;
  const bathsWanted = (client.baths_wanted as number | null) ?? null;
  const town        = (client.town as string | null) ?? null;
  const phone       = (client.phone as string | null) ?? null;
  const email       = (client.email as string | null) ?? null;
  const notes       = (client.notes as string | null) ?? null;
  const source      = (client.source as string | null) ?? null;
  const budget    = budgetDisplay(budgetMin, budgetMax);
  const initial   = initialsOf(name);
  const lastActivity = recentActivities[0];
  const hasBudget = !!(budgetMin || budgetMax);

  const daysSinceContact = lastActivity
    ? differenceInDays(new Date(), new Date(lastActivity.created_at))
    : null;

  const readiness = computeReadiness(
    daysSinceContact,
    recentMatchCount,
    hasBudget,
    !!town,
    !!bedsWanted,
  );

  const attentionSignals = computeAttentionSignals(
    daysSinceContact,
    recentMatchCount,
    hasBudget,
    !!town,
    recentActivities,
  );

  const nextAction = computeNextAction(
    firstName,
    daysSinceContact,
    matchedProperties.length,
    hasBudget,
    draftCount,
  );

  // ── AI summary fetch ──
  // Prompt is structured to produce: who they are · budget · location ·
  // engagement status · recent activity · opportunities · recommended action.
  // It must describe the CLIENT, never address or answer the agent directly.
  useEffect(() => {
    if (summaryFetched.current) return;
    summaryFetched.current = true;

    const ctx = [
      `Name: ${name}`,
      status    ? `Buyer status: ${status}` : null,
      budget    ? `Budget: ${budget}` : "Budget: not set",
      town      ? `Target area: ${town}` : "Target area: not defined",
      bedsWanted ? `Beds wanted: ${bedsWanted}` : null,
      bathsWanted ? `Baths wanted: ${bathsWanted}` : null,
      lastActivity
        ? `Last contact: ${relTime(lastActivity.created_at)} (${lastActivity.type ?? "unknown"})`
        : "Last contact: never",
      recentMatchCount > 0 ? `New property matches: ${recentMatchCount}` : "New matches: none",
      draftCount > 0 ? `Pending AI drafts: ${draftCount}` : null,
      `Activity count: ${recentActivities.length}`,
    ]
      .filter(Boolean)
      .join("\n");

    void fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content:
              `You are Aria, a real estate intelligence system. Write a 3-sentence client brief for the agent's eyes only.\n` +
              `Sentence 1: Who this client is — their name, what they are looking for, budget, and target location.\n` +
              `Sentence 2: Their engagement status and recent contact history — are they active, quiet, or cold?\n` +
              `Sentence 3: The most important opportunity or risk right now, and the single recommended action.\n` +
              `Rules: Be specific and use numbers. Do not use filler phrases. Do not address the agent ("you should…"). Describe the client in third person.\n\n` +
              `Client data:\n${ctx}`,
          },
        ],
      }),
    })
      .then((r) => r.json())
      .then((d: { reply?: string }) => setSummary(d.reply ?? ""))
      .catch(() => setSummary(""))
      .finally(() => setSummaryLoading(false));
  }, [
    name, status, budget, town, bedsWanted, bathsWanted,
    lastActivity, recentMatchCount, draftCount, recentActivities.length,
  ]);

  // ── Action handlers ──
  function handlePrimaryAction() {
    if (nextAction.primaryType === "inbox" || nextAction.primaryType === "draft") {
      router.push(`/inbox?clientId=${id}`);
    } else if (nextAction.primaryType === "edit") {
      setEditOpen(true);
    } else if (nextAction.primaryType === "showing") {
      const addr = matchedProperties[0]?.address ?? "";
      router.push(`/showings?new=1${addr ? `&address=${encodeURIComponent(addr)}` : ""}`);
    }
  }

  function handleSecondaryAction() {
    const sec = nextAction.secondary;
    if (sec === "Schedule Showing") {
      const addr = matchedProperties[0]?.address ?? "";
      router.push(`/showings?new=1${addr ? `&address=${encodeURIComponent(addr)}` : ""}`);
    } else if (sec === "Call" && phone) {
      window.location.href = `tel:${phone.replace(/\D/g, "")}`;
    } else if (sec === "Draft Message") {
      router.push(`/inbox?clientId=${id}`);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="min-h-[100dvh] pb-[120px]" style={{ color: "var(--oc-text-1)" }}>

        {/* ── Sticky nav ── */}
        <div
          className="sticky top-0 z-30 flex items-center justify-between px-4 py-3"
          style={{
            background: "rgba(12,15,22,0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: "0.5px solid var(--oc-border-soft)",
          }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full active:opacity-70"
            aria-label="Back"
          >
            <ArrowLeft size={20} style={{ color: "var(--oc-text-2)" }} />
          </button>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full active:opacity-70"
            aria-label="More options"
          >
            <MoreHorizontal size={20} style={{ color: "var(--oc-text-2)" }} />
          </button>
        </div>

        <div className="px-4 pt-5">

          {/* ── Identity header ── */}
          <div className="flex items-center gap-4 mb-6">
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-full text-[22px] font-bold"
              style={{
                width: 64,
                height: 64,
                background: "rgba(59,130,246,0.16)",
                color: "var(--oc-blue)",
                border: "0.5px solid rgba(59,130,246,0.28)",
              }}
            >
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <h1
                className="text-[22px] font-bold leading-tight mb-1"
                style={{ color: "var(--oc-text-1)", letterSpacing: "-0.02em" }}
              >
                {name}
              </h1>
              {status && (
                <span
                  className="inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase mb-1.5"
                  style={{
                    background: "rgba(83,104,120,0.22)",
                    color: "var(--oc-text-2)",
                    letterSpacing: "0.08em",
                  }}
                >
                  {status.replace(/_/g, " ")}
                </span>
              )}
              <p className="text-[13px]" style={{ color: "var(--oc-text-3)" }}>
                {[town?.split(",")[0]?.trim(), budget].filter(Boolean).join(" · ")}
                {lastActivity && (
                  <> · {relTime(lastActivity.created_at)}</>
                )}
              </p>
            </div>
          </div>

          {/* ── 1. Readiness Score ── */}
          <div className="oc-card-elevated mb-3 px-5 py-5 flex items-center gap-5">
            <ScoreRing
              score={readiness.score}
              color={readiness.color}
              label={readiness.label}
            />
            <div className="min-w-0 flex-1">
              <p
                className="text-[11px] font-semibold uppercase mb-1"
                style={{ color: "var(--oc-text-3)", letterSpacing: "0.08em" }}
              >
                Transaction Readiness
              </p>
              <p className="text-[12px] mb-3" style={{ color: "var(--oc-text-3)" }}>
                {readiness.why}
              </p>
              <div className="flex flex-col gap-1.5">
                {/* Scoring breakdown */}
                {[
                  {
                    label: daysSinceContact === null
                      ? "No contact yet"
                      : daysSinceContact <= 3
                      ? "Active this week"
                      : daysSinceContact <= 14
                      ? `${daysSinceContact}d since contact`
                      : `${daysSinceContact}d — needs attention`,
                    active: daysSinceContact !== null && daysSinceContact <= 14,
                    key: "contact",
                  },
                  {
                    label: hasBudget ? "Budget defined" : "No budget on file",
                    active: hasBudget,
                    key: "budget",
                  },
                  {
                    label: !!town ? "Search area set" : "No target area",
                    active: !!town,
                    key: "town",
                  },
                  ...(recentMatchCount > 0
                    ? [{ label: `${recentMatchCount} new match${recentMatchCount !== 1 ? "es" : ""}`, active: true, key: "matches" }]
                    : []),
                ].map(({ label, active, key }) => (
                  <div key={key} className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                      style={{ background: active ? readiness.color : "rgba(83,104,120,0.4)" }}
                    />
                    <span
                      className="text-[12px]"
                      style={{ color: active ? "var(--oc-text-2)" : "var(--oc-text-3)" }}
                    >
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── 2. Aria Intelligence Brief ── */}
          <div className="oc-card px-4 py-4 mb-3">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={13} style={{ color: "var(--oc-blue)" }} />
              <span
                className="text-[11px] font-semibold uppercase"
                style={{ color: "var(--oc-text-3)", letterSpacing: "0.08em" }}
              >
                Aria Intelligence
              </span>
            </div>
            {summaryLoading ? (
              <div className="space-y-2">
                <div
                  className="h-3 rounded-full animate-pulse"
                  style={{ background: "rgba(255,255,255,0.07)", width: "95%" }}
                />
                <div
                  className="h-3 rounded-full animate-pulse"
                  style={{ background: "rgba(255,255,255,0.07)", width: "85%" }}
                />
                <div
                  className="h-3 rounded-full animate-pulse"
                  style={{ background: "rgba(255,255,255,0.07)", width: "65%" }}
                />
              </div>
            ) : (
              <p className="text-[13.5px] leading-[1.65] italic" style={{ color: "var(--oc-text-2)" }}>
                {summary || "Aria could not generate a brief for this client."}
              </p>
            )}
          </div>

          {/* ── 3. Next Best Action ── */}
          <div
            className="oc-card-elevated mb-3 overflow-hidden"
            style={{ borderLeft: "2.5px solid var(--oc-blue)" }}
          >
            <div className="px-4 py-4">
              <p
                className="text-[11px] font-semibold uppercase mb-1.5"
                style={{ color: "var(--oc-text-3)", letterSpacing: "0.08em" }}
              >
                Next Best Action
              </p>
              <p
                className="text-[17px] font-bold mb-1"
                style={{ color: "var(--oc-text-1)", letterSpacing: "-0.01em" }}
              >
                {nextAction.title}
              </p>
              <p className="text-[13px] leading-snug mb-4" style={{ color: "var(--oc-text-2)" }}>
                {nextAction.reason}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  className="flex-1 rounded-2xl py-3 text-[14px] font-semibold text-white active:opacity-80"
                  style={{ background: "var(--oc-blue)" }}
                >
                  {nextAction.primary}
                </button>
                {nextAction.secondary && (
                  <button
                    type="button"
                    onClick={handleSecondaryAction}
                    className="flex-1 rounded-2xl py-3 text-[14px] font-semibold active:opacity-70"
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      color: "var(--oc-text-1)",
                      border: "0.5px solid var(--oc-border-soft)",
                    }}
                  >
                    {nextAction.secondary}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── 4. Matched Properties ── */}
          {matchedProperties.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[13px] font-semibold" style={{ color: "var(--oc-text-1)" }}>
                  Matched Properties
                </p>
                <Link
                  href="/listings"
                  className="text-[13px] font-medium"
                  style={{ color: "var(--oc-blue)" }}
                >
                  See all →
                </Link>
              </div>
              <div
                className="flex gap-3 overflow-x-auto pb-1"
                style={{ scrollbarWidth: "none" }}
              >
                {matchedProperties.map((prop) => (
                  <Link
                    key={prop.id}
                    href={`/properties/${prop.id}`}
                    className="flex-shrink-0 oc-card active:opacity-70"
                    style={{ width: 168, display: "block", padding: 14 }}
                  >
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold mb-2"
                      style={{
                        background: prop.score >= 80
                          ? "rgba(26,155,94,0.18)"
                          : "rgba(196,126,26,0.16)",
                        color: prop.score >= 80 ? "#1A9B5E" : "#C47E1A",
                      }}
                    >
                      {prop.score}% match
                    </span>
                    <p
                      className="text-[13px] font-semibold leading-tight mb-1 line-clamp-2"
                      style={{ color: "var(--oc-text-1)" }}
                    >
                      {prop.address ?? "Property"}
                    </p>
                    {prop.price && (
                      <p className="text-[12px] font-semibold" style={{ color: "var(--oc-blue)" }}>
                        {fmtMoney(prop.price)}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11px]" style={{ color: "var(--oc-text-3)" }}>
                      {[prop.beds && `${prop.beds} bd`, prop.baths && `${prop.baths} ba`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── 5a. Why Aria is paying attention ── */}
          {attentionSignals.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2.5">
                <Zap size={13} style={{ color: "var(--oc-amber)" }} />
                <p
                  className="text-[11px] font-semibold uppercase"
                  style={{ color: "var(--oc-text-3)", letterSpacing: "0.08em" }}
                >
                  Why Aria is paying attention
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {attentionSignals.map((sig) => (
                  <span
                    key={sig}
                    className="rounded-full px-3 py-1.5 text-[12px] font-medium"
                    style={{
                      background: "rgba(196,126,26,0.12)",
                      color: "#C47E1A",
                      border: "0.5px solid rgba(196,126,26,0.28)",
                    }}
                  >
                    {sig}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── 5b. Timeline ── */}
          {recentActivities.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[13px] font-semibold" style={{ color: "var(--oc-text-1)" }}>
                  Timeline
                </p>
                <Link
                  href={`/clients/${id}/activity`}
                  className="text-[13px] font-medium"
                  style={{ color: "var(--oc-blue)" }}
                >
                  View all →
                </Link>
              </div>
              <div className="oc-card overflow-hidden">
                {recentActivities.slice(0, 5).map((a, i) => {
                  const cfg = activityIconConfig(a.type);
                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 px-4 py-3"
                      style={i > 0 ? { borderTop: "0.5px solid var(--oc-border-soft)" } : {}}
                    >
                      <div
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        {cfg.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-[13px] font-medium"
                          style={{ color: "var(--oc-text-1)" }}
                        >
                          {activityLabel(a)}
                        </p>
                        {a.body && (
                          <p className="text-[12px] truncate" style={{ color: "var(--oc-text-3)" }}>
                            {a.body.slice(0, 60)}
                          </p>
                        )}
                      </div>
                      <span
                        className="text-[11px] flex-shrink-0"
                        style={{ color: "var(--oc-text-3)" }}
                      >
                        {relTime(a.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 6. Profile Details (collapsed) ── */}
          <div className="oc-card mb-3 overflow-hidden">
            <button
              type="button"
              onClick={() => setProfileOpen((o) => !o)}
              className="flex w-full items-center justify-between px-4 py-3.5 active:opacity-70"
            >
              <span className="text-[13px] font-semibold" style={{ color: "var(--oc-text-1)" }}>
                Profile Details
              </span>
              {profileOpen
                ? <ChevronUp size={16} style={{ color: "var(--oc-text-3)" }} />
                : <ChevronDown size={16} style={{ color: "var(--oc-text-3)" }} />
              }
            </button>

            {profileOpen && (
              <>
                {(
                  [
                    email
                      ? { label: "Email", value: email, href: `mailto:${email}`, blue: true }
                      : null,
                    phone
                      ? { label: "Phone", value: phone, href: `tel:${phone.replace(/\D/g, "")}`, blue: true }
                      : null,
                    town
                      ? { label: "Location", value: town, href: null, blue: false }
                      : null,
                    budget
                      ? { label: "Budget", value: budget, href: null, blue: false }
                      : null,
                    bedsWanted || bathsWanted
                      ? {
                          label: "Beds / Baths",
                          value: [
                            bedsWanted ? `${bedsWanted} bd` : null,
                            bathsWanted ? `${bathsWanted}+ ba` : null,
                          ]
                            .filter(Boolean)
                            .join(" · "),
                          href: null,
                          blue: false,
                        }
                      : null,
                    source
                      ? { label: "Source", value: source, href: null, blue: false }
                      : null,
                    notes
                      ? {
                          label: "Notes",
                          value: notes.slice(0, 80) + (notes.length > 80 ? "…" : ""),
                          href: null,
                          blue: false,
                        }
                      : null,
                  ] as Array<{
                    label: string;
                    value: string;
                    href: string | null;
                    blue: boolean;
                  } | null>
                )
                  .filter((r): r is NonNullable<typeof r> => r !== null)
                  .map(({ label, value, href, blue }) => (
                    <div
                      key={label}
                      className="flex items-start justify-between px-4 py-3"
                      style={{ borderTop: "0.5px solid var(--oc-border-soft)" }}
                    >
                      <span className="text-[13px]" style={{ color: "var(--oc-text-3)" }}>
                        {label}
                      </span>
                      {href ? (
                        <a
                          href={href}
                          className="text-[13px] font-medium text-right max-w-[60%] break-all"
                          style={{ color: blue ? "var(--oc-blue)" : "var(--oc-text-1)" }}
                        >
                          {value}
                        </a>
                      ) : (
                        <span
                          className="text-[13px] text-right max-w-[60%]"
                          style={{ color: "var(--oc-text-1)" }}
                        >
                          {value}
                        </span>
                      )}
                    </div>
                  ))}

                <div style={{ borderTop: "0.5px solid var(--oc-border-soft)" }}>
                  <button
                    type="button"
                    onClick={() => setEditOpen(true)}
                    className="flex w-full items-center justify-between px-4 py-3 active:opacity-70"
                  >
                    <span className="text-[13px] font-medium" style={{ color: "var(--oc-blue)" }}>
                      Edit Profile
                    </span>
                    <ChevronRight size={14} style={{ color: "var(--oc-text-3)" }} />
                  </button>
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* ── EditClientModal ── */}
      {editOpen && (
        <EditClientModal
          client={{
            id,
            name: (client.name as string | null) ?? null,
            phone,
            email,
            status,
            budget_min: budgetMin,
            budget_max: budgetMax,
            town,
            beds_wanted: bedsWanted,
            baths_wanted: bathsWanted,
            lead_score: (client.lead_score as number | null) ?? null,
            notes,
            client_role: (client.client_role as string | null) ?? null,
          }}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  );
}
