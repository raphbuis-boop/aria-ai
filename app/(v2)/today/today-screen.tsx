"use client";

import * as React from "react";
import Link from "next/link";
import { Surface } from "@/components/v2/Surface";
import { Text } from "@/components/v2/Text";
import { Badge } from "@/components/v2/Badge";
import { Avatar } from "@/components/v2/Avatar";
import { EmptyState } from "@/components/v2/EmptyState";
import { ProgressBar } from "@/components/v2/ProgressBar";
import type { Brief } from "@/lib/types";
import type { TodayItem } from "@/lib/today-items";

// ─── Prop types ───────────────────────────────────────────────────────────────

export type TodayScreenProps = {
  userName: string;
  brief: Brief;
  items: TodayItem[];
  pipelineTotal: string;
  kpi: {
    activeClients: number;
    hotLeads: number;
    closingsThisWeek: number;
    newMatches: number;
  };
  showingsToday: Array<{
    id: string;
    address: string | null;
    showingDate: string | null;
    clientName: string | null;
  }>;
  hasAnyClients: boolean;
};

// ─── Urgency config ───────────────────────────────────────────────────────────

const URGENCY_COLOR: Record<number, string> = {
  1: "#FF4D4D", // closing — risk red
  2: "#F5A623", // hot lead — warning amber
  3: "#4F5BFF", // anniversary — accent blue
  4: "#536878", // BBA — muted slate
  5: "#2ECC71", // MLS match — success green
};

const URGENCY_BADGE: Record<
  number,
  "risk" | "warning" | "accent" | "muted" | "success"
> = {
  1: "risk",
  2: "warning",
  3: "accent",
  4: "muted",
  5: "success",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getDateLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function urgencyLabel(rank: number): string {
  switch (rank) {
    case 1: return "Closing";
    case 2: return "Hot lead";
    case 3: return "Today";
    case 4: return "Action needed";
    case 5: return "New match";
    default: return "";
  }
}

function triggerHaptic() {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
  } catch { /* never break on haptic failure */ }
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5E6068] mb-3">
      {children}
    </p>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  value,
  label,
  accent,
}: {
  value: number | string;
  label: string;
  accent?: string;
}) {
  return (
    <Surface variant="surface" className="p-3">
      <p
        className="text-[26px] font-bold leading-none tabular-nums mb-2"
        style={{ color: accent ?? "#E5E4E2", letterSpacing: "-0.03em" }}
      >
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-[0.08em] text-[#5E6068]">
        {label}
      </p>
    </Surface>
  );
}

// ─── Action item row ──────────────────────────────────────────────────────────

function ActionItem({
  item,
}: {
  item: TodayItem;
}) {
  const dotColor = URGENCY_COLOR[item.urgencyRank] ?? URGENCY_COLOR[5];
  const badgeVariant = URGENCY_BADGE[item.urgencyRank] ?? "muted";
  const isClosing = item.urgencyRank === 1;

  return (
    <Surface
      variant="surface"
      className="p-4"
      style={
        isClosing
          ? { borderColor: "rgba(255,77,77,0.25)", background: "rgba(255,77,77,0.05)" }
          : undefined
      }
    >
      {/* Row 1: dot · client name · urgency badge */}
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="shrink-0 rounded-full"
          style={{ width: 6, height: 6, background: dotColor, flexShrink: 0 }}
        />
        <span className="text-[14px] font-bold flex-1 leading-none truncate text-[#E5E4E2]">
          {item.clientName}
        </span>
        <Badge variant={badgeVariant} className="shrink-0">
          {urgencyLabel(item.urgencyRank)}
        </Badge>
      </div>

      {/* Row 2: reason */}
      <p className="text-[12px] text-[#9A9CA3] leading-relaxed pl-[14px] mb-1">
        {item.reason}
        {item.context ? (
          <span className="text-[#5E6068]"> · {item.context}</span>
        ) : null}
      </p>

      {/* CTA */}
      <div className="pl-[14px] mt-3">
        {item.actionType === "text" && item.clientPhone ? (
          // Tel: link — opens phone dialer. No send/draft logic this phase.
          <a
            href={`tel:${item.clientPhone}`}
            onClick={triggerHaptic}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#4F5BFF] active:opacity-60 transition-opacity"
          >
            {item.actionLabel}
            <span className="opacity-60">↗</span>
          </a>
        ) : item.actionType === "navigate" || item.actionType === "text" ? (
          <Link
            href={`/v2/contact/${item.clientId}`}
            onClick={triggerHaptic}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#4F5BFF] active:opacity-60 transition-opacity"
          >
            {item.actionLabel}
            <span className="opacity-60">→</span>
          </Link>
        ) : null}
      </div>
    </Surface>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function TodayScreen({
  userName,
  brief,
  items,
  pipelineTotal,
  kpi,
  showingsToday,
  hasAnyClients,
}: TodayScreenProps) {
  // Hydration-safe date/greeting (avoids SSR mismatch)
  const [greeting, setGreeting] = React.useState("Good morning");
  const [dateLabel, setDateLabel] = React.useState("");
  React.useEffect(() => {
    setGreeting(getGreeting());
    setDateLabel(getDateLabel());
  }, []);

  const topItems = items.slice(0, 5); // cap display at 5; prompt spec says 3–5
  const extraCount = items.length - topItems.length;

  return (
    <div className="px-4 pt-12 pb-6 max-w-lg mx-auto space-y-6">

      {/* ── 1. GREETING ─────────────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-3">
        <div>
          <Text variant="muted" size="xs" className="uppercase tracking-[0.10em] mb-1">
            {dateLabel}
          </Text>
          <Text
            as="h1"
            variant="primary"
            size="xl"
            weight="bold"
            className="leading-tight"
            style={{ letterSpacing: "-0.025em" }}
          >
            {greeting}, {userName}.
          </Text>
          <Text variant="secondary" size="base" className="mt-1">
            {items.length === 0
              ? "You're all caught up."
              : `${items.length} ${items.length === 1 ? "opportunity" : "opportunities"} need${items.length === 1 ? "s" : ""} your attention.`}
          </Text>
        </div>
        {/* Avatar — placeholder link target only this phase */}
        <Link href="/v2/contact/me" aria-label="Profile">
          <Avatar name={userName} size="md" />
        </Link>
      </header>

      {/* ── 2. AI BRIEF ─────────────────────────────────────────────────── */}
      <section>
        <SectionLabel>AI Brief</SectionLabel>
        <Surface
          variant="raised"
          className="p-4"
          style={{ borderColor: "rgba(79,91,255,0.35)" }}
        >
          {/* Accent top stripe */}
          <div className="flex items-center gap-2 mb-3">
            <span
              className="inline-block size-1.5 rounded-full"
              style={{ background: "#4F5BFF" }}
            />
            <Text variant="muted" size="xs" className="uppercase tracking-[0.10em]">
              Aria
            </Text>
          </div>

          {brief.headline ? (
            <Text variant="primary" size="md" weight="medium" className="leading-relaxed">
              {brief.headline}
            </Text>
          ) : (
            <Text variant="secondary" size="base">
              Nothing urgent today. Pipeline looks stable.
            </Text>
          )}

          {/* Chips for concrete counts */}
          {(kpi.closingsThisWeek > 0 || kpi.newMatches > 0 || kpi.hotLeads > 0) && (
            <div className="flex flex-wrap gap-2 mt-3">
              {kpi.hotLeads > 0 && (
                <Badge variant="warning">
                  {kpi.hotLeads} hot lead{kpi.hotLeads > 1 ? "s" : ""}
                </Badge>
              )}
              {kpi.newMatches > 0 && (
                <Badge variant="success">
                  {kpi.newMatches} new match{kpi.newMatches > 1 ? "es" : ""}
                </Badge>
              )}
              {kpi.closingsThisWeek > 0 && (
                <Badge variant="risk">
                  {kpi.closingsThisWeek} closing{kpi.closingsThisWeek > 1 ? "s" : ""} this week
                </Badge>
              )}
            </div>
          )}
        </Surface>
      </section>

      {/* ── 3. 3 THINGS RIGHT NOW ───────────────────────────────────────── */}
      {/*
        DATA SOURCE: buildTodayItems() from lib/today-items.ts — existing engine.
        Ranked by urgencyRank: 1=closing ≤3 days, 2=hot leads quiet 5+ days,
        3=birthdays/anniversaries today, 4=unsigned BBA, 5=new MLS matches.
        Capped at 5 items displayed. No new ranking logic invented here.
      */}
      <section>
        <SectionLabel>3 things right now</SectionLabel>

        {!hasAnyClients ? (
          <EmptyState
            title="No clients yet"
            description="Add your first client and Aria will surface what to do today."
          />
        ) : topItems.length === 0 ? (
          <EmptyState
            title="You're all caught up"
            description="No follow-ups, closings, or matches right now."
          />
        ) : (
          <div className="space-y-3">
            {topItems.map((item) => (
              <ActionItem key={item.id} item={item} />
            ))}
            {extraCount > 0 && (
              <Text variant="muted" size="sm" className="text-center pt-1">
                +{extraCount} more in Pipeline
              </Text>
            )}
          </div>
        )}
      </section>

      {/* ── 4. PIPELINE / GCI ───────────────────────────────────────────── */}
      <section>
        <SectionLabel>Pipeline</SectionLabel>

        {/* Pipeline total — real data from BriefService.pipelineTotal() */}
        <Surface variant="surface" className="p-4 mb-3">
          <div className="flex items-baseline justify-between mb-2">
            <Text variant="primary" size="lg" weight="bold" style={{ letterSpacing: "-0.02em" }}>
              {pipelineTotal}
            </Text>
            <Text variant="muted" size="xs" className="uppercase tracking-widest">
              In pipeline
            </Text>
          </div>

          {/*
            TODO (Phase 3): GCI this year and annual goal are not yet stored in
            agent_profiles — no gci_ytd or commission_goal columns exist in any
            migration as of 2026-06-04. Add those columns and surface real numbers.
            For now we show pipeline total only and hide the progress bar.
          */}
          <Text variant="muted" size="sm" className="mt-1">
            GCI goal and progress — coming soon
          </Text>

          {/* Placeholder bar shown at 0% until GCI data exists */}
          <ProgressBar value={0} height={3} className="mt-2 opacity-30" />
        </Surface>

        {/* KPI grid — all real */}
        <div className="grid grid-cols-2 gap-2">
          <KpiCard
            value={kpi.activeClients}
            label="Active clients"
            accent={kpi.activeClients > 0 ? "#E5E4E2" : undefined}
          />
          <KpiCard
            value={kpi.hotLeads}
            label="Hot leads"
            accent={kpi.hotLeads > 0 ? "#F5A623" : undefined}
          />
          <KpiCard
            value={kpi.newMatches}
            label="New matches"
            accent={kpi.newMatches > 0 ? "#2ECC71" : undefined}
          />
          <KpiCard
            value={kpi.closingsThisWeek}
            label="Closings this week"
            accent={kpi.closingsThisWeek > 0 ? "#FF4D4D" : undefined}
          />
        </div>
      </section>

      {/* ── 5. TODAY'S SHOWINGS (optional strip) ────────────────────────── */}
      {showingsToday.length > 0 && (
        <section>
          <SectionLabel>Today&apos;s showings</SectionLabel>
          <Surface variant="surface" className="divide-y divide-[#2A2B30]">
            {showingsToday.map((s) => (
              <Link
                key={s.id}
                href="/showings" // routes to v1 showings page (v2 version is a future phase)
                className="flex items-center gap-3 px-4 py-3 active:opacity-60 transition-opacity"
              >
                <Text
                  as="span"
                  variant="muted"
                  size="xs"
                  className="tabular-nums font-bold shrink-0 w-12"
                  style={{ color: "#4F5BFF" }}
                >
                  {formatTime(s.showingDate)}
                </Text>
                <div className="w-px self-stretch bg-[#2A2B30] shrink-0" />
                <div className="flex-1 min-w-0">
                  <Text variant="primary" size="sm" weight="medium" truncate>
                    {s.clientName ?? "Client"}
                  </Text>
                  <Text variant="muted" size="xs" truncate className="mt-0.5">
                    {s.address ?? "Address TBD"}
                  </Text>
                </div>
                <Text variant="muted" size="xs">→</Text>
              </Link>
            ))}
          </Surface>
        </section>
      )}

    </div>
  );
}
