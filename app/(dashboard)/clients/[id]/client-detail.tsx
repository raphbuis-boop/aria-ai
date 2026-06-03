"use client";

import { EditClientModal } from "@/components/EditClientModal";
import { InboxSheet } from "@/components/InboxSheet";
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
  openTaskCount: number;
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

// ── Readiness score ───────────────────────────────────────────────────────────

function computeReadiness(
  daysSinceContact: number | null,
  recentMatchCount: number,
  hasBudget: boolean,
  hasTown: boolean,
  hasBeds: boolean,
): { score: number; label: string; color: string; signals: string[] } {
  let score = 0;
  const signals: string[] = [];

  if (daysSinceContact === null) {
    signals.push("No contact yet");
  } else if (daysSinceContact <= 3) {
    score += 30;
    signals.push(`Active · ${daysSinceContact}d ago`);
  } else if (daysSinceContact <= 7) {
    score += 20;
    signals.push(`Contacted ${daysSinceContact}d ago`);
  } else if (daysSinceContact <= 14) {
    score += 10;
    signals.push(`Last contact ${daysSinceContact}d ago`);
  } else {
    signals.push(`Quiet · ${daysSinceContact}d ago`);
  }

  if (recentMatchCount > 0) {
    score += Math.min(recentMatchCount * 7, 20);
    signals.push(`${recentMatchCount} new match${recentMatchCount !== 1 ? "es" : ""}`);
  }

  if (hasBudget) { score += 20; signals.push("Budget set"); }
  if (hasTown)   { score += 15; signals.push("Area set"); }
  if (hasBeds)   { score += 10; signals.push("Prefs set"); }

  score = Math.min(score, 100);

  const label = score >= 75 ? "HOT" : score >= 45 ? "WARM" : "COLD";
  const color = score >= 75 ? "#1A9B5E" : score >= 45 ? "#C47E1A" : "#C43838";

  return { score, label, color, signals };
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
      reason: `No budget on file — matching is less accurate. Ask ${firstName} what range feels right.`,
      primary: "Edit Profile",
      primaryType: "edit",
    };
  }
  if (matchedCount > 0 && (daysSinceContact === null || daysSinceContact > 3)) {
    return {
      title: "Send property update",
      reason: `${matchedCount} listing${matchedCount > 1 ? "s" : ""} match — ${firstName} hasn't seen them yet.`,
      primary: "Draft Message",
      secondary: "Schedule Showing",
      primaryType: "draft",
    };
  }
  if (daysSinceContact === null || daysSinceContact > 14) {
    return {
      title: "Check in",
      reason: `No contact${daysSinceContact ? ` for ${daysSinceContact} days` : ""}. A quick text keeps the relationship warm.`,
      primary: "Draft Message",
      secondary: "Call",
      primaryType: "draft",
    };
  }
  return {
    title: "Schedule a showing",
    reason: `${firstName} is engaged — move them forward with an in-person tour.`,
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
  return a.type ?? "Activity";
}

// ── Score Ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score, color, label }: { score: number; color: string; label: string }) {
  const r = 46;
  const circumference = 2 * Math.PI * r;
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const id = requestAnimationFrame(() => setOffset(circumference * (1 - score / 100)));
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
  openTaskCount: _openTaskCount, // eslint-disable-line @typescript-eslint/no-unused-vars
  recentMatchCount,
  matchedProperties,
}: ClientDetailProps) {
  const router = useRouter();
  const [inboxOpen, setInboxOpen] = useState(false);
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
  const clientEmail = email ?? "";

  const budget = budgetDisplay(budgetMin, budgetMax);
  const initial = initialsOf(name);
  const lastActivity = recentActivities[0];

  const daysSinceContact = lastActivity
    ? differenceInDays(new Date(), new Date(lastActivity.created_at))
    : null;

  const hasBudget = !!(budgetMin || budgetMax);

  const readiness = computeReadiness(
    daysSinceContact,
    recentMatchCount,
    hasBudget,
    !!town,
    !!bedsWanted,
  );

  const nextAction = computeNextAction(
    firstName,
    daysSinceContact,
    matchedProperties.length,
    hasBudget,
    draftCount,
  );

  // ── AI summary fetch ──
  useEffect(() => {
    if (summaryFetched.current) return;
    summaryFetched.current = true;

    const context = [
      `Client: ${name}`,
      status ? `Status: ${status}` : null,
      budget ? `Budget: ${budget}` : null,
      town ? `Looking in: ${town}` : null,
      bedsWanted ? `Wants ${bedsWanted}bd` : null,
      lastActivity ? `Last contact ${relTime(lastActivity.created_at)}` : "No prior contact",
      recentMatchCount > 0 ? `${recentMatchCount} new property matches` : null,
      draftCount > 0 ? `${draftCount} AI draft pending` : null,
    ]
      .filter(Boolean)
      .join(". ");

    void fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: `You are a briefing assistant for a real estate agent. Write 2 short sentences about this client — their situation and what the agent should do next. Be direct and specific. Context: ${context}`,
          },
        ],
      }),
    })
      .then((r) => r.json())
      .then((d: { reply?: string }) => setSummary(d.reply ?? ""))
      .catch(() => setSummary(""))
      .finally(() => setSummaryLoading(false));
  }, [name, status, budget, town, bedsWanted, lastActivity, recentMatchCount, draftCount]);

  // ── Action handlers ──
  function handlePrimaryAction() {
    if (nextAction.primaryType === "inbox" || nextAction.primaryType === "draft") {
      setInboxOpen(true);
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
      setInboxOpen(true);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="min-h-screen pb-[120px]" style={{ color: "var(--oc-text-1)" }}>

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
                  <> · Last contact {relTime(lastActivity.created_at)}</>
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
                className="text-[11px] font-semibold uppercase mb-3"
                style={{ color: "var(--oc-text-3)", letterSpacing: "0.08em" }}
              >
                Readiness
              </p>
              <div className="flex flex-wrap gap-1.5">
                {readiness.signals.map((s) => (
                  <span
                    key={s}
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      color: "var(--oc-text-2)",
                      border: "0.5px solid var(--oc-border-soft)",
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ── 2. Aria Summary ── */}
          <div className="oc-card px-4 py-4 mb-3">
            <div className="flex items-center gap-2 mb-2.5">
              <Sparkles size={13} style={{ color: "var(--oc-blue)" }} />
              <span
                className="text-[11px] font-semibold uppercase"
                style={{ color: "var(--oc-text-3)", letterSpacing: "0.08em" }}
              >
                Aria
              </span>
            </div>
            {summaryLoading ? (
              <div className="space-y-2">
                <div
                  className="h-3 rounded-full animate-pulse"
                  style={{ background: "rgba(255,255,255,0.07)", width: "90%" }}
                />
                <div
                  className="h-3 rounded-full animate-pulse"
                  style={{ background: "rgba(255,255,255,0.07)", width: "68%" }}
                />
              </div>
            ) : (
              <p className="text-[13px] leading-relaxed italic" style={{ color: "var(--oc-text-2)" }}>
                {summary || "No summary available."}
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

          {/* ── 5. Timeline ── */}
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
              <span
                className="text-[13px] font-semibold"
                style={{ color: "var(--oc-text-1)" }}
              >
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
                    <span
                      className="text-[13px] font-medium"
                      style={{ color: "var(--oc-blue)" }}
                    >
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

      {/* ── InboxSheet ── */}
      {inboxOpen && (
        <InboxSheet
          clientId={id}
          clientName={name}
          clientEmail={clientEmail}
          onClose={() => setInboxOpen(false)}
        />
      )}

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
