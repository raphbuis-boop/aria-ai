"use client";

import { EditClientModal } from "@/components/EditClientModal";
import { InboxSheet } from "@/components/InboxSheet";
import { fmtMoney } from "@/lib/utils";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Mail,
  MessageSquare,
  Pencil,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

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

type DotColor = "green" | "amber" | "blue" | "gray";

function activityDot(a: Activity): DotColor {
  if (a.type === "email" && a.sent) return "blue";
  if (a.type === "text" && a.sent) return "green";
  if (a.type === "text" && a.ai_draft && !a.approved) return "amber";
  if (a.type === "call") return "blue";
  return "gray";
}

const DOT_COLORS: Record<DotColor, string> = {
  green: "#22c55e",
  amber: "#f59e0b",
  blue:  "#3B82F6",
  gray:  "#48484a",
};

function activityLabel(a: Activity): string {
  if (a.type === "email" && a.sent) return "Email sent";
  if (a.type === "email") return "Email";
  if (a.type === "text" && a.ai_draft && !a.approved) return "AI draft pending";
  if (a.type === "text" && a.sent) return "Text sent";
  if (a.type === "call") return "Call logged";
  if (a.type === "note") return "Note";
  return a.type ?? "Activity";
}

/** Compute a 0–100 readiness score from available data. */
function computeReadiness(
  client: Record<string, unknown>,
  lastActivity: Activity | undefined,
): { score: number; label: string; color: string; subLabel: string } {
  let score = 35; // baseline

  // Budget defined
  if (client.budget_min || client.budget_max) score += 20;
  // Town defined
  if (client.town) score += 15;
  // Beds defined
  if (client.beds_wanted) score += 10;

  // Contact recency
  const daysSince = lastActivity
    ? differenceInDays(new Date(), new Date(lastActivity.created_at))
    : 999;

  if (daysSince <= 3) score += 20;
  else if (daysSince <= 7) score += 15;
  else if (daysSince <= 14) score += 8;

  score = Math.min(100, score);

  let label = "Cold";
  let color = "#6B7280";
  if (score >= 80) { label = "Hot"; color = "#22c55e"; }
  else if (score >= 60) { label = "Warm"; color = "#f59e0b"; }
  else if (score >= 45) { label = "Active"; color = "#60A5FA"; }

  const subLabel = lastActivity
    ? `Last contact ${relTime(lastActivity.created_at)}`
    : "No contact yet";

  return { score, label, color, subLabel };
}

/** Determine the single most important next action. */
function nextBestAction(opts: {
  draftCount: number;
  openTaskCount: number;
  recentMatchCount: number;
  lastActivity: Activity | undefined;
  clientName: string;
}): { icon: React.ReactNode; title: string; subtitle: string; href?: string; action?: string } {
  const { draftCount, openTaskCount, recentMatchCount, lastActivity, clientName } = opts;
  const daysSince = lastActivity
    ? differenceInDays(new Date(), new Date(lastActivity.created_at))
    : 999;

  if (draftCount > 0) {
    return {
      icon: <Sparkles size={18} style={{ color: "#A78BFA" }} />,
      title: "Review AI draft",
      subtitle: `Aria drafted a message for ${clientName}`,
      action: "inbox",
    };
  }

  if (recentMatchCount > 0) {
    return {
      icon: <Mail size={18} style={{ color: "#3B82F6" }} />,
      title: "Send property update",
      subtitle: `${recentMatchCount} new match${recentMatchCount !== 1 ? "es" : ""} in the last 24h`,
      action: "inbox",
    };
  }

  if (daysSince >= 14) {
    return {
      icon: <MessageSquare size={18} style={{ color: "#22c55e" }} />,
      title: `Check in with ${clientName}`,
      subtitle: `Last contact was ${daysSince} days ago`,
      action: "inbox",
    };
  }

  if (openTaskCount > 0) {
    return {
      icon: <CheckSquare size={18} style={{ color: "#f59e0b" }} />,
      title: `Complete ${openTaskCount} open task${openTaskCount !== 1 ? "s" : ""}`,
      subtitle: "Stay on top of next steps",
      action: "tasks",
    };
  }

  return {
    icon: <Calendar size={18} style={{ color: "#9CA3AF" }} />,
    title: "Schedule a showing",
    subtitle: "Keep the momentum going",
    href: "/showings",
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ClientDetail({
  client,
  recentActivities,
  draftCount,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  lastDraftBody: _lastDraft,
  openTaskCount,
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

  const id         = String(client.id ?? "");
  const name       = String(client.name ?? "Client");
  const status     = (client.status as string | null) ?? null;
  const budgetMin  = (client.budget_min as number | null) ?? null;
  const budgetMax  = (client.budget_max as number | null) ?? null;
  const bedsWanted = (client.beds_wanted as number | null) ?? null;
  const bathsWanted = (client.baths_wanted as number | null) ?? null;
  const town       = (client.town as string | null) ?? null;
  const phone      = (client.phone as string | null) ?? null;
  const email      = (client.email as string | null) ?? null;
  const notes      = (client.notes as string | null) ?? null;
  const tags       = (client.tags as string[] | null) ?? [];
  const clientEmail = email ?? "";

  const budget     = budgetDisplay(budgetMin, budgetMax);
  const initial    = initialsOf(name);
  const lastActivity = recentActivities[0];

  const readiness  = computeReadiness(client, lastActivity);
  const nba        = nextBestAction({
    draftCount,
    openTaskCount,
    recentMatchCount,
    lastActivity,
    clientName: name,
  });

  // Fetch AI summary on mount
  useEffect(() => {
    if (summaryFetched.current) return;
    summaryFetched.current = true;

    const context = [
      `Client: ${name}`,
      status ? `Status: ${status}` : null,
      budget ? `Budget: ${budget}` : null,
      town ? `Looking in: ${town}` : null,
      bedsWanted ? `Wants: ${bedsWanted}bd` : null,
      lastActivity
        ? `Last contact: ${relTime(lastActivity.created_at)}`
        : "No prior contact",
      recentMatchCount > 0
        ? `${recentMatchCount} new property match${recentMatchCount !== 1 ? "es" : ""} today`
        : null,
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
            content: `Write a 2-sentence agent briefing about this client. Be specific, factual, and actionable. No filler. Context: ${context}`,
          },
        ],
      }),
    })
      .then((r) => r.json())
      .then((d: { reply?: string }) => {
        setSummary(d.reply ?? "");
      })
      .catch(() => setSummary(""))
      .finally(() => setSummaryLoading(false));
  }, [name, status, budget, town, bedsWanted, lastActivity, recentMatchCount]);

  // ── NBA action handler ───────────────────────────────────────────────────
  function handleNba() {
    if (nba.action === "inbox") { setInboxOpen(true); return; }
    if (nba.action === "tasks") { router.push(`/clients/${id}/tasks`); return; }
    if (nba.href) router.push(nba.href);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen pb-[130px]"
      style={{ background: "#0a0a0b", color: "#f0f0f5" }}
    >
      {/* ── Sticky top nav ── */}
      <div
        className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3"
        style={{
          background: "rgba(10,10,11,0.88)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "0.5px solid rgba(255,255,255,0.06)",
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full active:bg-white/10"
          aria-label="Back"
        >
          <ArrowLeft size={20} style={{ color: "#9CA3AF" }} />
        </button>
        <p
          className="flex-1 truncate text-[15px] font-semibold"
          style={{ color: "#ffffff" }}
        >
          {name}
        </p>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full active:bg-white/10"
          aria-label="Edit client"
        >
          <Pencil size={17} style={{ color: "#9CA3AF" }} />
        </button>
      </div>

      <div className="mx-auto max-w-lg px-5 pt-5">

        {/* ── Hero ── */}
        <div className="mb-5 flex items-center gap-4">
          {/* Avatar with readiness ring */}
          <div className="relative flex-shrink-0">
            <svg
              width="68"
              height="68"
              viewBox="0 0 68 68"
              className="absolute inset-0"
              style={{ transform: "rotate(-90deg)" }}
              aria-hidden="true"
            >
              <circle cx="34" cy="34" r="30" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
              <circle
                cx="34"
                cy="34"
                r="30"
                fill="none"
                stroke={readiness.color}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={`${(readiness.score / 100) * 188} 188`}
                style={{ opacity: 0.7 }}
              />
            </svg>
            <div
              className="flex h-[68px] w-[68px] items-center justify-center rounded-full text-[22px] font-bold text-white"
              style={{
                background: "linear-gradient(135deg, #3B82F6, #06B6D4)",
              }}
            >
              {initial}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h1
              className="text-[20px] font-bold leading-tight"
              style={{ color: "#ffffff", letterSpacing: "-0.02em" }}
            >
              {name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {status && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    color: "#9CA3AF",
                  }}
                >
                  {status}
                </span>
              )}
              {(town || budget) && (
                <span
                  className="text-[12px]"
                  style={{ color: "#6B7280" }}
                >
                  {[town?.split(",")[0]?.trim(), budget].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>
            {/* Readiness */}
            <div className="mt-1.5 flex items-center gap-1.5">
              <span
                className="text-[12px] font-semibold"
                style={{ color: readiness.color }}
              >
                {readiness.label}
              </span>
              <span className="text-[11px]" style={{ color: "#4B5563" }}>·</span>
              <span className="text-[11px]" style={{ color: "#6B7280" }}>
                {readiness.subLabel}
              </span>
            </div>
          </div>
        </div>

        {/* ── AI Summary ── */}
        <div
          className="mb-4 rounded-2xl p-4"
          style={{
            background: "rgba(167,139,250,0.07)",
            border: "0.5px solid rgba(167,139,250,0.18)",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            {/* Aria logo */}
            <svg viewBox="0 0 200 200" width="14" height="14" aria-hidden="true">
              <defs>
                <linearGradient id="cd-aria-grad" x1="100" y1="20" x2="100" y2="180" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#A78BFA" />
                  <stop offset="100%" stopColor="#7C3AED" />
                </linearGradient>
              </defs>
              <path
                d="M100 25 L165 175 L130 175 L120 150 L80 150 L70 175 L35 175 Z M90 125 L110 125 L100 100 Z"
                fill="url(#cd-aria-grad)"
              />
            </svg>
            <span
              className="text-[11px] font-semibold uppercase"
              style={{ color: "#A78BFA", letterSpacing: "0.06em" }}
            >
              Aria Summary
            </span>
          </div>
          {summaryLoading ? (
            <div className="space-y-2">
              <div
                className="h-3.5 rounded-full animate-pulse"
                style={{ background: "rgba(255,255,255,0.08)", width: "92%" }}
              />
              <div
                className="h-3.5 rounded-full animate-pulse"
                style={{ background: "rgba(255,255,255,0.08)", width: "76%" }}
              />
            </div>
          ) : summary ? (
            <p
              className="text-[13px] italic leading-relaxed"
              style={{ color: "#C4B5FD" }}
            >
              {summary}
            </p>
          ) : (
            <p className="text-[13px]" style={{ color: "#6B7280" }}>
              No summary available.
            </p>
          )}
        </div>

        {/* ── Next Best Action ── */}
        <button
          type="button"
          onClick={handleNba}
          className="mb-4 w-full text-left rounded-2xl p-4 active:opacity-80 transition-opacity"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "0.5px solid rgba(255,255,255,0.10)",
          }}
        >
          <p
            className="mb-2 text-[11px] font-semibold uppercase"
            style={{ color: "#6B7280", letterSpacing: "0.08em" }}
          >
            Next Best Action
          </p>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
              style={{ background: "rgba(255,255,255,0.07)" }}
            >
              {nba.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-[14px] font-semibold"
                style={{ color: "#ffffff" }}
              >
                {nba.title}
              </p>
              <p className="mt-0.5 text-[12px]" style={{ color: "#9CA3AF" }}>
                {nba.subtitle}
              </p>
            </div>
            <ChevronRight size={18} style={{ color: "#4B5563", flexShrink: 0 }} />
          </div>
        </button>

        {/* ── Matched Properties ── */}
        {matchedProperties.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <p
                className="text-[11px] font-semibold uppercase"
                style={{ color: "#6B7280", letterSpacing: "0.08em" }}
              >
                Matched Properties
              </p>
              <Link
                href="/properties"
                className="text-[12px] font-medium"
                style={{ color: "#3B82F6" }}
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
                  className="flex-shrink-0 rounded-xl p-3 active:opacity-80"
                  style={{
                    width: 160,
                    background: "rgba(255,255,255,0.04)",
                    border: "0.5px solid rgba(255,255,255,0.10)",
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{
                        background:
                          prop.score >= 80
                            ? "rgba(34,197,94,0.15)"
                            : "rgba(234,179,8,0.15)",
                        color: prop.score >= 80 ? "#22c55e" : "#eab308",
                      }}
                    >
                      {prop.score}
                    </span>
                  </div>
                  <p
                    className="text-[13px] font-semibold leading-tight mb-1 line-clamp-2"
                    style={{ color: "#ffffff" }}
                  >
                    {prop.address ?? "Property"}
                  </p>
                  {prop.price && (
                    <p className="text-[12px] font-medium" style={{ color: "#3B82F6" }}>
                      {fmtMoney(prop.price)}
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px]" style={{ color: "#6B7280" }}>
                    {[prop.beds && `${prop.beds}bd`, prop.baths && `${prop.baths}ba`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Timeline ── */}
        {recentActivities.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <p
                className="text-[11px] font-semibold uppercase"
                style={{ color: "#6B7280", letterSpacing: "0.08em" }}
              >
                Timeline
              </p>
              <Link
                href={`/clients/${id}/activity`}
                className="text-[12px] font-medium"
                style={{ color: "#3B82F6" }}
              >
                View all →
              </Link>
            </div>
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "0.5px solid rgba(255,255,255,0.08)",
              }}
            >
              {recentActivities.map((a, i) => {
                const dot   = activityDot(a);
                const label = activityLabel(a);
                const time  = relTime(a.created_at);
                return (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 px-4 py-3"
                    style={
                      i > 0
                        ? { borderTop: "0.5px solid rgba(255,255,255,0.06)" }
                        : {}
                    }
                  >
                    <div
                      className="mt-[5px] h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ background: DOT_COLORS[dot] }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p
                          className="text-[13px] font-medium"
                          style={{ color: "#e0e0e5" }}
                        >
                          {label}
                        </p>
                        {time && (
                          <p
                            className="flex-shrink-0 text-[11px]"
                            style={{ color: "#4B5563" }}
                          >
                            {time}
                          </p>
                        )}
                      </div>
                      {a.body && (
                        <p
                          className="mt-0.5 line-clamp-1 text-[12px] leading-relaxed"
                          style={{ color: "#6B7280" }}
                        >
                          {a.body}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Stat tiles ── */}
        <div className="mb-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setInboxOpen(true)}
            className="text-left rounded-2xl p-4 active:opacity-80"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "0.5px solid rgba(255,255,255,0.08)",
            }}
          >
            <p
              className="text-[11px] font-semibold uppercase mb-2"
              style={{ color: "#6B7280", letterSpacing: "0.07em" }}
            >
              Inbox
            </p>
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full mb-1"
              style={{ background: "rgba(59,130,246,0.12)" }}
            >
              <Mail size={16} style={{ color: "#3B82F6" }} />
            </div>
            <p className="text-[12px]" style={{ color: "#9CA3AF" }}>
              {clientEmail ? "Open thread →" : "No email"}
            </p>
          </button>

          <Link
            href={`/clients/${id}/tasks`}
            className="rounded-2xl p-4 active:opacity-80"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "0.5px solid rgba(255,255,255,0.08)",
            }}
          >
            <p
              className="text-[11px] font-semibold uppercase mb-2"
              style={{ color: "#6B7280", letterSpacing: "0.07em" }}
            >
              Tasks
            </p>
            <p
              className="text-[28px] font-bold leading-none mb-0.5"
              style={{ color: openTaskCount > 0 ? "#f59e0b" : "#48484a" }}
            >
              {openTaskCount > 0 ? openTaskCount : "—"}
            </p>
            <p className="text-[12px]" style={{ color: "#6B7280" }}>
              {openTaskCount === 1 ? "open" : openTaskCount > 1 ? "open" : "all done"}
            </p>
          </Link>
        </div>

        {/* ── Profile details (collapsible) ── */}
        <div
          className="mb-5 rounded-2xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "0.5px solid rgba(255,255,255,0.08)",
          }}
        >
          <button
            type="button"
            onClick={() => setProfileOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-4 active:bg-white/5"
          >
            <p
              className="text-[13px] font-semibold"
              style={{ color: "#ffffff" }}
            >
              Profile Details
            </p>
            <ChevronDown
              size={16}
              style={{
                color: "#6B7280",
                transform: profileOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 200ms",
              }}
            />
          </button>

          {profileOpen && (
            <div
              className="px-4 pb-4 space-y-3"
              style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}
            >
              {[
                { label: "Budget", value: budget || "—" },
                { label: "Town", value: town || "—" },
                { label: "Bedrooms", value: bedsWanted ? `${bedsWanted} bd` : "—" },
                { label: "Bathrooms", value: bathsWanted ? `${bathsWanted} ba` : "—" },
                { label: "Email", value: email || "—" },
                { label: "Phone", value: phone || "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-baseline justify-between gap-4 pt-3"
                  style={{ borderTop: "0.5px solid rgba(255,255,255,0.05)" }}
                >
                  <p className="text-[12px]" style={{ color: "#6B7280" }}>{label}</p>
                  <p className="text-[13px] font-medium text-right" style={{ color: "#e0e0e5" }}>
                    {value}
                  </p>
                </div>
              ))}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-3"
                  style={{ borderTop: "0.5px solid rgba(255,255,255,0.05)" }}
                >
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      style={{
                        background: "rgba(255,255,255,0.07)",
                        color: "#9CA3AF",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {notes && (
                <div className="pt-3" style={{ borderTop: "0.5px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-[11px] mb-1" style={{ color: "#6B7280" }}>Notes</p>
                  <p className="text-[13px] leading-relaxed" style={{ color: "#9CA3AF" }}>
                    {notes}
                  </p>
                </div>
              )}
            </div>
          )}
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
            phone: (client.phone as string | null) ?? null,
            email: (client.email as string | null) ?? null,
            status: (client.status as string | null) ?? null,
            budget_min: (client.budget_min as number | null) ?? null,
            budget_max: (client.budget_max as number | null) ?? null,
            town: (client.town as string | null) ?? null,
            beds_wanted: (client.beds_wanted as number | null) ?? null,
            baths_wanted: (client.baths_wanted as number | null) ?? null,
            lead_score: (client.lead_score as number | null) ?? null,
            notes: (client.notes as string | null) ?? null,
            client_role: (client.client_role as string | null) ?? null,
          }}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}
