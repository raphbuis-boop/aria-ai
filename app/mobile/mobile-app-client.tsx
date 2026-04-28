"use client";

import { createClient } from "@/lib/supabase/client";
import type { MobileClientRow } from "@/lib/mobile-briefing";
import { fmtMoney, initials, relTime } from "@/lib/utils";
import {
  Building2,
  Home,
  Inbox,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { MobileBbaAlert, MobileInboxRow } from "./page";

type Tab = "home" | "leads" | "inbox" | "settings";

const INBOX_FILTERS = ["All", "AI Drafts", "Unsent"] as const;

const AVATAR_COLORS = [
  "bg-red-500/20 text-red-400",
  "bg-blue-500/20 text-blue-400",
  "bg-purple-500/20 text-purple-400",
  "bg-green-500/20 text-green-400",
  "bg-amber-500/20 text-amber-400",
] as const;

function leadDots(score: number | null) {
  const n = score ?? 0;
  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: 10 }).map((_, j) => (
        <div
          key={j}
          className={`h-1.5 w-1.5 rounded-full ${j < n ? "bg-[#4f7bff]" : "bg-[#1e1e2e]"}`}
        />
      ))}
    </div>
  );
}

export function MobileAppClient({
  user,
  briefing,
  newMatches,
  bbaAlerts,
  followUpPreview,
  totalClients,
  stats,
  hotLeads,
  inboxRows,
  draftPendingCount,
}: {
  user: { email: string | null; fullName: string | null };
  briefing: string | null;
  newMatches: number;
  bbaAlerts: MobileBbaAlert[];
  followUpPreview: MobileClientRow | null;
  totalClients: number;
  stats: {
    pipelineLabel: string;
    hotCount: number;
    activeCount: number;
    closings: number;
    tasksOpen: number;
  };
  hotLeads: MobileClientRow[];
  inboxRows: MobileInboxRow[];
  draftPendingCount: number;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("home");
  const [signingOut, setSigningOut] = useState(false);
  const [inboxFilter, setInboxFilter] =
    useState<(typeof INBOX_FILTERS)[number]>("All");

  const firstName =
    user.fullName?.split(" ")[0] ?? user.email?.split("@")[0] ?? "there";
  const initial0 = firstName[0]?.toUpperCase() || "A";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const briefingBody =
    briefing ??
    (totalClients === 0
      ? "No clients yet. Add your first client from Clients, or open the full dashboard to load demo data."
      : "No new updates overnight.");

  const topHot = hotLeads[0] ?? null;

  const filteredInbox = useMemo(() => {
    return inboxRows.filter((r) => {
      if (inboxFilter === "All") return true;
      if (inboxFilter === "AI Drafts") return Boolean(r.ai_draft && !r.approved);
      if (inboxFilter === "Unsent")
        return r.type === "text" && !r.sent && Boolean(r.body?.trim());
      return true;
    });
  }, [inboxRows, inboxFilter]);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#0a0a0f] text-[#f0eee8]">
      <header className="shrink-0 px-5 pt-6">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[1px] text-[#4f7bff]">
          {today}
        </p>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[26px] font-semibold leading-tight text-[#f0eee8]">
            {greeting}, {firstName}
          </h1>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4f7bff]/20 text-[13px] font-bold text-[#6f9bff]">
            {initial0}
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        {tab === "home" ? (
          <div className="mx-auto max-w-lg px-5 pb-6 pt-[18px]">
            <div className="bg-gradient-to-br from-[#0e1428] to-[#111230] rounded-[20px] border-[0.5px] border-[#1e2a4e] p-[18px]">
              <div className="mb-2 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4f7bff]" />
                <span className="text-[10px] font-bold uppercase tracking-[1px] text-[#4f7bff]">
                  While you were away
                </span>
              </div>
              <p className="text-sm leading-[1.6] text-[#a0a0c0]">{briefingBody}</p>
            </div>

            {newMatches > 0 ? (
              <Link
                href="/properties/saved"
                className="mt-3 flex touch-manipulation items-center justify-between rounded-[16px] border-[0.5px] border-[#2a3a6e] bg-gradient-to-br from-[#0e1428] to-[#111230] px-4 py-3.5 active:border-[#4f7bff]"
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[1px] text-[#6f9bff]">
                    Property matches
                  </p>
                  <p className="mt-0.5 text-[15px] font-semibold text-[#f0eee8]">
                    {newMatches} new match{newMatches === 1 ? "" : "es"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#666680]">
                    Review saved listings and matches
                  </p>
                </div>
                <span className="text-[#6f9bff]">→</span>
              </Link>
            ) : null}

            {bbaAlerts.length > 0 ? (
              <Link
                href={`/clients/${bbaAlerts[0].clientId}`}
                className="mt-3 block touch-manipulation rounded-[20px] border-[0.5px] border-[#3a1a1a] bg-gradient-to-br from-[#1a0f0f] to-[#1e1014] p-[18px] active:opacity-95"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-[#ff5050]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px] text-[#ff6060]">
                    <ShieldAlert size={11} strokeWidth={2.5} /> BBA required
                  </span>
                  <span className="text-[11px] text-[#ff8a8a]">
                    {bbaAlerts.length} showing{bbaAlerts.length > 1 ? "s" : ""}
                  </span>
                </div>
                <p className="mb-0.5 text-base font-semibold text-[#f0eee8]">
                  {bbaAlerts[0].clientName} has no signed BBA
                </p>
                <p className="mb-3 text-xs leading-relaxed text-[#a08890]">
                  {bbaAlerts[0].address ?? "Upcoming showing"}
                  {bbaAlerts[0].showingDate
                    ? ` · ${new Date(bbaAlerts[0].showingDate!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                    : ""}
                </p>
                <span className="inline-block rounded-[9px] bg-gradient-to-br from-[#ff6060] to-[#ff4848] px-3 py-[7px] text-xs font-semibold text-white">
                  Open client →
                </span>
              </Link>
            ) : null}

            {topHot ? (
              <div className="mt-3 rounded-[20px] border-[0.5px] border-[#2a1a1a] bg-[#0f0f1e] p-[18px]">
                <div className="mb-3 flex items-center justify-between">
                  <span className="inline-flex items-center rounded-md bg-[#ff5050]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px] text-[#ff6060]">
                    Hot lead
                  </span>
                  <button
                    type="button"
                    onClick={() => setTab("leads")}
                    className="touch-manipulation text-[11px] font-semibold text-[#6f9bff] active:opacity-80"
                  >
                    All hot →
                  </button>
                </div>
                <Link href={`/clients/${topHot.id}`} className="block touch-manipulation">
                  <p className="text-base font-semibold text-[#f0eee8]">
                    {topHot.name}
                    {topHot.town ? ` · ${topHot.town}` : ""}
                  </p>
                </Link>
                <p className="mb-1 mt-0.5 text-xs text-[#666680]">
                  {topHot.status?.replace(/_/g, " ") ?? "—"}
                </p>
                <div className="mb-3 flex items-center gap-2">
                  {leadDots(topHot.lead_score)}
                  <span className="text-[11px] text-[#666680]">
                    Lead score {topHot.lead_score ?? 0}
                  </span>
                </div>
                <div className="flex gap-2">
                  <a
                    href={topHot.phone ? `tel:${topHot.phone}` : undefined}
                    className={`flex-1 rounded-[9px] border-[0.5px] border-[#50dc78]/20 bg-[#50dc78]/12 py-[7px] text-center text-xs font-semibold text-[#50dc78] touch-manipulation ${!topHot.phone ? "pointer-events-none opacity-40" : ""}`}
                  >
                    Call
                  </a>
                  <Link
                    href={`/clients/${topHot.id}`}
                    className="flex-1 rounded-[9px] border-[0.5px] border-[#4f7bff]/20 bg-[#4f7bff]/12 py-[7px] text-center text-xs font-semibold text-[#6f9bff] touch-manipulation active:opacity-90"
                  >
                    Client
                  </Link>
                </div>
              </div>
            ) : null}

            {followUpPreview ? (
              <Link
                href={`/clients/${followUpPreview.id}`}
                className="mt-3 block touch-manipulation rounded-[20px] border-[0.5px] border-[#1e1e2e] bg-[#0f0f1e] p-[18px] active:border-[#4f7bff]/40"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="inline-flex items-center rounded-md border-[0.5px] border-[#ffb832]/20 bg-[#ffb832]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.8px] text-[#ffb832]">
                    Follow-up
                  </span>
                </div>
                <p className="text-[15px] font-semibold text-[#f0eee8]">
                  {followUpPreview.name}
                  {followUpPreview.town ? ` · ${followUpPreview.town}` : ""}
                </p>
                <p className="mb-3 mt-0.5 text-xs text-[#666680]">
                  {followUpPreview.status?.replace(/_/g, " ") ?? "Check in"}
                </p>
                <span className="inline-block rounded-[9px] border-[0.5px] border-[#4f7bff]/20 bg-[#4f7bff]/12 px-3 py-[7px] text-xs font-semibold text-[#6f9bff]">
                  Open client →
                </span>
              </Link>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <Link
                href="/mls"
                className="flex touch-manipulation items-center gap-3 rounded-[16px] border-[0.5px] border-[#2a3a6e] bg-gradient-to-br from-[#0e1428] to-[#111230] px-4 py-[14px] active:border-[#4f7bff]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#4f7bff]/15 text-[#6f9bff]">
                  <Search size={18} strokeWidth={2.25} />
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold leading-tight text-[#f0eee8]">
                    Browse MLS
                  </div>
                  <div className="mt-0.5 text-[11px] leading-tight text-[#666680]">
                    Live NJ listings
                  </div>
                </div>
              </Link>
              <Link
                href="/properties"
                className="flex touch-manipulation items-center gap-3 rounded-[16px] border-[0.5px] border-[#1e1e2e] bg-[#0f0f1e] px-4 py-[14px] active:border-[#4f7bff]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#4f7bff]/12 text-[#6f9bff]">
                  <Building2 size={18} strokeWidth={2.25} />
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold leading-tight text-[#f0eee8]">
                    My properties
                  </div>
                  <div className="mt-0.5 text-[11px] leading-tight text-[#666680]">
                    Saved + matches
                  </div>
                </div>
              </Link>
            </div>

            {draftPendingCount > 0 ? (
              <button
                type="button"
                onClick={() => setTab("inbox")}
                className="mt-3 w-full touch-manipulation rounded-[16px] border-[0.5px] border-[#2a2a4e] bg-[#12121e] px-4 py-3.5 text-left active:bg-[#16162a]"
              >
                <p className="text-[10px] font-bold uppercase tracking-[1px] text-[#6f9bff]">
                  Inbox
                </p>
                <p className="mt-0.5 text-[15px] font-semibold text-[#f0eee8]">
                  {draftPendingCount} AI draft{draftPendingCount === 1 ? "" : "s"}{" "}
                  awaiting approval
                </p>
                <p className="mt-0.5 text-[11px] text-[#666680]">Tap to review</p>
              </button>
            ) : null}

            <p className="mb-2.5 mt-5 text-[10px] font-semibold uppercase tracking-[1.2px] text-[#444460]">
              Stats
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-[18px] border-[0.5px] border-[#1a1a2c] bg-[#0d0d1c] p-4">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.8px] text-[#444460]">
                  Pipeline
                </p>
                <p className="text-2xl font-semibold leading-none text-[#4f7bff]">
                  {stats.pipelineLabel}
                </p>
              </div>
              <div className="rounded-[18px] border-[0.5px] border-[#1a1a2c] bg-[#0d0d1c] p-4">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.8px] text-[#444460]">
                  Hot leads
                </p>
                <p className="text-2xl font-semibold leading-none text-[#ffb832]">
                  {stats.hotCount}
                </p>
              </div>
              <div className="rounded-[18px] border-[0.5px] border-[#1a1a2c] bg-[#0d0d1c] p-4">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.8px] text-[#444460]">
                  Active clients
                </p>
                <p className="text-2xl font-semibold leading-none text-[#f0eee8]">
                  {stats.activeCount}
                </p>
              </div>
              <div className="rounded-[18px] border-[0.5px] border-[#1a1a2c] bg-[#0d0d1c] p-4">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.8px] text-[#444460]">
                  Closings
                </p>
                <p className="text-2xl font-semibold leading-none text-[#50dc78]">
                  {stats.closings}
                </p>
              </div>
            </div>

            {stats.tasksOpen > 0 ? (
              <p className="mt-3 text-center text-[12px] text-[#666680]">
                {stats.tasksOpen} open task{stats.tasksOpen === 1 ? "" : "s"} — manage in{" "}
                <Link
                  href="/dashboard"
                  className="font-medium text-[#6f9bff] underline-offset-2 hover:underline"
                >
                  full dashboard
                </Link>
              </p>
            ) : null}

            <p className="mb-2.5 mt-5 text-[10px] font-semibold uppercase tracking-[1.2px] text-[#444460]">
              Ask Aria
            </p>
            <Link
              href="/ai"
              className="flex touch-manipulation items-center gap-2.5 rounded-[14px] border-[0.5px] border-[#2a2a3e] bg-[#12121e] px-4 py-[13px] active:border-[#4f7bff]/50"
            >
              <Sparkles size={16} className="shrink-0 text-[#4f7bff]" strokeWidth={2} />
              <span className="text-sm text-[#555570]">Ask Aria anything…</span>
            </Link>

            <div className="mt-4 flex flex-wrap gap-[7px]">
              <Link
                href="/clients?new=1"
                className="touch-manipulation rounded-[20px] border-[0.5px] border-[#1e1e2e] bg-[#12121e] px-[14px] py-[7px] text-xs font-medium text-[#666680] active:border-[#4f7bff]/40"
              >
                + New client
              </Link>
              <Link
                href="/showings?new=1"
                className="touch-manipulation rounded-[20px] border-[0.5px] border-[#1e1e2e] bg-[#12121e] px-[14px] py-[7px] text-xs font-medium text-[#666680] active:border-[#4f7bff]/40"
              >
                Log showing
              </Link>
              <Link
                href="/mls"
                className="touch-manipulation rounded-[20px] border-[0.5px] border-[#1e1e2e] bg-[#12121e] px-[14px] py-[7px] text-xs font-medium text-[#666680] active:border-[#4f7bff]/40"
              >
                Properties
              </Link>
              <Link
                href="/pipeline"
                className="touch-manipulation rounded-[20px] border-[0.5px] border-[#1e1e2e] bg-[#12121e] px-[14px] py-[7px] text-xs font-medium text-[#666680] active:border-[#4f7bff]/40"
              >
                Pipeline
              </Link>
            </div>
          </div>
        ) : null}

        {tab === "leads" ? (
          <div className="mx-auto max-w-lg px-5 pb-6 pt-4">
            <div className="mb-3 flex items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-[#444460]">
                  Pipeline
                </p>
                <h2 className="text-[20px] font-medium text-[#f0eee8]">Hot leads</h2>
              </div>
              <span className="text-[15px] font-medium text-[#ffb832]">{stats.hotCount}</span>
            </div>
            {hotLeads.length === 0 ? (
              <div className="rounded-[20px] border-[0.5px] border-[#1e1e2e] bg-[#0f0f1e] px-4 py-8 text-center">
                <p className="text-[14px] font-medium text-[#666680]">No hot leads</p>
                <p className="mt-2 text-[13px] leading-relaxed text-[#555570]">
                  Leads with score 8+, or status hot or showing, appear here — same rules as
                  the main dashboard.
                </p>
                <Link
                  href="/clients"
                  className="mt-4 inline-block touch-manipulation text-[13px] font-semibold text-[#6f9bff] active:opacity-80"
                >
                  View all clients →
                </Link>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {hotLeads.map((c) => (
                  <li key={c.id}>
                    <div className="rounded-[20px] border-[0.5px] border-[#2a1a1a] bg-[#0f0f1e] p-[18px]">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="inline-flex items-center rounded-md bg-[#ff5050]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.5px] text-[#ff6060]">
                          Hot lead
                        </span>
                      </div>
                      <Link href={`/clients/${c.id}`} className="block touch-manipulation">
                        <p className="text-base font-semibold text-[#f0eee8]">
                          {c.name}
                          {c.town ? ` · ${c.town}` : ""}
                        </p>
                      </Link>
                      <p className="mb-1 mt-0.5 text-xs text-[#666680]">
                        {c.status?.replace(/_/g, " ") ?? "—"}
                      </p>
                      <p className="mb-3 text-[12px] text-[#888898]">
                        Budget {fmtMoney(c.budget_min)} – {fmtMoney(c.budget_max)}
                      </p>
                      <div className="mb-3 flex items-center gap-2">
                        {leadDots(c.lead_score)}
                        <span className="text-[11px] text-[#666680]">
                          Lead score {c.lead_score ?? 0}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={c.phone ? `tel:${c.phone}` : undefined}
                          className={`flex-1 rounded-[9px] border-[0.5px] border-[#50dc78]/20 bg-[#50dc78]/12 py-[7px] text-center text-xs font-semibold text-[#50dc78] touch-manipulation ${!c.phone ? "pointer-events-none opacity-40" : ""}`}
                        >
                          Call now
                        </a>
                        <Link
                          href={`/clients/${c.id}`}
                          className="flex-1 rounded-[9px] border-[0.5px] border-[#4f7bff]/20 bg-[#4f7bff]/12 py-[7px] text-center text-xs font-semibold text-[#6f9bff] touch-manipulation active:opacity-90"
                        >
                          Open client
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {tab === "inbox" ? (
          <div className="pb-6 pt-6">
            <div className="mx-auto max-w-lg px-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-2xl font-semibold text-white">Inbox</h2>
                {draftPendingCount > 0 ? (
                  <span className="rounded-lg bg-red-500 px-2.5 py-1 text-xs font-bold text-white">
                    {draftPendingCount}
                  </span>
                ) : null}
              </div>
              <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1 [-webkit-overflow-scrolling:touch]">
                {INBOX_FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setInboxFilter(f)}
                    className={`touch-manipulation shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                      inboxFilter === f
                        ? "border-[#4f7bff]/30 bg-[#4f7bff]/15 text-[#6f9bff]"
                        : "border-[#1e1e2e] bg-[#12121e] text-[#666680]"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="mx-auto max-w-lg space-y-2 px-5">
              {filteredInbox.length === 0 ? (
                <div className="py-16 text-center text-[#444460]">
                  <p className="font-medium">All clear</p>
                  <p className="mt-1 text-sm">No messages in this category</p>
                </div>
              ) : (
                filteredInbox.map((item, i) => {
                  const pending = Boolean(item.ai_draft && !item.approved);
                  const clientName = item.clients?.name ?? "Client";
                  return (
                    <Link key={item.id} href="/inbox" className="block touch-manipulation">
                      <div
                        className={`flex items-start gap-3 rounded-2xl border p-3.5 transition-colors ${
                          pending ? "border-[#2a2a4e] bg-[#12121e]" : "border-[#1e1e2e] bg-[#12121e] opacity-80"
                        }`}
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] text-xs font-bold ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}
                        >
                          {initials(clientName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-semibold text-[#d0d0e0]">
                              {clientName}
                            </span>
                            {pending ? (
                              <span className="shrink-0 rounded bg-[#4f7bff]/12 px-2 py-0.5 text-[10px] font-bold text-[#6f9bff]">
                                AI DRAFT
                              </span>
                            ) : null}
                            {inboxTypeBadge(item.type)}
                            <span className="ml-auto shrink-0 text-xs text-[#444460]">
                              {new Date(item.created_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                          <p
                            className={`line-clamp-3 text-sm leading-relaxed ${
                              pending ? "text-[#c0bfd8]" : "text-[#888898]"
                            }`}
                          >
                            {item.body || "No content"}
                          </p>
                          <p className="mt-1.5 text-[11px] text-[#555570]">
                            {relTime(item.created_at)} · Open full inbox to approve and send
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}

              <Link
                href="/inbox"
                className="mt-4 block touch-manipulation rounded-[14px] border-[0.5px] border-[#2a2a3e] bg-[#0f0f1e] py-3 text-center text-[13px] font-semibold text-[#6f9bff] active:bg-[#14142a]"
              >
                Open full inbox
              </Link>
            </div>
          </div>
        ) : null}

        {tab === "settings" ? (
          <div className="mx-auto max-w-lg space-y-1 px-5 pb-6 pt-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[1.2px] text-[#444460]">
              Account
            </p>
            <SettingsRow href="/settings" title="Voice, automation & profile" />
            <SettingsRow href="/dashboard" title="Full dashboard" />
            <SettingsRow href="/clients" title="All clients" />
            <SettingsRow href="/transactions" title="Transactions" />

            <p className="mb-2 mt-6 px-1 text-[12px] leading-relaxed text-[#555570]">
              Signed in as{" "}
              <span className="text-[#a0a0c0]">{user.email ?? "your account"}</span>
            </p>
            <button
              type="button"
              onClick={() => void signOut()}
              disabled={signingOut}
              className="touch-manipulation mt-2 w-full rounded-[14px] border border-[#3a1a1a] bg-[#1a0f0f] py-3.5 text-[14px] font-semibold text-[#ff8a8a] disabled:opacity-50"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        ) : null}
      </main>

      <nav
        className="shrink-0 border-t border-[#0f0f1a] bg-[#06060c]/95 px-4 pt-2 backdrop-blur-xl"
        style={{
          paddingBottom: "max(10px, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="mx-auto flex w-full max-w-[420px] items-center justify-around gap-1 rounded-[26px] border-[0.5px] border-[#1a1a2e] bg-[#0f0f1c] p-1">
          <TabPill
            label="Home"
            Icon={Home}
            active={tab === "home"}
            onClick={() => setTab("home")}
          />
          <TabPill
            label="Leads"
            Icon={Users}
            active={tab === "leads"}
            onClick={() => setTab("leads")}
            badge={stats.hotCount > 0 ? stats.hotCount : undefined}
          />
          <TabPill
            label="Inbox"
            Icon={Inbox}
            active={tab === "inbox"}
            onClick={() => setTab("inbox")}
            badge={draftPendingCount > 0 ? draftPendingCount : undefined}
          />
          <TabPill
            label="Settings"
            Icon={Settings}
            active={tab === "settings"}
            onClick={() => setTab("settings")}
          />
        </div>
      </nav>
    </div>
  );
}

function inboxTypeBadge(type: string) {
  if (type === "showing")
    return (
      <span className="shrink-0 rounded bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-400">
        SHOWING
      </span>
    );
  if (type === "call")
    return (
      <span className="shrink-0 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
        CALL
      </span>
    );
  if (type === "note")
    return (
      <span className="shrink-0 rounded bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-400">
        NOTE
      </span>
    );
  if (type === "text")
    return (
      <span className="shrink-0 rounded bg-[#2a2a3e] px-2 py-0.5 text-[10px] font-bold text-[#888898]">
        TEXT
      </span>
    );
  return null;
}

function SettingsRow({ href, title }: { href: string; title: string }) {
  return (
    <Link
      href={href}
      className="flex touch-manipulation items-center justify-between rounded-[14px] border-[0.5px] border-[#1e1e2e] bg-[#12121e] px-4 py-3.5 active:border-[#4f7bff]/40"
    >
      <span className="text-[15px] font-medium text-[#d0d0e0]">{title}</span>
      <span className="text-[#555570]">→</span>
    </Link>
  );
}

function TabPill({
  label,
  Icon,
  active,
  onClick,
  badge,
}: {
  label: string;
  Icon: typeof Home;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`touch-manipulation flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-[20px] py-2 ${
        active ? "bg-[#1e1e38] text-white" : "text-[#3a3a52]"
      }`}
      aria-label={label}
      aria-current={active ? "page" : undefined}
    >
      <span className="relative flex h-7 w-7 items-center justify-center">
        <Icon size={20} strokeWidth={active ? 2.25 : 2} />
        {badge != null && badge > 0 ? (
          <span className="absolute -right-1.5 -top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-md bg-[#ff4d4d] px-1 text-[9px] font-bold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </span>
      <span className="max-w-full truncate text-[10px] font-semibold tracking-tight">
        {label}
      </span>
    </button>
  );
}
